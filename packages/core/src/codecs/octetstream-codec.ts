/********************************************************************************
 * Copyright (c) 2018 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0, or the W3C Software Notice and
 * Document License (2015-05-13) which is available at
 * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.
 *
 * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513
 ********************************************************************************/

import { ContentCodec } from "../content-serdes";
import { DataSchema, DataSchemaValue } from "wot-typescript-definitions";
import { getFloat16, setFloat16 } from "@petamoriken/float16";
import { createLoggers } from "../logger";
import { Endianness } from "../protocol-interfaces";

const { debug, warn } = createLoggers("core", "octetstream-codec");

/**
 * Codec to produce and consume simple data items and deserialize and serialize
 * them as sequence of bytes.
 *
 * This codec uses schema information and parameters passed to the content type
 * to determine the proper encoding and decoding. The following content type
 * parameters are supported:
 *
 * * length: Number of bytes which shall be produced during serialization
 *   or consumed during deserialization.
 *   Required for `valueToBytes`, used for consistency check in `bytesToValue`.
 * * signed: `true` or `false`, defaults to `false`
 * * byteorder: `bigendian` or `littleendian`, defaults to `bigendian`
 * * charset: Charset used for encoding and decoding of strings, defaults to `utf8`.
 *
 * The following schema data types are supported:
 *
 * * boolean: encodes to all 0's or 1's, any non-zero value decodes to true
 * * integer: according to length / signed / byteorder
 * * number: according to length (4 or 8) and byteorder
 * * string: according to charset
 * * null: encodes to empty buffer, decodes to `null`
 *
 * An Error is thrown if the codec is not able to perform the requested action.
 */
export default class OctetstreamCodec implements ContentCodec {
    getMediaType(): string {
        return "application/octet-stream";
    }

    bytesToValue(
        bytes: Buffer,
        schema?: DataSchema,
        parameters: { [key: string]: string | undefined } = {}
    ): DataSchemaValue {
        debug("OctetstreamCodec parsing", bytes);
        debug("Parameters", parameters);

        const length =
            parameters.length != null
                ? parseInt(parameters.length)
                : (warn("Missing 'length' parameter necessary for write. I'll do my best"), undefined);

        if (length !== undefined) {
            if (isNaN(length) || length < 0) {
                throw new Error("'length' parameter must be a non-negative number");
            }
            if (length !== bytes.length) {
                throw new Error(`Lengths do not match, required: ${length} provided: ${bytes.length}`);
            }
        }

        let signed = true; // default to signed
        if (parameters.signed !== undefined) {
            if (parameters.signed !== "true" && parameters.signed !== "false") {
                throw new Error("'signed' parameter must be 'true' or 'false'");
            }
            signed = parameters.signed === "true";
        }

        let bitLength = schema?.["ex:bitLength"] !== undefined ? parseInt(schema["ex:bitLength"]) : bytes.length * 8;

        if (isNaN(bitLength) || bitLength < 0) {
            throw new Error("'ex:bitLength' must be a non-negative number");
        }

        const offset = schema?.["ex:bitOffset"] !== undefined ? parseInt(schema["ex:bitOffset"]) : 0;

        if (isNaN(offset) || offset < 0) {
            throw new Error("'ex:bitOffset' must be a non-negative number");
        }

        const bigEndian = !(parameters.byteSeq?.includes(Endianness.LITTLE_ENDIAN) === true); // default to big endian
        let dataType: string = schema?.type;

        if (!dataType) {
            throw new Error("Missing 'type' property in schema");
        }

        // Check type specification
        // according paragraph 3.3.3 of https://datatracker.ietf.org/doc/rfc8927/
        // Parse type property only if this test passes
        if (/(short|(u)?int(8|16|32)?$|float(16|32|64)?|byte)/.test(dataType.toLowerCase())) {
            const typeSem = /(u)?(short|int|float|byte)(8|16|32|64)?/.exec(dataType.toLowerCase());
            if (typeSem) {
                if (typeSem[1] === "u") {
                    // compare with schema information
                    if (parameters?.signed === "true") {
                        throw new Error("Type is unsigned but 'signed' is true");
                    }
                    // no schema, but type is unsigned
                    signed = false;
                }
                dataType = typeSem[2];
                if (parseInt(typeSem[3]) !== bitLength) {
                    throw new Error(
                        `Type is '${(typeSem[1] ?? "") + typeSem[2] + typeSem[3]}' but 'ex:bitLength' is ` + bitLength
                    );
                }
            }
        }

        if (bitLength > bytes.length * 8 - offset) {
            throw new Error(
                `'ex:bitLength' is ${bitLength}, but buffer length at offset ${offset} is ${bytes.length * 8 - offset}`
            );
        }

        // Handle byte swapping
        if (parameters?.byteSeq?.includes("BYTE_SWAP") === true && bytes.length > 1) {
            bytes.swap16();
        }

        if (offset !== undefined && bitLength < bytes.length * 8) {
            bytes = this.readBits(bytes, offset, bitLength);
            bitLength = bytes.length * 8;
        }

        // determine return type
        switch (dataType) {
            case "boolean":
                // true if any byte is non-zero
                return !bytes.every((val) => val === 0);
            case "byte":
            case "short":
            case "int":
            case "integer":
                return this.integerToValue(bytes, { dataLength: bitLength, bigEndian, signed });
            case "float":
            case "double":
            case "number":
                return this.numberToValue(bytes, { dataLength: bitLength, bigEndian });
            case "string":
                return bytes.toString(parameters.charset as BufferEncoding);
            case "object":
                if (schema === undefined || schema.properties === undefined) {
                    throw new Error("Missing schema for object");
                }
                return this.objectToValue(bytes, schema, parameters);
            case "null":
                return null;
            case "array":
            default:
                throw new Error("Unable to handle dataType " + dataType);
        }
    }

