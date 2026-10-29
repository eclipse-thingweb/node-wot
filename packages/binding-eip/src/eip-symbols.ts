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
import { EipError, encodeCipRequest } from "./eip-protocol";

/** Pure encoders and decoders for the CIP objects a browse reads: the Logix symbol list, UDT templates and the identity. */

export const CLASS = {
    Identity: 0x01,
    Symbol: 0x6b,
    Template: 0x6c,
} as const;

export const META_SERVICE = {
    GetAttributesAll: 0x01,
    GetAttributeList: 0x03,
    ReadTemplate: 0x4c,
    GetInstanceAttributeList: 0x55,
} as const;

/** Attribute ids of the Symbol Object that a tag list asks for, in reply order. */
const SYMBOL_NAME = 1;
const SYMBOL_TYPE = 2;
const SYMBOL_ELEMENT_LENGTH = 7;
const SYMBOL_DIMENSIONS = 8;
const SYMBOL_EXTERNAL_ACCESS = 10;

const TYPE_STRUCTURE = 0x8000;
const TYPE_SYSTEM = 0x1000;
const TYPE_ARRAY_DIMENSIONS = 0x6000;
const TYPE_ARRAY_MEMBER = 0x2000;
const TYPE_TEMPLATE_ID = 0x0fff;

const TEMPLATE_MEMBER_LENGTH = 8;
// Template ids from 0x100 to 0xEFF are user-defined; the rest are predefined types such as TIMER and STRING.
const FIRST_USER_TEMPLATE = 0x100;
const LAST_USER_TEMPLATE = 0xeff;

const CIP_TYPES: Record<number, EipPrimitiveType> = {
    0xc1: "eipv:BOOL",
    0xc2: "eipv:SINT",
    0xc3: "eipv:INT",
    0xc4: "eipv:DINT",
    0xc5: "eipv:LINT",
    0xc6: "eipv:USINT",
    0xc7: "eipv:UINT",
    0xc8: "eipv:UDINT",
    0xc9: "eipv:ULINT",
    0xca: "eipv:REAL",
    0xcb: "eipv:LREAL",
    0xd1: "eipv:BYTE",
    0xd2: "eipv:WORD",
    0xd3: "eipv:DWORD",
    0xd4: "eipv:LWORD",
};

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

function malformed(what: string): EipError {
    return new EipError(`Malformed ${what} reply`);
}

/** Path to an object instance, for example class 0x6B instance 0 for the start of the symbol list. */
export function classInstancePath(classId: number, instance: number): Buffer {
    if (instance > 0xffff) throw new RangeError(`Instance ${instance} is not supported, only 16-bit instances are`);
    const classSegment =
        classId <= 0xff ? Buffer.from([0x20, classId]) : Buffer.concat([Buffer.from([0x21, 0]), u16(classId)]);
    const instanceSegment =
        instance <= 0xff ? Buffer.from([0x24, instance]) : Buffer.concat([Buffer.from([0x25, 0]), u16(instance)]);
    return Buffer.concat([classSegment, instanceSegment]);
}

export interface SymbolEntry {
    instance: number;
    name: string;
    /** Symbol type word, see {@link isStructureType} and {@link symbolDimensionCount}. */
    type: number;
    elementLength: number;
    dimensions: [number, number, number];
    /** 0 read/write, 2 read only, 3 none. Absent when the controller does not report it. */
    externalAccess?: number;
}

export const EXTERNAL_ACCESS_READ_ONLY = 2;
export const EXTERNAL_ACCESS_NONE = 3;

/** Get Instance Attribute List request for the symbol list, starting at `startInstance`. */
export function encodeSymbolListRequest(startInstance: number, withExternalAccess: boolean): Buffer {
    const attributes = [SYMBOL_NAME, SYMBOL_TYPE, SYMBOL_ELEMENT_LENGTH, SYMBOL_DIMENSIONS];
    if (withExternalAccess) attributes.push(SYMBOL_EXTERNAL_ACCESS);
    return encodeCipRequest(
        META_SERVICE.GetInstanceAttributeList,
        classInstancePath(CLASS.Symbol, startInstance),
        Buffer.concat([u16(attributes.length), ...attributes.map(u16)])
    );
}

