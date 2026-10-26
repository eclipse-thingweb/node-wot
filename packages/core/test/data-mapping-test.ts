/********************************************************************************
 * Copyright (c) 2026 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0 or the W3C Software Notice and
 * Document License (2015-05-13) which is available at
 * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.
 *
 * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513
 ********************************************************************************/

import { suite, test } from "@testdeck/mocha";
import { expect } from "chai";
import { Readable } from "stream";
import { applyFromWireMapping, getWireDecoding } from "../src/data-mapping";
import { InteractionOutput } from "../src/interaction-output";
import { Content } from "../dist/core";

const modeMap = [
    { "map:wire": 0, "map:app": "off" },
    { "map:wire": 1, "map:app": "auto" },
    { "map:wire": 2, "map:app": "manual" },
];

const batteryRanges = [
    { "map:min": 0, "map:max": 20, "map:app": "low" },
    { "map:min": 21, "map:max": 70, "map:app": "medium" },
    { "map:min": 71, "map:max": 100, "map:app": "high" },
];

function fromWire(value: unknown, ...steps: Record<string, unknown>[]): unknown {
    return applyFromWireMapping(value, { "map:valueMapping": { "map:fromWire": steps } });
}

@suite("testing data mapping enum operations")
class EnumMappingTests {
    @test "enum maps an exact wire value to its application value"() {
        expect(fromWire(1, { "map:proc": "enum", "map:map": modeMap })).to.equal("auto");
    }

    @test "enum supports non-string application values"() {
        const map = [
            { "map:wire": 0, "map:app": false },
            { "map:wire": 1, "map:app": true },
        ];
        expect(fromWire(1, { "map:proc": "enum", "map:map": map })).to.equal(true);
        expect(fromWire(0, { "map:proc": "enum", "map:map": map })).to.equal(false);
    }

    @test "enum matches strictly without type coercion"() {
        expect(() => fromWire("1", { "map:proc": "enum", "map:map": modeMap })).to.throw("No enum entry matches '1'");
    }

    @test "enum rejects an unknown value by default and with explicit error policy"() {
        expect(() => fromWire(9, { "map:proc": "enum", "map:map": modeMap })).to.throw("No enum entry matches '9'");
        expect(() => fromWire(9, { "map:proc": "enum", "map:map": modeMap, "map:onNoMatch": "error" })).to.throw(
            "No enum entry matches '9'"
        );
    }

    @test "enum rejects unsupported map:onNoMatch policies"() {
        expect(() => fromWire(1, { "map:proc": "enum", "map:map": modeMap, "map:onNoMatch": "default" })).to.throw(
            "map:onNoMatch must be 'error'"
        );
    }

    @test "enum rejects invalid tables even when the input would match"() {
        expect(() => fromWire(0, { "map:proc": "enum" })).to.throw("non-empty array");
        expect(() => fromWire(0, { "map:proc": "enum", "map:map": [] })).to.throw("non-empty array");
        expect(() => fromWire(0, { "map:proc": "enum", "map:map": [{ "map:wire": 0 }] })).to.throw(
            "require map:wire and map:app"
        );
        expect(() =>
            fromWire(0, {
                "map:proc": "enum",
                "map:map": [
                    { "map:wire": 0, "map:app": "off" },
                    { "map:wire": 0, "map:app": "on" },
                ],
            })
        ).to.throw("duplicate map:wire value '0'");
    }

    @test "enum with map:name replaces the member in place without renaming it"() {
        const input = { mode: 2, other: 7 };
        const result = fromWire(input, { "map:proc": "enum", "map:name": "mode", "map:map": modeMap });
        expect(result).to.deep.equal({ mode: "manual", other: 7 });
        expect(input).to.deep.equal({ mode: 2, other: 7 });
    }

