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
import { byteLength, decodeValue, encodeValue, layoutFromForm, EipValueLayout } from "../src/eip-codec";
import { EipForm, EipStructureDefinition } from "../src/eip-form";

const shiftData: EipStructureDefinition = {
    "eipv:typeName": "UDT_Shift_Data",
    "eipv:fields": [
        { "eipv:name": "Prodution_Count", "eipv:type": "eipv:DINT", "eipv:byteOffset": 0 },
        { "eipv:name": "Rejected_Product_Count", "eipv:type": "eipv:DINT", "eipv:byteOffset": 4 },
        { "eipv:name": "Cycle_Time", "eipv:type": "eipv:REAL", "eipv:byteOffset": 8 },
        { "eipv:name": "OEE", "eipv:type": "eipv:REAL", "eipv:byteOffset": 12 },
        { "eipv:name": "OEE_Availablity", "eipv:type": "eipv:REAL", "eipv:byteOffset": 16 },
        { "eipv:name": "OEE_Performance", "eipv:type": "eipv:REAL", "eipv:byteOffset": 20 },
        { "eipv:name": "OEE_Quality", "eipv:type": "eipv:REAL", "eipv:byteOffset": 24 },
        { "eipv:name": "Shift_Number", "eipv:type": "eipv:DINT", "eipv:byteOffset": 28 },
        { "eipv:name": "Time_In_Shift", "eipv:type": "eipv:DINT", "eipv:byteOffset": 32 },
    ],
};

const motorStatus: EipStructureDefinition = {
    "eipv:typeName": "MotorStatus",
    "eipv:byteSize": 8,
    "eipv:fields": [
        { "eipv:name": "Running", "eipv:type": "eipv:BOOL", "eipv:byteOffset": 0, "eipv:bitOffset": 3 },
        { "eipv:name": "Speed", "eipv:type": "eipv:REAL", "eipv:byteOffset": 4 },
    ],
};

function bytes(...values: number[]): Buffer {
    return Buffer.from(values);
}