export function parseSymbolEntries(data: Buffer, withExternalAccess: boolean): SymbolEntry[] {
    const entries: SymbolEntry[] = [];
    let offset = 0;
    const fixed = 2 + 2 + 12 + (withExternalAccess ? 1 : 0);
    while (offset < data.length) {
        if (offset + 6 > data.length) throw malformed("symbol list");
        const instance = data.readUInt32LE(offset);
        const nameLength = data.readUInt16LE(offset + 4);
        offset += 6;
        if (offset + nameLength + fixed > data.length) throw malformed("symbol list");
        const name = data.toString("latin1", offset, offset + nameLength);
        offset += nameLength;
        const entry: SymbolEntry = {
            instance,
            name,
            type: data.readUInt16LE(offset),
            elementLength: data.readUInt16LE(offset + 2),
            dimensions: [data.readUInt32LE(offset + 4), data.readUInt32LE(offset + 8), data.readUInt32LE(offset + 12)],
        };
        offset += 16;
        if (withExternalAccess) entry.externalAccess = data.readUInt8(offset++);
        entries.push(entry);
    }
    return entries;
}

/** A structure that is a user or predefined type, as opposed to a system object such as a program or task. */
export function isStructureType(type: number): boolean {
    return (type & TYPE_STRUCTURE) !== 0 && (type & TYPE_SYSTEM) === 0;
}

export function isSystemType(type: number): boolean {
    return (type & TYPE_SYSTEM) !== 0;
}

export function symbolDimensionCount(type: number): number {
    return (type & TYPE_ARRAY_DIMENSIONS) >> 13;
}

export function templateIdOf(type: number): number {
    return type & TYPE_TEMPLATE_ID;
}

export function isPredefinedTemplate(templateId: number): boolean {
    return templateId < FIRST_USER_TEMPLATE || templateId > LAST_USER_TEMPLATE;
}

/** The binding type for the low byte of a CIP type word, or undefined for codes the binding does not define. */
export function primitiveTypeOf(type: number): EipPrimitiveType | undefined {
    return CIP_TYPES[type & 0xff];
}

export interface TemplateAttributes {
    /** Size of the template definition in 32-bit words. */
    definitionWords: number;
    /** Size of one instance of the structure in bytes. */
    structureSize: number;
    memberCount: number;
    handle: number;
}

export function encodeTemplateAttributesRequest(templateId: number): Buffer {
    return encodeCipRequest(
        META_SERVICE.GetAttributeList,
        classInstancePath(CLASS.Template, templateId),
        Buffer.concat([u16(4), u16(4), u16(5), u16(2), u16(1)])
    );
}

export function parseTemplateAttributes(data: Buffer): TemplateAttributes {
    if (data.length < 2) throw malformed("template attributes");
    const count = data.readUInt16LE(0);
    const values = new Map<number, number>();
    let offset = 2;
    for (let i = 0; i < count; i++) {
        if (offset + 4 > data.length) throw malformed("template attributes");
        const id = data.readUInt16LE(offset);
        const status = data.readUInt16LE(offset + 2);
        offset += 4;
        if (status !== 0) throw new EipError(`Template attribute ${id} failed with status 0x${status.toString(16)}`);
        const width = id === 4 || id === 5 ? 4 : 2;
        if (offset + width > data.length) throw malformed("template attributes");
        values.set(id, width === 4 ? data.readUInt32LE(offset) : data.readUInt16LE(offset));
        offset += width;
    }
    const get = (id: number): number => {
        const value = values.get(id);
        if (value === undefined) throw malformed("template attributes");
        return value;
    };
    return { definitionWords: get(4), structureSize: get(5), memberCount: get(2), handle: get(1) };
}

/** Bytes to request when reading a template: the definition size less the 23 bytes the controller does not return. */
export function templateReadLength(attributes: TemplateAttributes): number {
    const length = attributes.definitionWords * 4 - 23;
    if (length <= 0) throw new EipError("Template reports an empty definition");
    return length;
}

