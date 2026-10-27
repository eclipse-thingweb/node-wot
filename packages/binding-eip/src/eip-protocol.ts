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
import { EipPrimitiveType } from "./eip-form";

/** Pure encoders and decoders for EtherNet/IP encapsulation and the CIP tag services of Logix controllers. */

export const SERVICE = {
    ReadTag: 0x4c,
    WriteTag: 0x4d,
    ReadTagFragmented: 0x52,
    WriteTagFragmented: 0x53,
    UnconnectedSend: 0x52,
} as const;

export const COMMAND = {
    RegisterSession: 0x65,
    UnRegisterSession: 0x66,
    SendRRData: 0x6f,
} as const;

export const STRUCTURE_TYPE_CODE = 0x02a0;
const ENCAPSULATION_HEADER_LENGTH = 24;
const UNCONNECTED_DATA_ITEM = 0x00b2;

const TYPE_CODES: Record<Exclude<EipPrimitiveType, "eipv:STRING">, number> = {
    "eipv:BOOL": 0xc1,
    "eipv:SINT": 0xc2,
    "eipv:INT": 0xc3,
    "eipv:DINT": 0xc4,
    "eipv:LINT": 0xc5,
    "eipv:USINT": 0xc6,
    "eipv:UINT": 0xc7,
    "eipv:UDINT": 0xc8,
    "eipv:ULINT": 0xc9,
    "eipv:REAL": 0xca,
    "eipv:LREAL": 0xcb,
    "eipv:BYTE": 0xd1,
    "eipv:WORD": 0xd2,
    "eipv:DWORD": 0xd3,
    "eipv:LWORD": 0xd4,
};

const GENERAL_STATUS: Record<number, string> = {
    0x01: "connection failure",
    0x04: "path segment error, the tag does not exist or its path is invalid",
    0x05: "path destination unknown",
    0x06: "partial transfer",
    0x08: "service not supported",
    0x09: "invalid attribute value",
    0x0f: "permission denied",
    0x10: "device state conflict",
    0x13: "not enough data",
    0x15: "too much data",
    0x26: "path size invalid",
    0xff: "general error",
};

export class EipError extends Error {
    constructor(
        message: string,
        public readonly generalStatus?: number,
        public readonly extendedStatus: number[] = []
    ) {
        super(message);
        this.name = "EipError";
    }
}

function u16(value: number): Buffer {
    const buf = Buffer.alloc(2);
    buf.writeUInt16LE(value);
    return buf;
}

function u32(value: number): Buffer {
    const buf = Buffer.alloc(4);
    buf.writeUInt32LE(value);
    return buf;
}

function hex(value: number, width: number): string {
    return `0x${value.toString(16).padStart(width, "0")}`;
}

function malformedTagPath(tagPath: string): Error {
    return new Error(`Malformed tag path '${tagPath}'`);
}

const SEGMENT = /^([A-Za-z_][A-Za-z0-9_:]*)(?:\[(\d+(?:,\d+){0,2})\])?$/;

function symbolSegment(name: string): Buffer {
    const text = Buffer.from(name, "latin1");
    return Buffer.concat([Buffer.from([0x91, text.length]), text, Buffer.alloc(text.length % 2)]);
}

function indexSegment(index: number): Buffer {
    if (index <= 0xff) return Buffer.from([0x28, index]);
    if (index <= 0xffff) return Buffer.concat([Buffer.from([0x29, 0x00]), u16(index)]);
    return Buffer.concat([Buffer.from([0x2a, 0x00]), u32(index)]);
}

/** Encodes a symbolic tag expression such as `Program:Main.Recipe[3].SetPoint` as ANSI extended symbol segments. */
export function encodeTagPath(tagPath: string): Buffer {
    const parts: Buffer[] = [];
    const members = tagPath.split(".");
    members.forEach((member, i) => {
        if (i > 0 && /^\d+$/.test(member)) {
            throw new Error(`Unsupported bit access in tag path '${tagPath}'`);
        }
        const match = SEGMENT.exec(member);
        if (match === null) throw malformedTagPath(tagPath);
        parts.push(symbolSegment(match[1]));
        if (match[2] !== undefined) {
            for (const index of match[2].split(",")) parts.push(indexSegment(parseInt(index, 10)));
        }
    });
    return Buffer.concat(parts);
}

