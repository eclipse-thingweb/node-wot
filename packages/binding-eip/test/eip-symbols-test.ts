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
import { expect } from "chai";
import {
    classInstancePath,
    encodeIdentityRequest,
    encodeReadTemplate,
    encodeSymbolListRequest,
    encodeTemplateAttributesRequest,
    isArrayMember,
    isPredefinedTemplate,
    isStructureType,
    isSystemType,
    logixFamilyOf,
    memberBaseType,
    parseIdentity,
    parseSymbolEntries,
    parseTemplate,
    parseTemplateAttributes,
    primitiveTypeOf,
    symbolDimensionCount,
    templateIdOf,
    templateReadLength,
} from "../src/eip-symbols";
import { IDENTITY_REPLY, SYMBOL_PAGES, TEMPLATES } from "./eip-browse-fixtures";

function hex(text: string): Buffer {
    return Buffer.from(text, "hex");
}

function template(id: number) {
    const attributes = parseTemplateAttributes(hex(TEMPLATES[id].attributes));
    return parseTemplate(attributes, hex(TEMPLATES[id].body));
}

describe("EtherNet/IP symbol, template and identity decoding", () => {
    describe("requests", () => {
        it("builds class and instance paths", () => {
            expect(classInstancePath(0x6b, 0)).to.deep.equal(Buffer.from([0x20, 0x6b, 0x24, 0x00]));
            expect(classInstancePath(0x6c, 0x0f83)).to.deep.equal(Buffer.from([0x20, 0x6c, 0x25, 0x00, 0x83, 0x0f]));
            expect(classInstancePath(0x0123, 1)).to.deep.equal(Buffer.from([0x21, 0x00, 0x23, 0x01, 0x24, 0x01]));
        });

        it("rejects instances wider than 16 bits", () => {
            expect(() => classInstancePath(0x6b, 0x10000)).to.throw("16-bit");
        });

        it("requests the symbol list with and without external access", () => {
            expect(encodeSymbolListRequest(0, true)).to.deep.equal(
                Buffer.from([0x55, 0x02, 0x20, 0x6b, 0x24, 0x00, 5, 0, 1, 0, 2, 0, 7, 0, 8, 0, 10, 0])
            );
            expect(encodeSymbolListRequest(300, false)).to.deep.equal(
                Buffer.from([0x55, 0x03, 0x20, 0x6b, 0x25, 0x00, 0x2c, 0x01, 4, 0, 1, 0, 2, 0, 7, 0, 8, 0])
            );
        });

        it("requests template attributes and body", () => {
            expect(encodeTemplateAttributesRequest(1566)).to.deep.equal(
                Buffer.from([0x03, 0x03, 0x20, 0x6c, 0x25, 0x00, 0x1e, 0x06, 4, 0, 4, 0, 5, 0, 2, 0, 1, 0])
            );
            expect(encodeReadTemplate(1566, 0, 249)).to.deep.equal(
                Buffer.from([0x4c, 0x03, 0x20, 0x6c, 0x25, 0x00, 0x1e, 0x06, 0, 0, 0, 0, 249, 0])
            );
        });

        it("requests the identity", () => {
            expect(encodeIdentityRequest()).to.deep.equal(Buffer.from([0x01, 0x02, 0x20, 0x01, 0x24, 0x01]));
        });
    });

    describe("symbol list of a 1756-L81E/B", () => {
        const first = parseSymbolEntries(hex(SYMBOL_PAGES[0].data), true);
        const second = parseSymbolEntries(hex(SYMBOL_PAGES[1].data), true);

        it("decodes both pages", () => {
            expect(first).to.have.length(11);
            expect(second).to.have.length(4);
            expect(first[0]).to.deep.include({ instance: 1, name: "Map:Local", type: 0x1069, elementLength: 0 });
        });

        it("decodes structure tags with size and external access", () => {
            const production = first.find((entry) => entry.name === "Production_Data");
            expect(production).to.deep.equal({
                instance: 9,
                name: "Production_Data",
                type: 0x861e,
                elementLength: 36,
                dimensions: [0, 0, 0],
                externalAccess: 2,
            });
            expect(second.find((entry) => entry.name === "IO_Control")).to.deep.include({
                type: 0x8e37,
                elementLength: 16,
                externalAccess: 0,
            });
        });

        it("tells tags from system objects by the type word", () => {
            const byName = (name: string) => first.concat(second).find((entry) => entry.name === name);
            expect(isSystemType(byName("Program:Shift_Data")!.type)).to.equal(true);
            expect(isSystemType(byName("Task:Continuous")!.type)).to.equal(true);
            expect(isStructureType(byName("Production_Data")!.type)).to.equal(true);
            expect(isStructureType(byName("Program:Shift_Data")!.type)).to.equal(false);
            expect(templateIdOf(byName("Production_Data")!.type)).to.equal(1566);
            expect(templateIdOf(byName("Local:2:O")!.type)).to.equal(292);
        });

        it("fails on a truncated entry", () => {
            const data = hex(SYMBOL_PAGES[0].data);
            expect(() => parseSymbolEntries(data.subarray(0, data.length - 3), true)).to.throw("symbol list");
        });

        it("reads entries without the external access attribute", () => {
            const entry = Buffer.concat([Buffer.from([1, 0, 0, 0, 1, 0, 0x41, 0xc4, 0, 4, 0]), Buffer.alloc(12)]);
            expect(parseSymbolEntries(entry, false)).to.deep.equal([
                { instance: 1, name: "A", type: 0x00c4, elementLength: 4, dimensions: [0, 0, 0] },
            ]);
        });
    });

    describe("type words", () => {
        it("counts array dimensions in bits 13 and 14", () => {
            expect(symbolDimensionCount(0x00c4)).to.equal(0);
            expect(symbolDimensionCount(0x20c4)).to.equal(1);
            expect(symbolDimensionCount(0x40c4)).to.equal(2);
            expect(symbolDimensionCount(0xa61e)).to.equal(1);
        });

        it("maps the low byte to a binding type", () => {
            expect(primitiveTypeOf(0x00c4)).to.equal("eipv:DINT");
            expect(primitiveTypeOf(0x20ca)).to.equal("eipv:REAL");
            expect(primitiveTypeOf(0x00d3)).to.equal("eipv:DWORD");
            expect(primitiveTypeOf(0x00cc)).to.equal(undefined);
        });

        it("separates user from predefined templates", () => {
            expect(isPredefinedTemplate(1566)).to.equal(false);
            expect(isPredefinedTemplate(3971)).to.equal(true);
        });

        it("splits the array flag from the member type", () => {
            expect(isArrayMember(0x20c2)).to.equal(true);
            expect(memberBaseType(0x20c2)).to.equal(0x00c2);
            expect(isArrayMember(0x00c4)).to.equal(false);
        });
    });

    describe("templates", () => {
        it("decodes the attributes of UDT_Shift_Data", () => {
            const attributes = parseTemplateAttributes(hex(TEMPLATES[1566].attributes));
            expect(attributes).to.deep.equal({ definitionWords: 68, structureSize: 36, memberCount: 9, handle: 63191 });
            expect(templateReadLength(attributes)).to.equal(249);
        });

        it("decodes the members of UDT_Shift_Data", () => {
            const decoded = template(1566);
            expect(decoded.name).to.equal("UDT_Shift_Data");
            expect(decoded.structureSize).to.equal(36);
            expect(decoded.members.map((m) => [m.name, m.type, m.offset])).to.deep.equal([
                ["Prodution_Count", 0xc4, 0],
                ["Rejected_Product_Count", 0xc4, 4],
                ["Cycle_Time", 0xca, 8],
                ["OEE", 0xca, 12],
                ["OEE_Availablity", 0xca, 16],
                ["OEE_Performance", 0xca, 20],
                ["OEE_Quality", 0xca, 24],
                ["Shift_Number", 0xc4, 28],
                ["Time_In_Shift", 0xc4, 32],
            ]);
        });

        it("decodes the BOOL bits of the predefined TIMER", () => {
            const decoded = template(3971);
            expect(decoded.name).to.equal("TIMER");
            expect(decoded.members.map((m) => [m.name, m.type, m.info, m.offset])).to.deep.equal([
                ["Control", 0xc4, 0, 0],
                ["PRE", 0xc4, 0, 4],
                ["ACC", 0xc4, 0, 8],
                ["EN", 0xc1, 7, 3],
                ["TT", 0xc1, 6, 3],
                ["DN", 0xc1, 5, 3],
            ]);
        });

        it("decodes the array member of the predefined STRING", () => {
            const decoded = template(4046);
            expect(decoded.name).to.equal("STRING");
            expect(decoded.structureSize).to.equal(88);
            expect(decoded.members.map((m) => [m.name, m.type, m.info, m.offset])).to.deep.equal([
                ["LEN", 0xc4, 0, 0],
                ["DATA", 0x20c2, 82, 4],
            ]);
        });

        it("ignores the bytes after the last member name", () => {
            const attributes = parseTemplateAttributes(hex(TEMPLATES[292].attributes));
            const body = Buffer.concat([hex(TEMPLATES[292].body), Buffer.from([0xff, 0xff])]);
            expect(parseTemplate(attributes, body).members.map((m) => m.name)).to.deep.equal(["Data"]);
        });

        it("fails on a truncated body", () => {
            const attributes = parseTemplateAttributes(hex(TEMPLATES[1566].attributes));
            expect(() => parseTemplate(attributes, hex(TEMPLATES[1566].body).subarray(0, 100))).to.throw("template");
            expect(() => parseTemplate(attributes, hex(TEMPLATES[1566].body).subarray(0, 40))).to.throw("template");
        });

        it("fails on an attribute reply that reports a status", () => {
            const reply = Buffer.from(TEMPLATES[292].attributes, "hex");
            reply.writeUInt16LE(0x14, 4);
            expect(() => parseTemplateAttributes(reply)).to.throw("status 0x14");
        });
    });

    describe("identity", () => {
        it("decodes a 1756-L81E/B", () => {
            expect(parseIdentity(hex(IDENTITY_REPLY))).to.deep.equal({
                vendorId: 1,
                deviceType: 0x0e,
                productCode: 164,
                revision: { major: 30, minor: 11 },
                status: 0x1160,
                serialNumber: 0x00d70a2e,
                productName: "1756-L81E/B",
            });
        });

        it("fails on a truncated reply", () => {
            expect(() => parseIdentity(hex(IDENTITY_REPLY).subarray(0, 20))).to.throw("identity");
        });

        it("recognizes the Logix families by product name", () => {
            const identity = parseIdentity(hex(IDENTITY_REPLY));
            expect(logixFamilyOf(identity)).to.equal("ControlLogix");
            expect(logixFamilyOf({ ...identity, productName: "1769-L33ER/A LOGIX5333ER" })).to.equal("CompactLogix");
            expect(logixFamilyOf({ ...identity, productName: "5069-L306ER/A" })).to.equal("CompactLogix");
            expect(logixFamilyOf({ ...identity, productName: "2080-LC50-24QWB" })).to.equal(undefined);
            expect(logixFamilyOf({ ...identity, vendorId: 2 })).to.equal(undefined);
        });
    });
});
