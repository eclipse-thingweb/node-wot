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

//
// application/opcua+uabinary on opc.tcp forms: an OPC UA Binary DataValue, whose
// type parameter picks what value() returns.
//

import { expect } from "chai";

import { DataValue } from "node-opcua-data-value";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import { StatusCodes } from "node-opcua-status-code";

import { theOpcuaUABinaryCodec } from "../src/codec";
import { resolveContentFormat } from "../src/opcua-content-negotiation";
import {
    argumentsToVariant,
    decodeUABinaryDataValue,
    encodeUABinaryDataValue,
    isUABinaryDataValue,
} from "../src/ua-binary";

describe("OPC UA Binary codec (application/opcua+uabinary)", () => {
    it("is the codec of application/opcua+uabinary", () => {
        expect(theOpcuaUABinaryCodec.getMediaType()).to.equal("application/opcua+uabinary");
    });

    describe("valueToBytes", () => {
        it("writes a value of built-in type as a DataValue holding only the value", () => {
            // mask 01, type 0b (Double), then 42 as an IEEE double, little-endian
            expect(theOpcuaUABinaryCodec.valueToBytes(42).toString("hex")).to.equal("010b0000000000004540");
        });

        const cases: [string, unknown, DataType, VariantArrayType][] = [
            ["a boolean", true, DataType.Boolean, VariantArrayType.Scalar],
            ["a string", "hello", DataType.String, VariantArrayType.Scalar],
            ["a Buffer", Buffer.from([0xde, 0xad]), DataType.ByteString, VariantArrayType.Scalar],
            ["a Uint8Array", new Uint8Array([1, 2]), DataType.ByteString, VariantArrayType.Scalar],
            ["an array of numbers", [1, 2, 3], DataType.Double, VariantArrayType.Array],
            ["an array of strings", ["a", "b"], DataType.String, VariantArrayType.Array],
        ];
        for (const [label, value, dataType, arrayType] of cases) {
            it(`writes ${label} as ${DataType[dataType]} ${VariantArrayType[arrayType]}`, () => {
                const dataValue = decodeUABinaryDataValue(theOpcuaUABinaryCodec.valueToBytes(value));
                expect(dataValue.value.dataType).to.equal(dataType);
                expect(dataValue.value.arrayType).to.equal(arrayType);
            });
        }

        // the codec runs in core, without a session: what needs the server goes to the
        // binding as JSON
        for (const [label, value] of [
            ["a structure", { Low: 0, High: 10 }],
            ["an action input", { TargetTemperature: 26 }],
            ["an empty array", []],
            ["a mixed array", [1, "a"]],
            ["null", null],
        ] as [string, unknown][]) {
            it(`hands ${label} over as JSON`, () => {
                const bytes = theOpcuaUABinaryCodec.valueToBytes(value);
                expect(isUABinaryDataValue(bytes)).to.equal(false);
                expect(JSON.parse(bytes.toString("utf-8"))).to.deep.equal(value);
            });
        }

        // NodeIds in a Variant or DataValue view need the session's namespace table
        for (const type of ["Variant", "DataValue"]) {
            it(`hands a ${type} view over as JSON, even of a built-in type`, () => {
                const value = { UaType: 11, Value: 42 };
                const bytes = theOpcuaUABinaryCodec.valueToBytes(value, undefined, { type });
                expect(isUABinaryDataValue(bytes)).to.equal(false);
                expect(JSON.parse(bytes.toString("utf-8"))).to.deep.equal(value);
            });
        }
    });

    describe("isUABinaryDataValue", () => {
        it("is true for every DataValue encoding mask, which only uses the six low bits", () => {
            for (let mask = 0; mask < 0x40; mask++) {
                expect(isUABinaryDataValue(Buffer.from([mask])), `mask ${mask}`).to.equal(true);
            }
        });

        it("is false for the first byte of the JSON the codec hands over: {, [ and n", () => {
            for (const json of ["{}", "[]", "null"]) {
                expect(isUABinaryDataValue(Buffer.from(json)), json).to.equal(false);
            }
            expect(isUABinaryDataValue(Buffer.alloc(0))).to.equal(false);
        });
    });

    describe("bytesToValue", () => {
        const sourceTimestamp = new Date(Date.UTC(2026, 9, 19));
        const doubleWithStatus = () =>
            encodeUABinaryDataValue(
                new DataValue({
                    value: { dataType: DataType.Double, value: 299.26 },
                    statusCode: StatusCodes.UncertainLastUsableValue,
                    sourceTimestamp,
                })
            );

        it("type=Value, the default: the value alone", () => {
            expect(theOpcuaUABinaryCodec.bytesToValue(doubleWithStatus())).to.equal(299.26);
            expect(theOpcuaUABinaryCodec.bytesToValue(doubleWithStatus(), undefined, { type: "Value" })).to.equal(
                299.26
            );
        });

        it("type=Variant: the value and its OPC UA type, as OPC UA JSON 1.05 Compact", () => {
            expect(
                theOpcuaUABinaryCodec.bytesToValue(doubleWithStatus(), undefined, { type: "Variant" })
            ).to.deep.equal({
                UaType: 11,
                Value: 299.26,
            });
        });

        it("type=DataValue: the value with its Status and timestamps", () => {
            expect(
                theOpcuaUABinaryCodec.bytesToValue(doubleWithStatus(), undefined, { type: "DataValue" })
            ).to.deep.equal({
                UaType: 11,
                Value: 299.26,
                Status: { Code: StatusCodes.UncertainLastUsableValue.value },
                SourceTimestamp: sourceTimestamp.toISOString(),
            });
        });

        it("gives the value of the Value view, and ignores StatusCode and timestamps", () => {
            const bytes = encodeUABinaryDataValue(
                new DataValue({
                    value: { dataType: DataType.Int64, arrayType: VariantArrayType.Scalar, value: [0x200000, 1] },
                    sourceTimestamp: new Date(Date.UTC(2026, 9, 19)),
                })
            );
            // Int64 is a string in OPC UA JSON: a JSON number cannot hold 2^53 + 1
            expect(theOpcuaUABinaryCodec.bytesToValue(bytes)).to.equal("9007199254740993");
        });

        it("gives action arguments as an object keyed by argument name (uapart=arguments)", () => {
            const bytes = encodeUABinaryDataValue(
                new DataValue({
                    value: argumentsToVariant([
                        ["PreviousSetPoint", new Variant({ dataType: DataType.Double, value: 27 })],
                        ["Names", new Variant({ dataType: DataType.String, value: ["a", "b"] })],
                    ]),
                })
            );
            expect(theOpcuaUABinaryCodec.bytesToValue(bytes, undefined, { uapart: "arguments" })).to.deep.equal({
                PreviousSetPoint: 27,
                Names: ["a", "b"],
            });
        });

        it("refuses an action output that is not KeyValuePair[]", () => {
            const bytes = theOpcuaUABinaryCodec.valueToBytes(1.5);
            expect(() => theOpcuaUABinaryCodec.bytesToValue(bytes, undefined, { uapart: "arguments" })).to.throw(
                /must hold KeyValuePair\[\]/
            );
        });
    });
});