/** Encodes port/address pairs as CIP port segments; IP addresses use the extended link address form. */
export function encodeRoutePath(route: string[]): Buffer {
    const parts: Buffer[] = [];
    for (let i = 0; i < route.length; i += 2) {
        const port = parseInt(route[i], 10);
        if (!(port >= 1 && port <= 14)) {
            throw new Error(`Route port ${route[i]} is not supported, only ports 1 to 14 are`);
        }
        const address = route[i + 1];
        if (/^\d+$/.test(address)) {
            parts.push(Buffer.from([port, parseInt(address, 10)]));
        } else {
            const text = Buffer.from(address, "latin1");
            parts.push(Buffer.from([0x10 | port, text.length]), text, Buffer.alloc(text.length % 2));
        }
    }
    return Buffer.concat(parts);
}

export function encodeCipRequest(service: number, path: Buffer, data: Buffer = Buffer.alloc(0)): Buffer {
    return Buffer.concat([Buffer.from([service, path.length / 2]), path, data]);
}

export function encodeReadTag(path: Buffer, elements: number): Buffer {
    return encodeCipRequest(SERVICE.ReadTag, path, u16(elements));
}

export function encodeReadTagFragmented(path: Buffer, elements: number, byteOffset: number): Buffer {
    return encodeCipRequest(SERVICE.ReadTagFragmented, path, Buffer.concat([u16(elements), u32(byteOffset)]));
}

/** CIP type code a controller reports for a tag of the given type; STRING is a structure. */
export function typeCodeOf(type: EipPrimitiveType): number {
    return type === "eipv:STRING" ? STRUCTURE_TYPE_CODE : TYPE_CODES[type];
}

/**
 * Type header of a Write Tag request: the CIP type code of an atomic type, or the structure
 * marker plus structure handle (obtained from a read) for structures and STRING.
 */
export function tagTypeHeader(type: EipPrimitiveType | undefined, structureHandle?: number): Buffer {
    if (type === undefined || type === "eipv:STRING") {
        if (structureHandle === undefined) throw new Error("Writing a structure requires its structure handle");
        return Buffer.concat([u16(STRUCTURE_TYPE_CODE), u16(structureHandle)]);
    }
    return u16(TYPE_CODES[type]);
}

export function encodeWriteTag(path: Buffer, typeHeader: Buffer, elements: number, data: Buffer): Buffer {
    return encodeCipRequest(SERVICE.WriteTag, path, Buffer.concat([typeHeader, u16(elements), data]));
}

export function encodeWriteTagFragmented(
    path: Buffer,
    typeHeader: Buffer,
    elements: number,
    byteOffset: number,
    data: Buffer
): Buffer {
    return encodeCipRequest(
        SERVICE.WriteTagFragmented,
        path,
        Buffer.concat([typeHeader, u16(elements), u32(byteOffset), data])
    );
}

/** Wraps a request for the Connection Manager so that a module routes it to the target in `routePath`. */
export function encodeUnconnectedSend(request: Buffer, routePath: Buffer): Buffer {
    return Buffer.concat([
        Buffer.from([SERVICE.UnconnectedSend, 0x02, 0x20, 0x06, 0x24, 0x01, 0x05, 0xf9]),
        u16(request.length),
        request,
        Buffer.alloc(request.length % 2),
        Buffer.from([routePath.length / 2, 0]),
        routePath,
    ]);
}

export interface CipReply {
    service: number;
    status: number;
    extendedStatus: number[];
    data: Buffer;
}