    @test "enum with map:name rejects a missing member or a non-object input"() {
        const step = { "map:proc": "enum", "map:name": "mode", "map:map": modeMap };
        expect(() => fromWire({ other: 1 }, step)).to.throw("Mapping member 'mode' was not found");
        expect(() => fromWire({ toString: 1 }, { ...step, "map:name": "valueOf" })).to.throw("was not found");
        expect(() => fromWire(1, step)).to.throw("Mapping member 'mode' was not found");
        expect(() => fromWire([1], step)).to.throw("Mapping member 'mode' was not found");
        expect(() => fromWire({ mode: 1 }, { ...step, "map:name": 3 })).to.throw("map:name must be a string");
    }

    @test "enumRange classifies values including both interval bounds"() {
        const step = { "map:proc": "enumRange", "map:ranges": batteryRanges };
        expect(fromWire(0, step)).to.equal("low");
        expect(fromWire(20, step)).to.equal("low");
        expect(fromWire(21, step)).to.equal("medium");
        expect(fromWire(70, step)).to.equal("medium");
        expect(fromWire(71, step)).to.equal("high");
        expect(fromWire(100, step)).to.equal("high");
    }

    @test "enumRange rejects uncovered and non-numeric input"() {
        const step = { "map:proc": "enumRange", "map:ranges": batteryRanges };
        expect(() => fromWire(101, step)).to.throw("No enumRange entry matches '101'");
        expect(() => fromWire(-1, step)).to.throw("No enumRange entry matches '-1'");
        expect(() => fromWire(20.5, step)).to.throw("No enumRange entry matches '20.5'");
        expect(() => fromWire(Number.NaN, step)).to.throw("No enumRange entry matches 'NaN'");
        expect(() => fromWire("50", step)).to.throw("requires a numeric input");
    }

    @test "enumRange rejects invalid range tables"() {
        const step = (ranges: unknown) => ({ "map:proc": "enumRange", "map:ranges": ranges });
        expect(() => fromWire(1, { "map:proc": "enumRange" })).to.throw("non-empty array");
        expect(() => fromWire(1, step([{ "map:min": 0, "map:max": 5 }]))).to.throw("require map:app");
        expect(() => fromWire(1, step([{ "map:min": "0", "map:max": 5, "map:app": "a" }]))).to.throw("finite numeric");
        expect(() => fromWire(1, step([{ "map:min": 6, "map:max": 5, "map:app": "a" }]))).to.throw("greater than");
        expect(() =>
            fromWire(
                1,
                step([
                    { "map:min": 0, "map:max": 10, "map:app": "a" },
                    { "map:min": 10, "map:max": 20, "map:app": "b" },
                ])
            )
        ).to.throw("overlaps");
        expect(() => fromWire(1, step([{ "map:min": 0, "map:max": 5, "map:app": "a", "map:canonical": 9 }]))).to.throw(
            "map:canonical"
        );
    }

    @test "enumRange accepts a canonical value within its interval"() {
        const ranges = [{ "map:min": 0, "map:max": 5, "map:app": "a", "map:canonical": 5 }];
        expect(fromWire(3, { "map:proc": "enumRange", "map:ranges": ranges })).to.equal("a");
    }

    @test "enumRange with map:name replaces the member in place"() {
        const result = fromWire(
            { batteryState: 55, mode: 1 },
            { "map:proc": "enumRange", "map:name": "batteryState", "map:ranges": batteryRanges }
        );
        expect(result).to.deep.equal({ batteryState: "medium", mode: 1 });
    }

    @test "enum and enumRange compose in order on one structured value"() {
        const result = fromWire(
            { mode: 1, batteryState: 90 },
            { "map:proc": "enum", "map:name": "mode", "map:map": modeMap },
            { "map:proc": "enumRange", "map:name": "batteryState", "map:ranges": batteryRanges }
        );
        expect(result).to.deep.equal({ mode: "auto", batteryState: "high" });
    }

    @test "enum applies to each record field pipeline"() {
        const result = fromWire([{ code: 0 }, { code: 2 }], {
            "map:proc": "record",
            "map:fields": {
                mode: [
                    { "map:proc": "pick", "jsonv:path": "/code" },
                    { "map:proc": "enum", "map:map": modeMap },
                ],
            },
        });
        expect(result).to.deep.equal([{ mode: "off" }, { mode: "manual" }]);
    }
}