describe("contentType of an opc.tcp form", () => {
    it("takes application/opcua+uabinary, with type=Value, Variant or DataValue", () => {
        expect(resolveContentFormat("application/opcua+uabinary").view).to.equal("value");
        expect(resolveContentFormat("application/opcua+uabinary;type=Variant").view).to.equal("variant");
        expect(resolveContentFormat("application/opcua+uabinary;type=datavalue").view).to.equal("dataValue");
    });

    it("refuses an unknown type", () => {
        expect(() => resolveContentFormat("application/opcua+uabinary;type=Body")).to.throw(
            /Expected one of: Value, Variant, DataValue/
        );
    });

    it("refuses a form without contentType, which TD 1.1 makes application/json", () => {
        expect(() => resolveContentFormat(undefined)).to.throw(/needs contentType 'application\/opcua\+uabinary'/);
    });

    for (const contentType of [
        "application/json",
        "application/octet-stream",
        "application/opcua+octet-stream",
        "application/opcua+json",
        "application/opcua+json;type=Variant",
    ]) {
        it(`refuses ${contentType}`, () => {
            expect(() => resolveContentFormat(contentType)).to.throw(
                `binding-opcua: unsupported contentType '${contentType}'. ` +
                    "Supported: application/opcua+uabinary, with an optional ;type=Value|Variant|DataValue."
            );
        });
    }
});