describe("EtherNet/IP codec", () => {
    describe("primitives", () => {
        it("decodes little-endian integers of every width", () => {
            expect(decodeValue({ type: "eipv:SINT" }, bytes(0xfe))).to.equal(-2);
            expect(decodeValue({ type: "eipv:INT" }, bytes(0xfe, 0xff))).to.equal(-2);
            expect(decodeValue({ type: "eipv:DINT" }, bytes(0xfe, 0xff, 0xff, 0xff))).to.equal(-2);
            expect(decodeValue({ type: "eipv:LINT" }, bytes(0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff))).to.equal(
                -2
            );
            expect(decodeValue({ type: "eipv:USINT" }, bytes(0xfe))).to.equal(254);
            expect(decodeValue({ type: "eipv:UINT" }, bytes(0x01, 0x02))).to.equal(0x0201);
            expect(decodeValue({ type: "eipv:UDINT" }, bytes(0xff, 0xff, 0xff, 0xff))).to.equal(4294967295);
            expect(decodeValue({ type: "eipv:ULINT" }, bytes(1, 0, 0, 0, 0, 0, 0, 0))).to.equal(1);
            expect(decodeValue({ type: "eipv:BYTE" }, bytes(0xab))).to.equal(0xab);
            expect(decodeValue({ type: "eipv:WORD" }, bytes(0x01, 0x02))).to.equal(0x0201);
            expect(decodeValue({ type: "eipv:DWORD" }, bytes(1, 0, 0, 0))).to.equal(1);
            expect(decodeValue({ type: "eipv:LWORD" }, bytes(1, 0, 0, 0, 0, 0, 0, 0))).to.equal(1);
        });

        it("decodes floating point values", () => {
            expect(decodeValue({ type: "eipv:REAL" }, Buffer.from([0x00, 0x00, 0xc0, 0x3f]))).to.equal(1.5);
            const lreal = Buffer.alloc(8);
            lreal.writeDoubleLE(-2.25);
            expect(decodeValue({ type: "eipv:LREAL" }, lreal)).to.equal(-2.25);
        });

        it("decodes BOOL from the least significant bit", () => {
            expect(decodeValue({ type: "eipv:BOOL" }, bytes(0x01))).to.equal(true);
            expect(decodeValue({ type: "eipv:BOOL" }, bytes(0x00))).to.equal(false);
        });

        it("encodes values little-endian", () => {
            expect(encodeValue({ type: "eipv:DINT" }, -2)).to.deep.equal(bytes(0xfe, 0xff, 0xff, 0xff));
            expect(encodeValue({ type: "eipv:UINT" }, 0x0201)).to.deep.equal(bytes(0x01, 0x02));
            expect(encodeValue({ type: "eipv:REAL" }, 1.5)).to.deep.equal(bytes(0x00, 0x00, 0xc0, 0x3f));
            expect(encodeValue({ type: "eipv:BOOL" }, true)).to.deep.equal(bytes(0x01));
            expect(encodeValue({ type: "eipv:LINT" }, -2)).to.deep.equal(
                bytes(0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff)
            );
            expect(encodeValue({ type: "eipv:ULINT" }, 1)).to.deep.equal(bytes(1, 0, 0, 0, 0, 0, 0, 0));
        });

        it("rejects 64-bit values that JavaScript numbers cannot hold exactly", () => {
            const big = Buffer.alloc(8);
            big.writeBigInt64LE(2n ** 53n);
            expect(() => decodeValue({ type: "eipv:LINT" }, big)).to.throw(RangeError);
            const bigUnsigned = Buffer.alloc(8);
            bigUnsigned.writeBigUInt64LE(2n ** 63n);
            expect(() => decodeValue({ type: "eipv:ULINT" }, bigUnsigned)).to.throw(RangeError);
            expect(() => encodeValue({ type: "eipv:LINT" }, 2 ** 53)).to.throw(RangeError);
            expect(() => encodeValue({ type: "eipv:ULINT" }, -1)).to.throw(RangeError);
        });

        it("rejects out-of-range, non-integer and wrongly typed values on write", () => {
            expect(() => encodeValue({ type: "eipv:SINT" }, 128)).to.throw(RangeError);
            expect(() => encodeValue({ type: "eipv:USINT" }, -1)).to.throw(RangeError);
            expect(() => encodeValue({ type: "eipv:DINT" }, 1.5)).to.throw(RangeError);
            expect(() => encodeValue({ type: "eipv:DINT" }, "1")).to.throw(TypeError);
            expect(() => encodeValue({ type: "eipv:BOOL" }, 1)).to.throw(TypeError);
            expect(() => encodeValue({ type: "eipv:REAL" }, true)).to.throw(TypeError);
        });

        it("rejects a buffer that is too short", () => {
            expect(() => decodeValue({ type: "eipv:DINT" }, bytes(1, 2))).to.throw(RangeError);
        });

        it("decodes and encodes the predefined STRING structure", () => {
            const encoded = encodeValue({ type: "eipv:STRING" }, "Hello");
            expect(encoded.length).to.equal(88);
            expect(encoded.readInt32LE(0)).to.equal(5);
            expect(encoded.subarray(4, 9).toString("latin1")).to.equal("Hello");
            expect(decodeValue({ type: "eipv:STRING" }, encoded)).to.equal("Hello");
        });

        it("rejects strings longer than 82 characters and invalid LEN", () => {
            expect(() => encodeValue({ type: "eipv:STRING" }, "x".repeat(83))).to.throw(RangeError);
            const bad = Buffer.alloc(88);
            bad.writeInt32LE(83);
            expect(() => decodeValue({ type: "eipv:STRING" }, bad)).to.throw(RangeError);
        });
    });

    describe("arrays", () => {
        it("decodes all elements as a flat array", () => {
            const layout: EipValueLayout = { type: "eipv:DINT", dimensions: [2, 2] };
            const buf = Buffer.alloc(16);
            [1, 2, 3, 4].forEach((v, i) => buf.writeInt32LE(v, i * 4));
            expect(decodeValue(layout, buf)).to.deep.equal([1, 2, 3, 4]);
            expect(byteLength(layout)).to.equal(16);
        });

        it("transfers only elementCount elements", () => {
            const layout: EipValueLayout = { type: "eipv:INT", dimensions: [10], elementCount: 3 };
            expect(byteLength(layout)).to.equal(6);
            expect(decodeValue(layout, bytes(1, 0, 2, 0, 3, 0))).to.deep.equal([1, 2, 3]);
        });

        it("requires exactly elementCount elements on write", () => {
            const layout: EipValueLayout = { type: "eipv:INT", dimensions: [10], elementCount: 3 };
            expect(encodeValue(layout, [1, 2, 3])).to.deep.equal(bytes(1, 0, 2, 0, 3, 0));
            expect(() => encodeValue(layout, [1, 2])).to.throw("3");
            expect(() => encodeValue(layout, 5)).to.throw(TypeError);
        });

        it("uses byteSize as the stride of an array of structures", () => {
            const layout: EipValueLayout = { structure: motorStatus, dimensions: [2] };
            const buf = Buffer.alloc(16);
            buf[0] = 0x08;
            buf.writeFloatLE(1.5, 4);
            buf.writeFloatLE(2.5, 12);
            expect(decodeValue(layout, buf)).to.deep.equal([
                { Running: true, Speed: 1.5 },
                { Running: false, Speed: 2.5 },
            ]);
            expect(byteLength(layout)).to.equal(16);
        });
    });

    describe("structures", () => {
        it("decodes the Production_Data structure of the sample TD", () => {
            const buf = Buffer.alloc(36);
            buf.writeInt32LE(100, 0);
            buf.writeInt32LE(3, 4);
            buf.writeFloatLE(12.5, 8);
            buf.writeFloatLE(0.5, 12);
            buf.writeInt32LE(2, 28);
            buf.writeInt32LE(600, 32);
            const value = decodeValue({ structure: shiftData }, buf) as Record<string, number>;
            expect(value.Prodution_Count).to.equal(100);
            expect(value.Rejected_Product_Count).to.equal(3);
            expect(value.Cycle_Time).to.equal(12.5);
            expect(value.OEE).to.equal(0.5);
            expect(value.Shift_Number).to.equal(2);
            expect(value.Time_In_Shift).to.equal(600);
            expect(Object.keys(value)).to.have.length(9);
            expect(byteLength({ structure: shiftData })).to.equal(36);
        });

        it("round-trips a structure", () => {
            const value = { Running: true, Speed: 1450.5 };
            const encoded = encodeValue({ structure: motorStatus }, value);
            expect(encoded.length).to.equal(8);
            expect(encoded[0]).to.equal(0x08);
            expect(decodeValue({ structure: motorStatus }, encoded)).to.deep.equal(value);
        });

        it("preserves bytes that no field covers", () => {
            const existing = Buffer.from([0xf7, 0xaa, 0xbb, 0xcc, 0, 0, 0, 0]);
            const encoded = encodeValue({ structure: motorStatus }, { Running: false, Speed: 1 }, existing);
            expect(encoded[0]).to.equal(0xf7);
            expect(encoded.subarray(1, 4)).to.deep.equal(bytes(0xaa, 0xbb, 0xcc));
            expect(encoded.readFloatLE(4)).to.equal(1);
            expect(existing[0]).to.equal(0xf7);
            const withFlag = encodeValue({ structure: motorStatus }, { Running: true, Speed: 1 }, existing);
            expect(withFlag[0]).to.equal(0xff);
        });

        it("rejects an existing buffer of the wrong length", () => {
            expect(() =>
                encodeValue({ structure: motorStatus }, { Running: true, Speed: 1 }, Buffer.alloc(4))
            ).to.throw(RangeError);
        });

        it("rejects missing, unknown and non-object values", () => {
            expect(() => encodeValue({ structure: motorStatus }, { Running: true })).to.throw("Speed");
            expect(() => encodeValue({ structure: motorStatus }, { Running: true, Speed: 1, Extra: 2 })).to.throw(
                "Extra"
            );
            expect(() => encodeValue({ structure: motorStatus }, 5)).to.throw(TypeError);
        });

        it("decodes nested structures relative to their own start and array members", () => {
            const outer: EipStructureDefinition = {
                "eipv:typeName": "Outer",
                "eipv:fields": [
                    { "eipv:name": "Values", "eipv:type": "eipv:INT", "eipv:byteOffset": 0, "eipv:dimensions": [2] },
                    {
                        "eipv:name": "Drive",
                        "eipv:byteOffset": 4,
                        "eipv:structureDefinition": {
                            "eipv:typeName": "Drive",
                            "eipv:fields": [
                                { "eipv:name": "Current", "eipv:type": "eipv:REAL", "eipv:byteOffset": 0 },
                                { "eipv:name": "Fault", "eipv:type": "eipv:DINT", "eipv:byteOffset": 4 },
                            ],
                        },
                    },
                    {
                        "eipv:name": "Motors",
                        "eipv:byteOffset": 12,
                        "eipv:dimensions": [2],
                        "eipv:structureDefinition": motorStatus,
                    },
                ],
            };
            const buf = Buffer.alloc(28);
            buf.writeInt16LE(7, 0);
            buf.writeInt16LE(8, 2);
            buf.writeFloatLE(2.5, 4);
            buf.writeInt32LE(9, 8);
            buf[12] = 0x08;
            buf.writeFloatLE(1, 16);
            buf.writeFloatLE(3, 24);
            const expected = {
                Values: [7, 8],
                Drive: { Current: 2.5, Fault: 9 },
                Motors: [
                    { Running: true, Speed: 1 },
                    { Running: false, Speed: 3 },
                ],
            };
            expect(decodeValue({ structure: outer }, buf)).to.deep.equal(expected);
            expect(encodeValue({ structure: outer }, expected)).to.deep.equal(buf);
        });
    });

    describe("layoutFromForm", () => {
        it("maps form terms to a layout", () => {
            const form = {
                href: "eip://h/1,0/X",
                "eipv:type": "eipv:INT",
                "eipv:dimensions": [4],
                "eipv:elementCount": 2,
            } as EipForm;
            expect(layoutFromForm(form)).to.deep.equal({
                type: "eipv:INT",
                structure: undefined,
                dimensions: [4],
                elementCount: 2,
            });
        });

        it("leaves a fractional value for an integer type to the caller", () => {
            expect(() => encodeValue({ type: "eipv:INT" }, 23.5)).to.throw(RangeError);
        });
    });
});