    private integerToValue(
        bytes: Buffer,
        options: { dataLength: number; bigEndian: boolean; signed: boolean }
    ): number {
        const { dataLength, bigEndian, signed } = options;

        switch (dataLength) {
            case 8:
                return signed ? bytes.readInt8(0) : bytes.readUInt8(0);
            case 16:
                return bigEndian
                    ? signed
                        ? bytes.readInt16BE(0)
                        : bytes.readUInt16BE(0)
                    : signed
                    ? bytes.readInt16LE(0)
                    : bytes.readUInt16LE(0);

            case 32:
                return bigEndian
                    ? signed
                        ? bytes.readInt32BE(0)
                        : bytes.readUInt32BE(0)
                    : signed
                    ? bytes.readInt32LE(0)
                    : bytes.readUInt32LE(0);

            default: {
                const result = bigEndian
                    ? signed
                        ? bytes.readIntBE(0, dataLength / 8)
                        : bytes.readUIntBE(0, dataLength / 8)
                    : signed
                    ? bytes.readIntLE(0, dataLength / 8)
                    : bytes.readUIntLE(0, dataLength / 8);
                // warn about numbers being too big to be represented as safe integers
                if (!Number.isSafeInteger(result)) {
                    warn("Result is not a safe integer");
                }
                return result;
            }
        }
    }

    private numberToValue(bytes: Buffer, options: { dataLength: number; bigEndian: boolean }): number {
        const { dataLength, bigEndian } = options;
        switch (dataLength) {
            case 16:
                return getFloat16(new DataView(bytes.buffer), bytes.byteOffset, !bigEndian);
            case 32:
                return bigEndian ? bytes.readFloatBE(0) : bytes.readFloatLE(0);

            case 64:
                return bigEndian ? bytes.readDoubleBE(0) : bytes.readDoubleLE(0);

            default:
                throw new Error("Wrong buffer length for type 'number', must be 16, 32, or 64 is " + dataLength);
        }
    }