@suite("testing data mapping enum operations through InteractionOutput")
class EnumInteractionOutputTests {
    private output(body: string, schema: Record<string, unknown>, steps: Record<string, unknown>[]) {
        const content = new Content("application/json", Readable.from([Buffer.from(body)]));
        const form = {
            href: "http://example.org/status",
            contentType: "application/json",
            "map:valueMapping": { "map:fromWire": steps },
        };
        return new InteractionOutput(content, form, schema);
    }

    @test async "should expose the mapped enum value validated against the DataSchema"() {
        const out = this.output('{"mode":1}', { type: "string", enum: ["off", "auto", "manual"] }, [
            { "map:proc": "pick", "jsonv:path": "/mode" },
            { "map:proc": "enum", "map:map": modeMap },
        ]);
        expect(await out.value()).to.equal("auto");
    }

    @test async "should reject a mapped value that violates the DataSchema"() {
        const out = this.output("90", { type: "string", enum: ["low", "medium"] }, [
            { "map:proc": "enumRange", "map:ranges": batteryRanges },
        ]);
        await out.value().then(
            () => expect.fail("expected schema validation to fail"),
            (err: Error) => expect(err.message).to.contain("Invalid value according to DataSchema")
        );
    }
}

const enumStep = { "map:proc": "enum", "map:map": modeMap };

function octetForm(extra: Record<string, unknown> = {}, contentType = "application/octet-stream") {
    return {
        href: "modbus+tcp://127.0.0.1:502/1/0",
        contentType,
        "map:valueMapping": { "map:fromWire": [enumStep] },
        ...extra,
    };
}

@suite("testing wire decoding for mapped octet-streams")
class WireDecodingTests {
    @test "is not used without a fromWire mapping"() {
        const form = { href: "x", contentType: "application/octet-stream" };
        expect(getWireDecoding(form, "application/octet-stream")).to.be.undefined;
        expect(getWireDecoding({ ...form, "map:valueMapping": { "map:toWire": [] } }, "application/octet-stream")).to.be
            .undefined;
    }

    @test "is not used for content types the schema does not drive"() {
        expect(getWireDecoding(octetForm(), "application/json")).to.be.undefined;
        expect(getWireDecoding(octetForm(), "text/csv")).to.be.undefined;
    }

    @test "decodes as an unsigned integer by default"() {
        expect(getWireDecoding(octetForm(), "application/octet-stream")).to.deep.equal({
            contentType: "application/octet-stream;signed=false",
            schema: { type: "integer" },
        });
    }

    @test "keeps content type parameters that are already declared"() {
        const result = getWireDecoding(
            octetForm({ "octv:byteLength": 2, "octv:byteOrder": "bigEndian" }),
            "application/octet-stream;signed=true;length=4;byteSeq=LITTLE_ENDIAN"
        );
        expect(result?.contentType).to.equal("application/octet-stream;signed=true;length=4;byteSeq=LITTLE_ENDIAN");
    }

    @test "translates octv byte layout terms to content type parameters"() {
        const be = getWireDecoding(
            octetForm({ "octv:byteLength": 4, "octv:byteOrder": "bigEndian" }),
            "application/octet-stream"
        );
        expect(be?.contentType).to.equal("application/octet-stream;signed=false;length=4;byteSeq=BIG_ENDIAN");
        const le = getWireDecoding(octetForm({ "octv:byteOrder": "littleEndian" }), "application/octet-stream");
        expect(le?.contentType).to.equal("application/octet-stream;signed=false;byteSeq=LITTLE_ENDIAN");
    }

    @test "rejects invalid or unsupported octv terms"() {
        const decode = (extra: Record<string, unknown>) => () =>
            getWireDecoding(octetForm(extra), "application/octet-stream");
        expect(decode({ "octv:byteLength": 0 })).to.throw("positive integer");
        expect(decode({ "octv:byteLength": "2" })).to.throw("positive integer");
        expect(decode({ "octv:byteOrder": "middle" })).to.throw("octv:byteOrder");
        expect(decode({ "octv:byteOffset": 2 })).to.throw("octv:byteOffset");
        expect(decode({ "octv:byteOffset": 0 })).not.to.throw();
    }
}

