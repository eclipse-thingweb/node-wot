/********************************************************************************
 * Copyright (c) 2026 Contributors to the Eclipse Foundation
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
import { EipFieldDefinition, EipForm, EipPrimitiveType, EipStructureDefinition } from "./eip-form";

/** Describes how the bytes of a tag transfer map to an application-facing value. */
export interface EipValueLayout {
    type?: EipPrimitiveType;
    structure?: EipStructureDefinition;
    dimensions?: number[];
    elementCount?: number;
    scale?: number;
    offset?: number;
}

interface IntegerSpec {
    bytes: number;
    signed: boolean;
}

const INTEGERS: Partial<Record<EipPrimitiveType, IntegerSpec>> = {
    "eipv:SINT": { bytes: 1, signed: true },
    "eipv:INT": { bytes: 2, signed: true },
    "eipv:DINT": { bytes: 4, signed: true },
    "eipv:LINT": { bytes: 8, signed: true },
    "eipv:USINT": { bytes: 1, signed: false },
    "eipv:UINT": { bytes: 2, signed: false },
    "eipv:UDINT": { bytes: 4, signed: false },
    "eipv:ULINT": { bytes: 8, signed: false },
    "eipv:BYTE": { bytes: 1, signed: false },
    "eipv:WORD": { bytes: 2, signed: false },
    "eipv:DWORD": { bytes: 4, signed: false },
    "eipv:LWORD": { bytes: 8, signed: false },
};

// Predefined Logix STRING: DINT LEN, 82 SINT DATA, two bytes of padding.
const STRING_DATA_LENGTH = 82;

export const PRIMITIVE_SIZE: Record<EipPrimitiveType, number> = {
    "eipv:BOOL": 1,
    "eipv:SINT": 1,
    "eipv:INT": 2,
    "eipv:DINT": 4,
    "eipv:LINT": 8,
    "eipv:USINT": 1,
    "eipv:UINT": 2,
    "eipv:UDINT": 4,
    "eipv:ULINT": 8,
    "eipv:REAL": 4,
    "eipv:LREAL": 8,
    "eipv:BYTE": 1,
    "eipv:WORD": 2,
    "eipv:DWORD": 4,
    "eipv:LWORD": 8,
    "eipv:STRING": 88,
};

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function product(dimensions: number[]): number {
    return dimensions.reduce((a, b) => a * b, 1);
}

/** Size of one instance of a structure: the declared byteSize, else the end of its last field. */
export function structureSize(structure: EipStructureDefinition): number {
    const declared = structure["eipv:byteSize"];
    if (declared !== undefined) return declared;
    return structure["eipv:fields"].reduce((end, field) => {
        const nested = field["eipv:structureDefinition"];
        const size =
            nested !== undefined ? structureSize(nested) : PRIMITIVE_SIZE[field["eipv:type"] as EipPrimitiveType];
        const dimensions = field["eipv:dimensions"];
        const count = dimensions === undefined ? 1 : product(dimensions);
        return Math.max(end, field["eipv:byteOffset"] + count * size);
    }, 0);
}

function fieldElementSize(field: EipFieldDefinition): number {
    const nested = field["eipv:structureDefinition"];
    if (nested !== undefined) return structureSize(nested);
    return PRIMITIVE_SIZE[field["eipv:type"] as EipPrimitiveType];
}

export function elementSize(layout: EipValueLayout): number {
    if (layout.structure !== undefined) return structureSize(layout.structure);
    if (layout.type !== undefined) return PRIMITIVE_SIZE[layout.type];
    throw new Error("Layout needs either a type or a structure definition");
}

export function elementCount(layout: EipValueLayout): number {
    if (layout.dimensions === undefined) return 1;
    return layout.elementCount ?? product(layout.dimensions);
}

export function byteLength(layout: EipValueLayout): number {
    return elementSize(layout) * elementCount(layout);
}

export function layoutFromForm(form: EipForm): EipValueLayout {
    return {
        type: form["eipv:type"],
        structure: form["eipv:structureDefinition"],
        dimensions: form["eipv:dimensions"],
        elementCount: form["eipv:elementCount"],
        scale: form["eipv:scale"],
        offset: form["eipv:offset"],
    };
}

function readInteger(buf: Buffer, offset: number, spec: IntegerSpec, type: EipPrimitiveType): number {
    switch (spec.bytes) {
        case 1:
            return spec.signed ? buf.readInt8(offset) : buf.readUInt8(offset);
        case 2:
            return spec.signed ? buf.readInt16LE(offset) : buf.readUInt16LE(offset);
        case 4:
            return spec.signed ? buf.readInt32LE(offset) : buf.readUInt32LE(offset);
        default: {
            const value = spec.signed ? buf.readBigInt64LE(offset) : buf.readBigUInt64LE(offset);
            if (value > MAX_SAFE || value < -MAX_SAFE) {
                throw new RangeError(`${type} value ${value} cannot be represented exactly as a JavaScript number`);
            }
            return Number(value);
        }
    }
}