    private objectToValue(
        bytes: Buffer,
        schema?: DataSchema,
        parameters: { [key: string]: string | undefined } = {}
    ): DataSchemaValue {
        if (schema?.type !== "object") {
            throw new Error("Schema must be of type 'object'");
        }

        const result: { [key: string]: unknown } = {};
        const sortedProperties = Object.getOwnPropertyNames(schema.properties);
        for (const propertyName of sortedProperties) {
            const propertySchema = schema.properties[propertyName];
            const length = bytes.length.toString();
            result[propertyName] = this.bytesToValue(bytes, propertySchema, { ...parameters, length });
        }
        return result;
    }

    valueToBytes(value: unknown, schema?: DataSchema, parameters: { [key: string]: string | undefined } = {}): Buffer {
        debug(`OctetstreamCodec serializing '${value}'`);

        const bigEndian = !(parameters.byteSeq?.includes(Endianness.LITTLE_ENDIAN) === true); // default to big endian

        let signed = true; // default to true

        if (parameters.signed !== undefined) {
            if (parameters.signed !== "true" && parameters.signed !== "false") {
                throw new Error("'signed' parameter must be 'true' or 'false'");
            }
            signed = parameters.signed === "true";
        }

        let length =
            parameters.length != null
                ? parseInt(parameters.length)
                : (warn("Missing 'length' parameter necessary for write. I'll do my best"), undefined);

        if (length !== undefined && (isNaN(length) || length < 0)) {
            throw new Error("'length' parameter must be a non-negative number");
        }

        let bitLength = schema?.["ex:bitLength"] !== undefined ? parseInt(schema["ex:bitLength"]) : undefined;

        if (bitLength !== undefined && (isNaN(bitLength) || bitLength < 0)) {
            throw new Error("'ex:bitLength' must be a non-negative number");
        }

        const offset = schema?.["ex:bitOffset"] !== undefined ? parseInt(schema["ex:bitOffset"]) : 0;

        if (isNaN(offset) || offset < 0) {
            throw new Error("'ex:bitOffset' must be a non-negative number");
        }

        let dataType: string = schema?.type ?? undefined;

        if (value === undefined) {
            throw new Error("Undefined value");
        }

        if (dataType === undefined) {
            throw new Error("Missing 'type' property in schema");
        }

        // Check type specification
        // according paragraph 3.3.3 of https://datatracker.ietf.org/doc/rfc8927/
        // Parse type property only if this test passes
        if (/(short|(u)?int(8|16|32)?$|float(16|32|64)?|byte)/.test(dataType.toLowerCase())) {
            const typeSem = /(u)?(short|int|float|byte)(8|16|32|64)?/.exec(dataType.toLowerCase());
            if (typeSem) {
                if (typeSem[1] === "u") {
                    // compare with schema information
                    if (parameters?.signed === "true") {
                        throw new Error("Type is unsigned but 'signed' is true");
                    }
                    // no schema, but type is unsigned
                    signed = false;
                }
                dataType = typeSem[2];
                if (bitLength !== undefined) {
                    if (parseInt(typeSem[3]) !== bitLength) {
                        throw new Error(
                            `Type is '${(typeSem[1] ?? "") + typeSem[2] + typeSem[3]}' but 'ex:bitLength' is ` +
                                bitLength
                        );
                    }
                } else {
                    bitLength = +typeSem[3];
                }
            }
        }

        // determine buffer length
        if (length === undefined) {
            if (bitLength !== undefined) {
                length = Math.ceil((offset + bitLength) / 8);
            }
            warn("Missing 'length' parameter necessary for write. I'll do my best");
        } else {
            if (bitLength === undefined) {
                bitLength = length * 8;
            } else {
                if (length * 8 < bitLength + offset) {
                    throw new Error("Length is too short for 'ex:bitLength' and 'ex:bitOffset'");
                }
            }
        }

        switch (dataType) {
            case "boolean":
                if (value === true) {
                    // Write 1's to bits at offset to offset + bitLength
                    const buf = Buffer.alloc(length ?? 1, 0);
                    for (let i = offset; i < offset + (bitLength ?? buf.length * 8); ++i) {
                        buf[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
                    }
                    return buf;
                } else {
                    return Buffer.alloc(length ?? 1, 0);
                }
            case "byte":
            case "short":
            case "int":
            case "integer":
                return this.valueToInteger(value, {
                    bitLength,
                    byteLength: length,
                    bigEndian,
                    offset,
                    signed,
                    byteSeq: parameters.byteSeq ?? "",
                });
            case "float":
            case "number":
                return this.valueToNumber(value, {
                    bitLength,
                    byteLength: length,
                    bigEndian,
                    offset,
                    byteSeq: parameters.byteSeq ?? "",
                });
            case "string": {
                return this.valueToString(value, {
                    bitLength,
                    byteLength: length,
                    offset,
                    charset: parameters.charset ?? "utf8",
                });
            }
            case "object":
                if (schema === undefined || schema.properties === undefined) {
                    throw new Error("Missing schema for object");
                }
                return value === null
                    ? Buffer.alloc(0)
                    : this.valueToObject(value as { [key: string]: any }, schema, parameters); // eslint-disable-line @typescript-eslint/no-explicit-any
            case "array":
            case "undefined":
                throw new Error("Unable to handle dataType " + dataType);
            case "null":
                return Buffer.alloc(0);
            default:
                throw new Error("Unable to handle dataType " + dataType);
        }
    }

    private valueToInteger(
        value: unknown,
        options: {
            bitLength: number | undefined;
            byteLength: number | undefined;
            offset: number | undefined;
            bigEndian: boolean;
            signed: boolean;
            byteSeq: string;
        }
    ): Buffer {
        const length = options.bitLength ?? 32;
        const offset = options.offset ?? 0;
        const byteLength = options.byteLength ?? Math.ceil((offset + length) / 8);
        const { bigEndian, signed, byteSeq } = options;

        if (typeof value !== "number") {
            throw new Error("Value is not a number");
        }

        // warn about numbers being too big to be represented as safe integers
        if (!Number.isSafeInteger(value)) {
            warn("Value is not a safe integer", value);
        }
        const limit = Math.pow(2, signed ? length - 1 : length) - 1;
        // throw error on overflow
        if (signed) {
            if (value < -limit - 1 || value > limit) {
                throw new Error(
                    "Integer overflow when representing " + value + " as a signed integer using " + length + " bit(s)"
                );
            }
        } else {
            if (value < 0 || value > limit) {
                throw new Error(
                    "Integer overflow when representing " +
                        value +
                        " as an unsigned integer using " +
                        length +
                        " bit(s)"
                );
            }
        }

        const buf = Buffer.alloc(byteLength);

        if (offset !== 0) {
            this.writeBits(buf, value, offset, length, bigEndian);
            return buf;
        }
        // Handle byte swapping

        if (byteSeq?.includes("BYTE_SwAP") && byteLength > 1) {
            buf.swap16();
        }
        switch (byteLength) {
            case 1:
                signed ? buf.writeInt8(value, 0) : buf.writeUInt8(value, 0);
                break;

            case 2:
                bigEndian
                    ? signed
                        ? buf.writeInt16BE(value, 0)
                        : buf.writeUInt16BE(value, 0)
                    : signed
                    ? buf.writeInt16LE(value, 0)
                    : buf.writeUInt16LE(value, 0);
                break;

            case 4:
                bigEndian
                    ? signed
                        ? buf.writeInt32BE(value, 0)
                        : buf.writeUInt32BE(value, 0)
                    : signed
                    ? buf.writeInt32LE(value, 0)
                    : buf.writeUInt32LE(value, 0);
                break;

            default:
                if (signed && value < 0) {
                    // convert to unsigned byte sequence
                    value += 1 << (8 * length);
                }

                // use arithmetic instead of shift to cover more than 32 bits
                for (let i = 0; i < byteLength; ++i) {
                    const byte = value % 0x100;
                    value /= 0x100;
                    buf.writeInt8(byte, bigEndian ? byteLength - i - 1 : i);
                }
        }

        return buf;
    }

    private valueToNumber(
        value: unknown,
        options: {
            bitLength: number | undefined;
            byteLength: number | undefined;
            offset: number | undefined;
            bigEndian: boolean;
            byteSeq: string;
        }
    ): Buffer {
        if (typeof value !== "number") {
            throw new Error("Value is not a number");
        }

        const length = options.bitLength ?? (options.byteLength !== undefined ? options.byteLength * 8 : 32);
        const offset = options.offset ?? 0;
        const { bigEndian, byteSeq } = options;
        const byteLength = options.byteLength ?? Math.ceil((offset + length) / 8);
        const byteOffset = Math.floor(offset / 8);
        const buf = Buffer.alloc(byteLength);

        if (offset % 8 !== 0) {
            throw new Error("Offset must be a multiple of 8");
        }

        // Handle byte swapping
        if (byteSeq && byteLength > 1) {
            buf.swap16();
        }
        switch (length) {
            case 16:
                setFloat16(new DataView(buf.buffer), byteOffset, value, !bigEndian);
                break;
            case 32:
                bigEndian ? buf.writeFloatBE(value, byteOffset) : buf.writeFloatLE(value, 0);
                break;

            case 64:
                bigEndian ? buf.writeDoubleBE(value, byteOffset) : buf.writeDoubleLE(value, 0);
                break;

            default:
                throw new Error("Wrong buffer length for type 'number', must be 16, 32, or 64 is " + length);
        }

        return buf;
    }

    private valueToString(
        value: unknown,
        options: {
            bitLength: number | undefined;
            byteLength: number | undefined;
            offset: number | undefined;
            charset: string;
        }
    ): Buffer {
        if (typeof value !== "string") {
            throw new Error("Value is not a string");
        }

        const offset = options.offset ?? 0;
        const { charset } = options;

        const str = String(value);
        // Check if charset is BufferEncoding
        if (!Buffer.isEncoding(charset)) {
            throw new Error("Invalid charset " + charset);
        }

        const buf = Buffer.from(str, charset);
        const bitLength = options.bitLength ?? buf.length * 8;
        if (buf.length > bitLength) {
            throw new Error(`String is ${buf.length * 8} bits long, but 'ex:bitLength' is ${bitLength}`);
        }

        // write string to buffer at offset
        const byteLength = options.byteLength ?? Math.ceil((offset + bitLength) / 8);
        if (offset % 8 === 0) {
            return Buffer.concat([Buffer.alloc(byteLength - bitLength / 8), buf]);
        } else {
            const buffer = Buffer.alloc(byteLength);
            this.copyBits(buf, 0, buffer, offset, bitLength);
            return buffer;
        }
    }

    private valueToObject(
        value: { [key: string]: any }, // eslint-disable-line @typescript-eslint/no-explicit-any
        schema: DataSchema,
        parameters: { [key: string]: string | undefined } = {},
        result?: Buffer | undefined
    ): Buffer {
        if (typeof value !== "object" || value === null) {
            throw new Error("Value is not an object");
        }

        if (parameters.length === undefined) {
            throw new Error("Missing 'length' parameter necessary for write");
        }

        const length = parseInt(parameters.length);
        const offset = schema["ex:bitOffset"] !== undefined ? parseInt(schema["ex:bitOffset"]) : 0;

        if (isNaN(offset) || offset < 0) {
            throw new Error("'ex:bitOffset' must be a non-negative number");
        }

        if (offset > length * 8) {
            throw new Error(`'ex:bitOffset' ${offset} exceeds 'length' ${length}`);
        }

        result = result ?? Buffer.alloc(length);
        // TODO: Use correct type for propertySchema
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const [propertyName, propertySchema] of Object.entries(schema.properties) as [string, any]) {
            if (Object.hasOwnProperty.call(value, propertyName) === false) {
                throw new Error(`Missing property '${propertyName}'`);
            }
            const propertyValue = value[propertyName];
            const propertyOffset = parseInt(propertySchema["ex:bitOffset"]);
            const propertyLength = parseInt(propertySchema["ex:bitLength"]);
            let buf: Buffer;
            if (propertySchema.type === "object") {
                buf = this.valueToObject(propertyValue, propertySchema, parameters, result);
            } else {
                buf = this.valueToBytes(propertyValue, propertySchema, parameters);
            }
            this.copyBits(buf, propertyOffset, result, offset + propertyOffset, propertyLength);
        }
        return result;
    }