@suite("testing mapped octet-stream reads through InteractionOutput")
class OctetStreamInteractionOutputTests {
    private output(bytes: number[], form: Record<string, unknown>, schema: Record<string, unknown>) {
        const content = new Content(form.contentType as string, Readable.from([Buffer.from(bytes)]));
        return new InteractionOutput(content, form, schema);
    }

    private static readonly modeSchema = { type: "string", enum: ["off", "auto", "manual"] };

    @test async "should decode a register as wire integer and map it to the string enum"() {
        const out = this.output([0x00, 0x02], octetForm(), OctetStreamInteractionOutputTests.modeSchema);
        expect(await out.value()).to.equal("manual");
    }

    @test async "should honour octv byte order and length"() {
        const form = octetForm({ "octv:byteLength": 2, "octv:byteOrder": "littleEndian" });
        const out = this.output([0x01, 0x00], form, OctetStreamInteractionOutputTests.modeSchema);
        expect(await out.value()).to.equal("auto");
    }

    @test async "should decode multi-register words as unsigned"() {
        const form = octetForm({
            "map:valueMapping": {
                "map:fromWire": [
                    {
                        "map:proc": "enumRange",
                        "map:ranges": [{ "map:min": 0, "map:max": 4294967295, "map:app": "any" }],
                    },
                ],
            },
        });
        const out = this.output([0xff, 0xff, 0xff, 0xff], form, { type: "string" });
        expect(await out.value()).to.equal("any");
    }

    @test async "should decode unsigned unless the content type asks for signed"() {
        const unsigned = this.output([0xff, 0xff], octetForm(), OctetStreamInteractionOutputTests.modeSchema);
        await unsigned.value().then(
            () => expect.fail("expected 65535 to have no enum entry"),
            (err: Error) => expect(err.message).to.contain("No enum entry matches '65535'")
        );

        const signedForm = octetForm({}, "application/octet-stream;signed=true");
        const signed = this.output([0xff, 0xff], signedForm, OctetStreamInteractionOutputTests.modeSchema);
        await signed.value().then(
            () => expect.fail("expected -1 to have no enum entry"),
            (err: Error) => expect(err.message).to.contain("No enum entry matches '-1'")
        );
    }

    @test async "should reject a payload that does not match octv:byteLength"() {
        const form = octetForm({ "octv:byteLength": 4 });
        const out = this.output([0x00, 0x02], form, OctetStreamInteractionOutputTests.modeSchema);
        await out.value().then(
            () => expect.fail("expected a length mismatch"),
            (err: Error) => expect(err.message).to.contain("Lengths do not match")
        );
    }

    @test async "should leave unmapped octet-stream forms decoded with the application schema"() {
        const form = { href: "x", contentType: "application/octet-stream;length=2;signed=false" };
        const out = this.output([0x01, 0x00], form, { type: "integer" });
        expect(await out.value()).to.equal(256);
    }
}

const flagFields = [
    { "octv:fieldName": "alarm", "octv:mask": 1, "octv:shift": 0, "octv:fieldType": "boolean" },
    { "octv:fieldName": "running", "octv:mask": 2, "octv:shift": 1, "octv:fieldType": "boolean" },
    { "octv:fieldName": "mode", "octv:mask": 12, "octv:shift": 2, "octv:fieldType": "integer" },
];

@suite("testing data mapping bitExtract operation")
class BitExtractTests {
    @test "bitExtract decomposes an integer into named boolean and integer fields"() {
        const step = { "map:proc": "bitExtract", "octv:fields": flagFields };
        expect(fromWire(0b0111, step)).to.deep.equal({ alarm: true, running: true, mode: 1 });
        expect(fromWire(0b1010, step)).to.deep.equal({ alarm: false, running: true, mode: 2 });
        expect(fromWire(0, step)).to.deep.equal({ alarm: false, running: false, mode: 0 });
    }

