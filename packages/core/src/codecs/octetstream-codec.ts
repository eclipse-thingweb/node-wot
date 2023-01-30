/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
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

        const bigendian = !parameters.byteSeq?.includes(Endianness.LITTLE_ENDIAN); // default to big endian
        let signed = parameters.signed !== "false"; // default to signed

        // check length if specified
        if (parameters.length && parseInt(parameters.length) !== bytes.length) {
            throw new Error("Lengths do not match, required: " + parameters.length + " provided: " + bytes.length);
        }

        let dataLength = bytes.length;
        let dataType: string = schema ? schema.type : "undefined";

        // Check type specification
        // according paragraph 3.3.3 of https://datatracker.ietf.org/doc/rfc8927/
        // Parse type property only if this test passes
        if (/(short|(u)?int(8|16|32)?$|float(16|32|64)?|byte)/.test(dataType.toLowerCase())) {
            const typeSem = /(u)?(short|int|float|byte)(8|16|32|64)?/.exec(dataType.toLowerCase());
            if (typeSem) {
                signed = typeSem[1] === undefined;
                dataType = typeSem[2];
                dataLength = +typeSem[3] / 8 ?? bytes.length;
            }
        }

        // Handle byte swapping
        if (parameters.byteSeq?.includes("BYTE_SWAP") && dataLength > 1) {
            bytes.swap16();
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
                return this.integerToValue(bytes, { dataLength, bigendian, signed });
            case "float":
            case "double":
            case "number":
                return this.numberToValue(bytes, { dataLength, bigendian });
            case "string":
                return bytes.toString(parameters.charset as BufferEncoding);
            case "array":
            case "object":
                throw new Error("Unable to handle dataType " + dataType);
            case "null":
                return null;
            default:
                throw new Error("Unable to handle dataType " + dataType);
        }
    }

    private integerToValue(
        bytes: Buffer,
        options: { dataLength: number; bigendian: boolean; signed: boolean }
    ): number {
        const { dataLength, bigendian, signed } = options;
        switch (dataLength) {
            case 1:
                return signed ? bytes.readInt8(0) : bytes.readUInt8(0);
            case 2:
                return bigendian
                    ? signed
                        ? bytes.readInt16BE(0)
                        : bytes.readUInt16BE(0)
                    : signed
                    ? bytes.readInt16LE(0)
                    : bytes.readUInt16LE(0);

            case 4:
                return bigendian
                    ? signed
                        ? bytes.readInt32BE(0)
                        : bytes.readUInt32BE(0)
                    : signed
                    ? bytes.readInt32LE(0)
                    : bytes.readUInt32LE(0);

            default: {
                let result = 0;
                let negative;

                if (bigendian) {
                    result = bytes.reduce((prev, curr) => prev << (8 + curr));
                    negative = bytes.readInt8(0) < 0;
                } else {
                    result = bytes.reduceRight((prev, curr) => prev << (8 + curr));
                    negative = bytes.readInt8(dataLength - 1) < 0;
                }

                if (signed && negative) {
                    result -= 1 << (8 * dataLength);
                }

                // warn about numbers being too big to be represented as safe integers
                if (!Number.isSafeInteger(result)) {
                    warn("Result is not a safe integer");
                }

                return result;
            }
        }
    }

    private numberToValue(bytes: Buffer, options: { dataLength: number; bigendian: boolean }): number {
        const { dataLength, bigendian } = options;
        switch (dataLength) {
            case 2:
                return getFloat16(new DataView(bytes.buffer), bytes.byteOffset, !bigendian);
            case 4:
                return bigendian ? bytes.readFloatBE(0) : bytes.readFloatLE(0);

            case 8:
                return bigendian ? bytes.readDoubleBE(0) : bytes.readDoubleLE(0);

            default:
                throw new Error("Wrong buffer length for type 'number', must be 2, 4, 8, or is " + dataLength);
        }
    }

    valueToBytes(value: unknown, schema?: DataSchema, parameters: { [key: string]: string | undefined } = {}): Buffer {
        debug(`OctetstreamCodec serializing '${value}'`);

        if (!parameters.length) {
            warn("Missing 'length' parameter necessary for write. I'll do my best");
        }

        const bigendian = !parameters.byteSeq?.includes(Endianness.LITTLE_ENDIAN); // default to bigendian
        let signed = parameters.signed !== "false"; // if signed is undefined -> true (default)
        let length = parameters.length ? parseInt(parameters.length) : undefined;

        if (value === undefined) {
            throw new Error("Undefined value");
        }

        let dataType: string = schema ? schema.type : "undefined";

        // Check type specification
        // according paragraph 3.3.3 of https://datatracker.ietf.org/doc/rfc8927/
        // Parse type property only if this test passes
        if (/(short|(u)?int(8|16|32)?$|float(16|32|64)?|byte)/.test(dataType.toLowerCase())) {
            const typeSem = /(u)?(short|int|float|byte)(8|16|32|64)?/.exec(dataType.toLowerCase());
            if (typeSem) {
                signed = typeSem[1] === undefined;
                dataType = typeSem[2];
                length = +typeSem[3] / 8 ?? length;
            }
        }

        switch (dataType) {
            case "boolean":
                return Buffer.alloc(length ?? 1, value ? 255 : 0);
            case "byte":
            case "short":
            case "int":
            case "integer":
                return this.valueToInteger(value, {
                    dataLength: length,
                    bigendian,
                    signed,
                    byteSeq: parameters.byteSeq ?? "",
                });
            case "float":
            case "number":
                return this.valueToNumber(value, { dataLength: length, bigendian, byteSeq: parameters.byteSeq ?? "" });
            case "string": {
                const str = String(value);
                return Buffer.from(str /*, params.charset */);
            }
            case "array":
            case "object":
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
        options: { dataLength: number | undefined; bigendian: boolean; signed: boolean; byteSeq: string }
    ): Buffer {
        const length = options.dataLength ?? 4;
        const { bigendian, signed, byteSeq } = options;

        if (typeof value !== "number") {
            throw new Error("Value is not a number");
        }

        // warn about numbers being too big to be represented as safe integers
        if (!Number.isSafeInteger(value)) {
            warn("Value is not a safe integer", value);
        }
        const limit = Math.pow(2, 8 * length) - 1;
        // throw error on overflow
        if (signed) {
            if (value < -limit || value >= limit) {
                throw new Error("Integer overflow when representing signed " + value + " in " + length + " byte(s)");
            }
        } else {
            if (value < 0 || value >= limit) {
                throw new Error("Integer overflow when representing unsigned " + value + " in " + length + " byte(s)");
            }
        }

        const buf = Buffer.alloc(length);
        // Handle byte swapping
        if (byteSeq?.includes("BYTE_SwAP") && length > 1) {
            buf.swap16();
        }
        switch (length) {
            case 1:
                signed ? buf.writeInt8(value, 0) : buf.writeUInt8(value, 0);
                break;

            case 2:
                bigendian
                    ? signed
                        ? buf.writeInt16BE(value, 0)
                        : buf.writeUInt16BE(value, 0)
                    : signed
                    ? buf.writeInt16LE(value, 0)
                    : buf.writeUInt16LE(value, 0);
                break;

            case 4:
                bigendian
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
                for (let i = 0; i < length; ++i) {
                    const byte = value % 0x100;
                    value /= 0x100;
                    buf.writeInt8(byte, bigendian ? length - i - 1 : i);
                }
        }

        return buf;
    }

    private valueToNumber(
        value: unknown,
        options: { dataLength: number | undefined; bigendian: boolean; byteSeq: string }
    ): Buffer {
        if (typeof value !== "number") {
            throw new Error("Value is not a number");
        }

        const length = options.dataLength ?? 8;
        const { bigendian, byteSeq } = options;
        const buf = Buffer.alloc(length);

        // Handle byte swapping
        if (byteSeq && length > 1) {
            buf.swap16();
        }
        switch (length) {
            case 2:
                setFloat16(new DataView(buf.buffer), 0, value, !bigendian);
                break;
            case 4:
                bigendian ? buf.writeFloatBE(value, 0) : buf.writeFloatLE(value, 0);
                break;

            case 8:
                bigendian ? buf.writeDoubleBE(value, 0) : buf.writeDoubleLE(value, 0);
                break;

            default:
                throw new Error("Wrong buffer length for type 'number', must be 4 or 8, is " + length);
        }

        return buf;
    }
}