function writeInteger(buf: Buffer, offset: number, spec: IntegerSpec, value: unknown, type: EipPrimitiveType): void {
    if (typeof value !== "number") throw new TypeError(`${type} requires a number, got ${typeof value}`);
    if (!Number.isInteger(value)) throw new RangeError(`${type} requires an integer, got ${value}`);
    if (spec.bytes === 8) {
        if (!Number.isSafeInteger(value) || (!spec.signed && value < 0)) {
            throw new RangeError(`${type} value ${value} is outside the supported range`);
        }
        if (spec.signed) buf.writeBigInt64LE(BigInt(value), offset);
        else buf.writeBigUInt64LE(BigInt(value), offset);
        return;
    }
    const bits = spec.bytes * 8;
    const min = spec.signed ? -(2 ** (bits - 1)) : 0;
    const max = spec.signed ? 2 ** (bits - 1) - 1 : 2 ** bits - 1;
    if (value < min || value > max) throw new RangeError(`${type} value ${value} is outside ${min}..${max}`);
    switch (spec.bytes) {
        case 1:
            if (spec.signed) buf.writeInt8(value, offset);
            else buf.writeUInt8(value, offset);
            break;
        case 2:
            if (spec.signed) buf.writeInt16LE(value, offset);
            else buf.writeUInt16LE(value, offset);
            break;
        default:
            if (spec.signed) buf.writeInt32LE(value, offset);
            else buf.writeUInt32LE(value, offset);
    }
}

function readPrimitive(
    type: EipPrimitiveType,
    buf: Buffer,
    offset: number,
    bitOffset?: number
): number | boolean | string {
    if (type === "eipv:BOOL") {
        const byte = buf.readUInt8(offset);
        return ((byte >> (bitOffset ?? 0)) & 1) === 1;
    }
    if (type === "eipv:REAL") return buf.readFloatLE(offset);
    if (type === "eipv:LREAL") return buf.readDoubleLE(offset);
    if (type === "eipv:STRING") {
        const length = buf.readInt32LE(offset);
        if (length < 0 || length > STRING_DATA_LENGTH) {
            throw new RangeError(`STRING LEN ${length} is outside 0..${STRING_DATA_LENGTH}`);
        }
        return buf.toString("latin1", offset + 4, offset + 4 + length);
    }
    const spec = INTEGERS[type];
    if (spec === undefined) throw new Error(`Unsupported EtherNet/IP type '${type}'`);
    return readInteger(buf, offset, spec, type);
}

function writePrimitive(type: EipPrimitiveType, buf: Buffer, offset: number, value: unknown, bitOffset?: number): void {
    if (type === "eipv:BOOL") {
        if (typeof value !== "boolean") throw new TypeError(`BOOL requires a boolean, got ${typeof value}`);
        const mask = 1 << (bitOffset ?? 0);
        const byte = buf.readUInt8(offset);
        buf.writeUInt8(value ? byte | mask : byte & ~mask & 0xff, offset);
    } else if (type === "eipv:REAL" || type === "eipv:LREAL") {
        if (typeof value !== "number") throw new TypeError(`${type} requires a number, got ${typeof value}`);
        if (type === "eipv:REAL") buf.writeFloatLE(value, offset);
        else buf.writeDoubleLE(value, offset);
    } else if (type === "eipv:STRING") {
        if (typeof value !== "string") throw new TypeError(`STRING requires a string, got ${typeof value}`);
        if (value.length > STRING_DATA_LENGTH || Array.from(value).some((c) => c.charCodeAt(0) > 0xff)) {
            throw new RangeError(`STRING supports at most ${STRING_DATA_LENGTH} single-byte characters`);
        }
        buf.fill(0, offset + 4, offset + PRIMITIVE_SIZE[type]);
        buf.writeInt32LE(value.length, offset);
        buf.write(value, offset + 4, "latin1");
    } else {
        const spec = INTEGERS[type];
        if (spec === undefined) throw new Error(`Unsupported EtherNet/IP type '${type}'`);
        writeInteger(buf, offset, spec, value, type);
    }
}