    @test "bitExtract defaults the field type to integer"() {
        const fields = [{ "octv:fieldName": "low", "octv:mask": 3, "octv:shift": 0 }];
        expect(fromWire(6, { "map:proc": "bitExtract", "octv:fields": fields })).to.deep.equal({ low: 2 });
    }

    @test "bitExtract treats a multi-bit boolean field as set when any bit is set"() {
        const fields = [{ "octv:fieldName": "any", "octv:mask": 12, "octv:shift": 2, "octv:fieldType": "boolean" }];
        const step = { "map:proc": "bitExtract", "octv:fields": fields };
        expect(fromWire(4, step)).to.deep.equal({ any: true });
        expect(fromWire(3, step)).to.deep.equal({ any: false });
    }

    @test "bitExtract handles bits above the signed 32-bit range"() {
        const fields = [
            { "octv:fieldName": "top", "octv:mask": 2147483648, "octv:shift": 31, "octv:fieldType": "boolean" },
            { "octv:fieldName": "above", "octv:mask": 4294967296, "octv:shift": 32, "octv:fieldType": "boolean" },
            { "octv:fieldName": "mid", "octv:mask": 2130706432, "octv:shift": 24, "octv:fieldType": "integer" },
        ];
        const step = { "map:proc": "bitExtract", "octv:fields": fields };
        expect(fromWire(0x80000000, step)).to.deep.equal({ top: true, above: false, mid: 0 });
        expect(fromWire(0x1ffffffff, step)).to.deep.equal({ top: true, above: true, mid: 0x7f });
    }

    @test "bitExtract accepts non-contiguous fields that leave bits unused"() {
        const fields = [
            { "octv:fieldName": "a", "octv:mask": 16777216, "octv:shift": 24, "octv:fieldType": "boolean" },
            { "octv:fieldName": "b", "octv:mask": 1, "octv:shift": 0, "octv:fieldType": "boolean" },
        ];
        expect(fromWire(0x0e00ff00, { "map:proc": "bitExtract", "octv:fields": fields })).to.deep.equal({
            a: false,
            b: false,
        });
        expect(fromWire(0x01000001, { "map:proc": "bitExtract", "octv:fields": fields })).to.deep.equal({
            a: true,
            b: true,
        });
    }

    @test "bitExtract rejects input that is not a non-negative safe integer"() {
        const step = { "map:proc": "bitExtract", "octv:fields": flagFields };
        for (const input of [-1, 1.5, "3", null, true, { a: 1 }, Number.NaN, 2 ** 53]) {
            expect(() => fromWire(input, step), String(input)).to.throw("non-negative integer input");
        }
    }

    @test "bitExtract rejects invalid field tables even for valid input"() {
        const step = (fields: unknown) => ({ "map:proc": "bitExtract", "octv:fields": fields });
        const field = { "octv:fieldName": "a", "octv:mask": 1, "octv:shift": 0 };
        expect(() => fromWire(1, { "map:proc": "bitExtract" })).to.throw("non-empty array");
        expect(() => fromWire(1, step([]))).to.throw("non-empty array");
        expect(() => fromWire(1, step([3]))).to.throw("must be objects");
        expect(() => fromWire(1, step([{ ...field, "octv:fieldName": "" }]))).to.throw("octv:fieldName");
        expect(() => fromWire(1, step([{ ...field, "octv:fieldName": "__proto__" }]))).to.throw("octv:fieldName");
        expect(() => fromWire(1, step([{ ...field, "octv:fieldName": 1 }]))).to.throw("octv:fieldName");
        expect(() => fromWire(1, step([field, field]))).to.throw("duplicate octv:fieldName 'a'");
        expect(() => fromWire(1, step([{ ...field, "octv:mask": 0 }]))).to.throw("positive safe integer");
        expect(() => fromWire(1, step([{ ...field, "octv:mask": -1 }]))).to.throw("positive safe integer");
        expect(() => fromWire(1, step([{ ...field, "octv:mask": 1.5 }]))).to.throw("positive safe integer");
        expect(() => fromWire(1, step([{ ...field, "octv:mask": "1" }]))).to.throw("positive safe integer");
        expect(() => fromWire(1, step([{ ...field, "octv:mask": 2 ** 53 }]))).to.throw("positive safe integer");
        expect(() => fromWire(1, step([{ ...field, "octv:shift": -1 }]))).to.throw("non-negative integer");
        expect(() => fromWire(1, step([{ ...field, "octv:shift": 0.5 }]))).to.throw("non-negative integer");
        const withoutShift: Record<string, unknown> = { ...field };
        delete withoutShift["octv:shift"];
        expect(() => fromWire(1, step([withoutShift]))).to.throw("non-negative integer");
        expect(() => fromWire(1, step([{ ...field, "octv:fieldType": "float" }]))).to.throw("octv:fieldType 'float'");
    }