export function parseCipReply(buf: Buffer): CipReply {
    if (buf.length < 4) throw new EipError("CIP reply too short");
    const extendedWords = buf.readUInt8(3);
    const dataStart = 4 + extendedWords * 2;
    if (buf.length < dataStart) throw new EipError("CIP reply too short for its extended status");
    const extendedStatus: number[] = [];
    for (let i = 0; i < extendedWords; i++) extendedStatus.push(buf.readUInt16LE(4 + i * 2));
    return { service: buf.readUInt8(0), status: buf.readUInt8(2), extendedStatus, data: buf.subarray(dataStart) };
}

export function assertCipSuccess(reply: CipReply, allowPartial = false, context = "CIP request"): void {
    if (reply.status === 0 || (allowPartial && reply.status === 0x06)) return;
    const description = GENERAL_STATUS[reply.status] ?? "unknown status";
    const extended = reply.extendedStatus.map((s) => ` extended status ${hex(s, 4)}`).join(",");
    throw new EipError(
        `${context} failed: ${description} (general status ${hex(reply.status, 2)}${extended})`,
        reply.status,
        reply.extendedStatus
    );
}

export interface TagData {
    typeCode: number;
    structureHandle: number | undefined;
    value: Buffer;
}

/** Splits the data of a Read Tag reply into the CIP type, an optional structure handle and the value bytes. */
export function parseTagData(data: Buffer): TagData {
    if (data.length < 2) throw new EipError("Tag data too short for a type code");
    const typeCode = data.readUInt16LE(0);
    if (typeCode !== STRUCTURE_TYPE_CODE) return { typeCode, structureHandle: undefined, value: data.subarray(2) };
    if (data.length < 4) throw new EipError("Tag data too short for a structure handle");
    return { typeCode, structureHandle: data.readUInt16LE(2), value: data.subarray(4) };
}

export function encodeEncapsulation(command: number, sessionHandle: number, context: Buffer, data: Buffer): Buffer {
    return Buffer.concat([u16(command), u16(data.length), u32(sessionHandle), u32(0), context, u32(0), data]);
}

export function encodeSendRRData(cip: Buffer): Buffer {
    return Buffer.concat([Buffer.alloc(6), u16(2), u16(0), u16(0), u16(UNCONNECTED_DATA_ITEM), u16(cip.length), cip]);
}

export function decodeSendRRData(payload: Buffer): Buffer {
    if (payload.length >= 8) {
        const count = payload.readUInt16LE(6);
        let offset = 8;
        for (let i = 0; i < count && offset + 4 <= payload.length; i++) {
            const type = payload.readUInt16LE(offset);
            const length = payload.readUInt16LE(offset + 2);
            if (offset + 4 + length > payload.length) break;
            if (type === UNCONNECTED_DATA_ITEM) return payload.subarray(offset + 4, offset + 4 + length);
            offset += 4 + length;
        }
    }
    throw new EipError("SendRRData reply has no unconnected data item");
}

export interface EncapsulationFrame {
    command: number;
    sessionHandle: number;
    status: number;
    senderContext: Buffer;
    data: Buffer;
}

/** Reassembles encapsulation frames from the chunks of a TCP stream. */
export class EncapsulationDecoder {
    private pending: Buffer = Buffer.alloc(0);

    push(chunk: Buffer): EncapsulationFrame[] {
        this.pending = Buffer.concat([this.pending, chunk]);
        const frames: EncapsulationFrame[] = [];
        while (this.pending.length >= ENCAPSULATION_HEADER_LENGTH) {
            const total = ENCAPSULATION_HEADER_LENGTH + this.pending.readUInt16LE(2);
            if (this.pending.length < total) break;
            frames.push({
                command: this.pending.readUInt16LE(0),
                sessionHandle: this.pending.readUInt32LE(4),
                status: this.pending.readUInt32LE(8),
                senderContext: Buffer.from(this.pending.subarray(12, 20)),
                data: Buffer.from(this.pending.subarray(ENCAPSULATION_HEADER_LENGTH, total)),
            });
            this.pending = this.pending.subarray(total);
        }
        return frames;
    }
}