export function encodeReadTemplate(templateId: number, offset: number, length: number): Buffer {
    return encodeCipRequest(
        META_SERVICE.ReadTemplate,
        classInstancePath(CLASS.Template, templateId),
        Buffer.concat([u32(offset), u16(length)])
    );
}

export interface TemplateMember {
    name: string;
    /** Bit number of a BOOL member, element count of an array member, else 0. */
    info: number;
    /** Member type word. Bit 13 marks an array member. */
    type: number;
    offset: number;
}

export interface Template {
    /** Type name without the trailing `;` part. */
    name: string;
    structureSize: number;
    handle: number;
    members: TemplateMember[];
}

export function isArrayMember(type: number): boolean {
    return (type & TYPE_ARRAY_MEMBER) !== 0;
}

export function memberBaseType(type: number): number {
    return type & ~TYPE_ARRAY_MEMBER;
}

/** Decodes the body of a template read: one 8-byte record per member, then the type name and the member names. */
export function parseTemplate(attributes: TemplateAttributes, body: Buffer): Template {
    const recordsLength = attributes.memberCount * TEMPLATE_MEMBER_LENGTH;
    if (body.length < recordsLength) throw malformed("template");
    const members: TemplateMember[] = [];
    for (let i = 0; i < attributes.memberCount; i++) {
        const at = i * TEMPLATE_MEMBER_LENGTH;
        members.push({
            name: "",
            info: body.readUInt16LE(at),
            type: body.readUInt16LE(at + 2),
            offset: body.readUInt32LE(at + 4),
        });
    }

    // The bytes after the last name are not part of the definition.
    let offset = recordsLength;
    const nextString = (): string => {
        const end = body.indexOf(0, offset);
        if (end < 0) throw malformed("template");
        const text = body.toString("latin1", offset, end);
        offset = end + 1;
        return text;
    };
    const name = nextString().split(";")[0];
    for (const member of members) member.name = nextString();
    return { name, structureSize: attributes.structureSize, handle: attributes.handle, members };
}

export interface Identity {
    vendorId: number;
    deviceType: number;
    productCode: number;
    revision: { major: number; minor: number };
    status: number;
    serialNumber: number;
    productName: string;
}

export function encodeIdentityRequest(): Buffer {
    return encodeCipRequest(META_SERVICE.GetAttributesAll, classInstancePath(CLASS.Identity, 1));
}

/** Decodes the identity fields shared by a Get Attributes All reply and a ListIdentity item. */
export function parseIdentityFields(data: Buffer, offset = 0): { identity: Identity; end: number } {
    if (offset + 15 > data.length) throw malformed("identity");
    const nameLength = data.readUInt8(offset + 14);
    const end = offset + 15 + nameLength;
    if (end > data.length) throw malformed("identity");
    return {
        identity: {
            vendorId: data.readUInt16LE(offset),
            deviceType: data.readUInt16LE(offset + 2),
            productCode: data.readUInt16LE(offset + 4),
            revision: { major: data.readUInt8(offset + 6), minor: data.readUInt8(offset + 7) },
            status: data.readUInt16LE(offset + 8),
            serialNumber: data.readUInt32LE(offset + 10),
            productName: data.toString("latin1", offset + 15, end),
        },
        end,
    };
}

export function parseIdentity(data: Buffer): Identity {
    return parseIdentityFields(data).identity;
}

export type EipLogixFamily = "ControlLogix" | "CompactLogix";

const ROCKWELL_VENDOR_ID = 1;

/** The Logix family a Rockwell product name belongs to, or undefined for anything the binding cannot browse. */
export function logixFamilyOf(identity: Identity): EipLogixFamily | undefined {
    if (identity.vendorId !== ROCKWELL_VENDOR_ID) return undefined;
    if (identity.productName.startsWith("1756-")) return "ControlLogix";
    if (/^(1768|1769|5069)-/.test(identity.productName)) return "CompactLogix";
    return undefined;
}
