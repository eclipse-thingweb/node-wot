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

import { exist } from "should";
import { expect } from "chai";

import { ContentSerdes, Helpers, ObjectSchema, createLoggers } from "@node-wot/core";

import { DataValue } from "node-opcua-data-value";
import { DataType, VariantArrayType } from "node-opcua-variant";
import { coerceLocalizedText } from "node-opcua-data-model";
import { DataValueJSON, JsonEncoderMode, opcuaJsonEncodeDataValue } from "node-opcua-json/104";
import { StatusCodes } from "node-opcua-status-code";

import { OpcuaBinaryCodec, OpcuaJSONCodec, theOpcuaBinaryCodec, theOpcuaJSONCodec } from "../src/codec";

const { debug } = createLoggers("binding-opcua", "opcua-codec-test");

const dataValue1 = new DataValue({});
const dataValue2 = new DataValue({
    // serverTimestamp: new Date(),

    statusCode: StatusCodes.Good,
    sourceTimestamp: new Date(Date.UTC(2021, 10, 11)),
    // sourcePicoseconds: 100,
    value: {
        dataType: DataType.String,
        arrayType: VariantArrayType.Array,
        value: ["hello", "world"],
    },
});
const dataValue3 = new DataValue({
    value: {
        dataType: DataType.LocalizedText,
        value: [coerceLocalizedText("a"), coerceLocalizedText("b")],
    },
});

const dataValue1Json = Helpers.structuredClone(opcuaJsonEncodeDataValue(dataValue1, JsonEncoderMode.Reversible, []));
const dataValue2Json = Helpers.structuredClone(opcuaJsonEncodeDataValue(dataValue2, JsonEncoderMode.Reversible, []));
const dataValue3Json = Helpers.structuredClone(opcuaJsonEncodeDataValue(dataValue3, JsonEncoderMode.Reversible, []));

describe("OPCUA Binary Serdes ", () => {
    [dataValue1Json, dataValue2Json, dataValue3Json].forEach((dataValue, index) => {
        //
        const schema: ObjectSchema = { type: "object", properties: {} };

        it("should encode and decode a dataValue with application/opcua+binary codec " + index, () => {
            const payload = theOpcuaBinaryCodec.valueToBytes(dataValue as DataValue | DataValueJSON, schema);
            const dataValueReloaded = theOpcuaBinaryCodec.bytesToValue(payload, schema);
            expect(dataValue).to.eql(Helpers.structuredClone(dataValueReloaded));
        });
    });
});

describe("OPCUA JSON Serdes ", () => {
    [dataValue1Json, dataValue2Json, dataValue3Json].forEach((dataValue, index) => {
        const schema: ObjectSchema = { type: "object", properties: {} };

        it("should encode and decode a dataValue with application/opcua+json codec " + index, () => {
            const payload = theOpcuaJSONCodec.valueToBytes(dataValue, schema);
            const dataValueReloaded = theOpcuaJSONCodec.bytesToValue(payload, schema);
            expect(dataValue).to.eql(Helpers.structuredClone(dataValueReloaded));
        });
    });
    const expected1 = [
        { Value: null },
        { Value: { Type: 12, Body: ["hello", "world"] }, SourceTimestamp: "2021-11-11T00:00:00.000Z" },
        { Value: { Type: 21, Body: [{ Text: "a" }, { Text: "b" }] } },
    ];
    [dataValue1, dataValue2, dataValue3].forEach((dataValue, index) => {
        it(
            "should simplify  serialize deserialize with application/opcua+json;type=DataValue  (index = " +
                index +
                ")",
            async () => {
                const serdes = ContentSerdes.get();
                serdes.addCodec(new OpcuaJSONCodec());
                serdes.addCodec(new OpcuaBinaryCodec());

                const schema: WoT.DataSchema = {};
                const contentType = "application/opcua+json;type=DataValue";
                exist(ContentSerdes.getMediaType(contentType));
                const payload = serdes.valueToContent(dataValue, schema, contentType);
                const body = await payload.toBuffer();
                debug(body.toString("ascii"));
                JSON.parse(body.toString()).should.eql(expected1[index]);
            }
        );
        const expected2 = [
            "null",
            '{"Type":12,"Body":["hello","world"]}',
            '{"Type":21,"Body":[{"Text":"a"},{"Text":"b"}]}',
        ];
        it("should serialize deserialize with application/opcua+json;type=Variant" + index, async () => {
            const serdes = ContentSerdes.get();
            serdes.addCodec(new OpcuaJSONCodec());
            serdes.addCodec(new OpcuaBinaryCodec());

            const schema: WoT.DataSchema = {};
            const contentType = "application/opcua+json;type=Variant";
            exist(ContentSerdes.getMediaType(contentType));
            const payload = serdes.valueToContent(dataValue, schema, contentType);
            const body = await payload.toBuffer();
            debug(body.toString("ascii"));
            body.toString().should.eql(expected2[index]);
        });
    });
});

describe("OPCUA JSON Serdes, field names of OPC 10000-6 (Dimensions, Status)", () => {
    // node-opcua used UaDimensions/UaStatus (1.05) and StatusCode (1.04) before aligning on
    // Part 6, which names them Dimensions and Status in both editions. The schemas that
    // guard the DataValue body must accept the old and the new spelling.
    const schema: ObjectSchema = { type: "object", properties: {} };
    const decode = (body: unknown, parameters: { [key: string]: string }) =>
        theOpcuaJSONCodec.bytesToValue(Buffer.from(JSON.stringify(body)), schema, parameters) as Record<
            string,
            unknown
        >;

    const params105 = { type: "DataValue", version: "1.05" };
    const params104 = { type: "DataValue" };

    it("accepts Dimensions on a 1.05 matrix", () => {
        const result = decode({ UaType: 11, Value: [1, 2, 3, 4, 5, 6], Dimensions: [2, 3] }, params105);
        expect(result).to.have.property("UaType", 11);
    });

    it("still accepts UaDimensions on a 1.05 matrix", () => {
        const result = decode({ UaType: 11, Value: [1, 2, 3, 4, 5, 6], UaDimensions: [2, 3] }, params105);
        expect(result).to.have.property("UaType", 11);
    });

    it("accepts Status on a 1.05 DataValue", () => {
        const result = decode({ UaType: 11, Value: 1.5, Status: 0x40000000 }, params105);
        expect(result).to.have.property("UaType", 11);
    });

    it("refuses a negative Status on a 1.05 DataValue", () => {
        expect(() => decode({ UaType: 11, Value: 1.5, Status: -1 }, params105)).to.throw(/Invalid JSON dataValue/);
    });

    it("accepts Status on a 1.04 DataValue, and keeps reading it as 1.04", () => {
        const result = decode({ Value: { Type: 11, Body: 1.5 }, Status: 0 }, params104);
        // Status is shared by both editions, so it must not flip the edition to 1.05
        expect(result.Value).to.have.property("Type", 11);
        expect(result).to.not.have.property("UaType");
    });

    it("still accepts StatusCode on a 1.04 DataValue", () => {
        const result = decode({ Value: { Type: 11, Body: 1.5 }, StatusCode: 0 }, params104);
        expect(result.Value).to.have.property("Type", 11);
    });

    it("still accepts UaStatus on a 1.05 DataValue", () => {
        const result = decode({ UaType: 11, Value: 1.5, UaStatus: 0 }, params105);
        expect(result).to.have.property("UaType", 11);
    });

    it("refuses an unknown field", () => {
        expect(() => decode({ UaType: 11, Value: 1.5, Bogus: 1 }, params105)).to.throw(/Invalid JSON dataValue/);
    });
});
