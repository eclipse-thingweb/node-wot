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

// What a write sends to the server, from what an application gives: the value is converted to
// the DataType of the target without loss, or refused with an error; never written as garbage.
// The payload is built by the codec, as core does before handing it to the binding.

import { expect } from "chai";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";

import { theOpcuaUABinaryCodec } from "../src/codec";
import { decodeToDataValue, resolveContentFormat, viewFormat } from "../src/opcua-content-negotiation";
import { findConnectionContext, registerConnectionContext } from "../src/ua-binary";

const UABINARY = "application/opcua+uabinary";

/** The Variant the binding writes when an application writes `value` to a node of `dataType`. */
function written(value: unknown, dataType: DataType, contentType = UABINARY): Variant {
    const format = resolveContentFormat(contentType);
    const body = theOpcuaUABinaryCodec.valueToBytes(value, undefined, { type: format.parameters.type ?? "Value" });
    return decodeToDataValue(format, body, dataType, "the test node").value;
}

function refused(value: unknown, dataType: DataType, contentType = UABINARY): Error {
    try {
        const variant = written(value, dataType, contentType);
        throw new Error(`expected a refusal, got ${variant.toString()}`);
    } catch (err) {
        if ((err as Error).message.startsWith("expected a refusal")) throw err;
        return err as Error;
    }
}

describe("binding-opcua write conversion", () => {
    describe("the Value view converts without loss, or refuses", () => {
        it("refuses integers out of range for an integer array", () => {
            expect(refused([300, -1], DataType.Byte).message).to.match(/cannot convert .* to Byte/);
            expect(refused([70000], DataType.UInt16).message).to.match(/to UInt16/);
        });

        it("refuses a text that is not a number for a Double array", () => {
            expect(refused(["abc", "1"], DataType.Double).message).to.match(/to Double/);
        });

        it("refuses a fraction or a text for an Int32", () => {
            expect(refused(42.5, DataType.Int32).message).to.match(/to Int32/);
            expect(refused("42abc", DataType.Int32).message).to.match(/to Int32/);
        });

        it("still converts what fits: 42 to an Int32, [1, 255] to a Byte array", () => {
            const int32 = written(42, DataType.Int32);
            expect(int32.dataType).to.equal(DataType.Int32);
            expect(int32.value).to.equal(42);
            const bytes = written([1, 255], DataType.Byte);
            expect(bytes.dataType).to.equal(DataType.Byte);
            expect(Array.from(bytes.value)).to.eql([1, 255]);
        });

        it("writes back the ISO 8601 text that the Value view gives for a DateTime", () => {
            const iso = "2026-01-08T10:00:00.000Z";
            const variant = written(iso, DataType.DateTime);
            expect(variant.dataType).to.equal(DataType.DateTime);
            expect((variant.value as Date).toISOString()).to.equal(iso);
            expect(refused("not a date", DataType.DateTime).message).to.match(/to DateTime/);
        });

        it("refuses nested arrays, which have no dimensions, rather than writing NaN", () => {
            expect(
                refused(
                    [
                        [1, 2],
                        [3, 4],
                    ],
                    DataType.Double
                ).message
            ).to.match(/matrix.*type=Variant/);
        });
    });

    describe("a node of an abstract DataType (BaseDataType, Number) takes the type of the value", () => {
        // findBasicDataType resolves an abstract DataType to DataType.Variant
        it("Value view: 42 is written as the Double it is", () => {
            const variant = written(42, DataType.Variant);
            expect(variant.dataType).to.equal(DataType.Double);
            expect(variant.value).to.equal(42);
        });

        it("Variant view: the UaType given is written", () => {
            const variant = written({ UaType: 6, Value: 42 }, DataType.Variant, `${UABINARY};type=Variant`);
            expect(variant.dataType).to.equal(DataType.Int32);
            expect(variant.value).to.equal(42);
        });

        it("Value view: a value with no OPC UA type is refused", () => {
            expect(refused({ a: 1 }, DataType.Variant).message).to.match(/abstract/);
        });
    });

    describe("the Variant and DataValue views refuse what OPC UA JSON does not recognise", () => {
        const variantView = `${UABINARY};type=Variant`;
        const dataValueView = `${UABINARY};type=DataValue`;

        it("refuses a bare number or text in the Variant view, which looked like UA Binary", () => {
            expect(refused(42, DataType.Double, variantView).message).to.match(/holds no value/);
            expect(refused("hello world!!", DataType.String, variantView).message).to.match(/holds no value/);
        });

        it("refuses a Variant without UaType, and an empty DataValue", () => {
            expect(refused({ Value: 2.5 }, DataType.Double, variantView).message).to.match(/holds no value/);
            expect(refused({}, DataType.Double, dataValueView).message).to.match(/holds no value/);
        });

        it("still writes a Variant given in OPC UA JSON, and an explicit null", () => {
            expect(written({ UaType: 11, Value: 2.5 }, DataType.Double, variantView).value).to.equal(2.5);
            expect(written(null, DataType.Double, variantView).dataType).to.equal(DataType.Null);
        });
    });

    describe("action arguments given by value", () => {
        // the codec hands the input object over as JSON, and each argument is decoded alone
        const argument = (value: unknown, dataType: DataType) =>
            decodeToDataValue(viewFormat("value"), Buffer.from(JSON.stringify(value)), dataType, "an argument").value;

        it("converts an Int64 array given as strings", () => {
            const variant = argument(["1", "2"], DataType.Int64);
            expect(variant.dataType).to.equal(DataType.Int64);
            expect(variant.arrayType).to.equal(VariantArrayType.Array);
            expect(variant.value.length).to.equal(2);
        });

        it("decodes a ByteString array from base64, not from the text's bytes", () => {
            const variant = argument(["AQID"], DataType.ByteString);
            expect(Array.from(variant.value[0] as Buffer)).to.eql([1, 2, 3]);
        });

        it("converts a DateTime given as ISO 8601, and refuses a text for a Double", () => {
            expect(argument("2026-01-08T10:00:00.000Z", DataType.DateTime).value).to.be.an.instanceOf(Date);
            expect(() => argument("abc", DataType.Double)).to.throw(/to Double/);
            expect(() => argument({}, DataType.Double)).to.throw(/to Double/);
        });
    });

    describe("the connection context", () => {
        it("keeps the structure definitions when a later call on the session registers none", () => {
            const session = {};
            const dataTypeManager = {} as never;
            const id = registerConnectionContext(session, { namespaceArray: ["a"], dataTypeManager });
            // e.g. readAllProperties: a Double read after the structure, before value() is called
            expect(registerConnectionContext(session, { namespaceArray: ["a", "b"] })).to.equal(id);
            const context = findConnectionContext(id);
            expect(context?.dataTypeManager).to.equal(dataTypeManager);
            expect(context?.namespaceArray).to.eql(["a", "b"]);
        });
    });
});