function decodeStructure(structure: EipStructureDefinition, buf: Buffer, base: number): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const field of structure["eipv:fields"]) {
        const nested = field["eipv:structureDefinition"];
        const decodeAt = (at: number): unknown =>
            nested !== undefined
                ? decodeStructure(nested, buf, at)
                : readPrimitive(field["eipv:type"] as EipPrimitiveType, buf, at, field["eipv:bitOffset"]);
        const offset = base + field["eipv:byteOffset"];
        const dimensions = field["eipv:dimensions"];
        if (dimensions === undefined) {
            result[field["eipv:name"]] = decodeAt(offset);
        } else {
            const size = fieldElementSize(field);
            result[field["eipv:name"]] = Array.from({ length: product(dimensions) }, (_, i) =>
                decodeAt(offset + i * size)
            );
        }
    }
    return result;
}

function encodeStructure(structure: EipStructureDefinition, buf: Buffer, base: number, value: unknown): void {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new TypeError(`Structure ${structure["eipv:typeName"]} requires an object`);
    }
    const record = value as Record<string, unknown>;
    const names = structure["eipv:fields"].map((field) => field["eipv:name"]);
    for (const key of Object.keys(record)) {
        if (!names.includes(key)) {
            throw new RangeError(`Unknown field '${key}' for structure ${structure["eipv:typeName"]}`);
        }
    }
    for (const field of structure["eipv:fields"]) {
        const name = field["eipv:name"];
        if (!(name in record)) {
            throw new RangeError(`Missing field '${name}' for structure ${structure["eipv:typeName"]}`);
        }
        const nested = field["eipv:structureDefinition"];
        const encodeAt = (at: number, item: unknown): void => {
            if (nested !== undefined) encodeStructure(nested, buf, at, item);
            else writePrimitive(field["eipv:type"] as EipPrimitiveType, buf, at, item, field["eipv:bitOffset"]);
        };
        const offset = base + field["eipv:byteOffset"];
        const dimensions = field["eipv:dimensions"];
        if (dimensions === undefined) {
            encodeAt(offset, record[name]);
        } else {
            const count = product(dimensions);
            const items = record[name];
            if (!Array.isArray(items) || items.length !== count) {
                throw new RangeError(`Field '${name}' requires an array of ${count} elements`);
            }
            const size = fieldElementSize(field);
            items.forEach((item, i) => encodeAt(offset + i * size, item));
        }
    }
}

function hasConversion(layout: EipValueLayout): boolean {
    return layout.scale !== undefined || layout.offset !== undefined;
}

function decodeElement(layout: EipValueLayout, buf: Buffer, offset: number): unknown {
    if (layout.structure !== undefined) return decodeStructure(layout.structure, buf, offset);
    const type = layout.type as EipPrimitiveType;
    const raw = readPrimitive(type, buf, offset);
    if (typeof raw === "number" && hasConversion(layout)) return raw * (layout.scale ?? 1) + (layout.offset ?? 0);
    return raw;
}

function encodeElement(layout: EipValueLayout, buf: Buffer, offset: number, value: unknown): void {
    if (layout.structure !== undefined) {
        encodeStructure(layout.structure, buf, offset, value);
        return;
    }
    const type = layout.type as EipPrimitiveType;
    if (typeof value === "number" && hasConversion(layout)) {
        const raw = (value - (layout.offset ?? 0)) / (layout.scale ?? 1);
        writePrimitive(type, buf, offset, INTEGERS[type] !== undefined ? Math.round(raw) : raw);
    } else {
        writePrimitive(type, buf, offset, value);
    }
}

/** Decodes the data bytes of a tag read (without the CIP type header) into a JSON-compatible value. */
export function decodeValue(layout: EipValueLayout, buffer: Buffer): unknown {
    const length = byteLength(layout);
    if (buffer.length < length) {
        throw new RangeError(`Expected at least ${length} bytes, got ${buffer.length}`);
    }
    if (layout.dimensions === undefined) return decodeElement(layout, buffer, 0);
    const size = elementSize(layout);
    return Array.from({ length: elementCount(layout) }, (_, i) => decodeElement(layout, buffer, i * size));
}

/**
 * Encodes a value into the data bytes of a tag write. When `existing` holds the current bytes of the
 * written range, bytes that no field covers, such as padding, are preserved.
 */
export function encodeValue(layout: EipValueLayout, value: unknown, existing?: Buffer): Buffer {
    const length = byteLength(layout);
    if (existing !== undefined && existing.length !== length) {
        throw new RangeError(`Existing data has ${existing.length} bytes, expected ${length}`);
    }
    const out = existing !== undefined ? Buffer.from(existing) : Buffer.alloc(length);
    if (layout.dimensions === undefined) {
        encodeElement(layout, out, 0, value);
        return out;
    }
    const count = elementCount(layout);
    if (!Array.isArray(value)) throw new TypeError(`Array of ${count} elements required`);
    if (value.length !== count) throw new RangeError(`Expected ${count} elements, got ${value.length}`);
    const size = elementSize(layout);
    value.forEach((item, i) => encodeElement(layout, out, i * size, item));
    return out;
}