    private readBits(buffer: Buffer, bitOffset: number, bitLength: number) {
        if (bitOffset < 0) {
            throw new Error("bitOffset must be >= 0");
        }

        if (bitLength < 0) {
            throw new Error("bitLength must be >= 0");
        }

        if (bitOffset + bitLength > buffer.length * 8) {
            throw new Error("bitOffset + bitLength must be <= buffer.length * 8");
        }

        // Convert the result to a Buffer of the correct length.
        const resultBuffer = Buffer.alloc(Math.ceil(bitLength / 8));

        let byteOffset = Math.floor(bitOffset / 8);
        let bitOffsetInByte = bitOffset % 8;
        let targetByte = buffer[byteOffset];
        let result = 0;
        let resultOffset = 0;

        for (let i = 0; i < bitLength; i++) {
            const bit = (targetByte >> (7 - bitOffsetInByte)) & 0x01;
            result = (result << 1) | bit;
            bitOffsetInByte++;

            if (bitOffsetInByte > 7) {
                byteOffset++;
                bitOffsetInByte = 0;
                targetByte = buffer[byteOffset];
            }

            // Write full bytes.
            if (i + 1 === bitLength % 8 || (i + 1) % 8 === bitLength % 8 || i === bitLength - 1) {
                resultBuffer[resultOffset] = result;
                result = 0;
                resultOffset++;
            }
        }

        return resultBuffer;
    }