    @test "bitExtract rejects overlapping masks and shifts that drop mask bits"() {
        const step = (fields: unknown) => ({ "map:proc": "bitExtract", "octv:fields": fields });
        expect(() =>
            fromWire(
                1,
                step([
                    { "octv:fieldName": "a", "octv:mask": 3, "octv:shift": 0 },
                    { "octv:fieldName": "b", "octv:mask": 2, "octv:shift": 1 },
                ])
            )
        ).to.throw("overlapping");
        expect(() => fromWire(1, step([{ "octv:fieldName": "a", "octv:mask": 12, "octv:shift": 3 }]))).to.throw(
            "larger than its mask's lowest bit"
        );
        // a shift below the lowest bit is permitted and keeps the low bits zero
        expect(fromWire(12, step([{ "octv:fieldName": "a", "octv:mask": 12, "octv:shift": 0 }]))).to.deep.equal({
            a: 12,
        });
    }

    @test "bitExtract composes with enum on one extracted member"() {
        const result = fromWire(
            0b1000,
            { "map:proc": "bitExtract", "octv:fields": flagFields },
            { "map:proc": "enum", "map:name": "mode", "map:map": modeMap }
        );
        expect(result).to.deep.equal({ alarm: false, running: false, mode: "manual" });
    }
}

@suite("testing bitExtract on mapped octet-streams through InteractionOutput")
class BitExtractInteractionOutputTests {
    private static readonly schema = {
        type: "object",
        properties: { alarm: { type: "boolean" }, running: { type: "boolean" }, mode: { type: "integer" } },
        required: ["alarm", "running", "mode"],
    };

    private output(bytes: number[], extra: Record<string, unknown> = {}) {
        const form = {
            href: "modbus+tcp://127.0.0.1:502/1/0",
            contentType: "application/octet-stream",
            "map:valueMapping": { "map:fromWire": [{ "map:proc": "bitExtract", "octv:fields": flagFields }] },
            ...extra,
        };
        const content = new Content(form.contentType, Readable.from([Buffer.from(bytes)]));
        return new InteractionOutput(content, form, BitExtractInteractionOutputTests.schema);
    }

    @test async "should expose the extracted fields of a 16-bit register"() {
        const out = this.output([0x00, 0b0111]);
        expect(await out.value()).to.deep.equal({ alarm: true, running: true, mode: 1 });
    }

    @test async "should honour octv byte order when decoding the word"() {
        const out = this.output([0b0110, 0x00], { "octv:byteLength": 2, "octv:byteOrder": "littleEndian" });
        expect(await out.value()).to.deep.equal({ alarm: false, running: true, mode: 1 });
    }

    @test async "should reject extracted values that violate the DataSchema"() {
        const out = this.output([0x00, 0x01], {
            "map:valueMapping": {
                "map:fromWire": [
                    {
                        "map:proc": "bitExtract",
                        "octv:fields": [{ "octv:fieldName": "alarm", "octv:mask": 1, "octv:shift": 0 }],
                    },
                ],
            },
        });
        await out.value().then(
            () => expect.fail("expected schema validation to fail"),
            (err: Error) => expect(err.message).to.contain("Invalid value according to DataSchema")
        );
    }
}