    private writeBits(buffer: Buffer, value: number, offsetBits: number, length: number, bigEndian: boolean) {
        let byteIndex = Math.floor(offsetBits / 8);
        let bitIndex = offsetBits % 8;

        for (let i = 0; i < length; i++) {
            const bitValue = bigEndian ? (value >> (length - 1 - i)) & 1 : (value >> i) & 1;
            buffer[byteIndex] |= bitValue << (bigEndian ? 7 - bitIndex : bitIndex);

            bitIndex++;
            if (bitIndex === 8) {
                bitIndex = 0;
                byteIndex++;
            }
        }
    }

    private copyBits(
        source: Buffer,
        sourceBitOffset: number,
        target: Buffer,
        targetBitOffset: number,
        bitLength: number
    ) {
        if (sourceBitOffset % 8 === 0 && targetBitOffset % 8 === 0 && bitLength % 8 === 0) {
            source.copy(target, targetBitOffset / 8, sourceBitOffset / 8, sourceBitOffset + bitLength / 8);
        } else {
            const bits = this.readBits(source, sourceBitOffset, bitLength);
            if (bits.length <= 6) {
                this.writeBits(target, bits.readUIntBE(0, bits.length), targetBitOffset, bitLength, true);
            } else {
                // iterate over bytes and write them to the buffer
                for (let i = 0; i < bits.length; i++) {
                    const byte = bits.readUInt8(i);
                    this.writeBits(target, byte, targetBitOffset + i * 8, 8, true);
                }
            }
        }
    }
}
