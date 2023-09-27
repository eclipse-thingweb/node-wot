/* eslint-disable @typescript-eslint/ban-ts-comment */
/********************************************************************************
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
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

/**
 * Tests for ContentSerdes functionality
 */

import { suite, test } from "@testdeck/mocha";
import { expect, should } from "chai";
import { DataSchemaValue } from "wot-typescript-definitions";
import cbor from "cbor";

import ContentSerdes, { ContentCodec } from "../src/content-serdes";
import { Endianness } from "../src/protocol-interfaces";
// should must be called to augment all variables
should();

const checkJsonToJs = (value: unknown): void => {
    const jsonBuffer = Buffer.from(JSON.stringify(value));
    expect(
        ContentSerdes.contentToValue({ type: "application/json", body: jsonBuffer }, { type: "object", properties: {} })
    ).to.deep.equal(value);
};

const checkJsToJson = async (value: DataSchemaValue) => {
    const jsonContent = ContentSerdes.valueToContent(value, { type: "object", properties: {} });
    const body = await jsonContent.toBuffer();
    const reparsed = JSON.parse(body.toString());
    expect(reparsed).to.deep.equal(value);
};

const checkCborToJs = (value: unknown): void => {
    const cborBuffer = Buffer.from(cbor.encode(value));
    expect(
        ContentSerdes.contentToValue({ type: "application/cbor", body: cborBuffer }, { type: "object", properties: {} })
    ).to.deep.equal(value);
};

const checkJsToCbor = async (value: DataSchemaValue) => {
    const cborContent = ContentSerdes.valueToContent(value, { type: "object", properties: {} }, "application/cbor");
    const body = await cborContent.toBuffer();
    const reparsed = cbor.decode(body);
    expect(reparsed).to.deep.equal(value);
};

const checkStreamToValue = (value: number[], match: unknown, type: string, endianness?: string): void => {
    const octectBuffer = Buffer.from(value);
    expect(
        ContentSerdes.contentToValue(
            {
                type: `application/octet-stream${endianness != null ? `;byteSeq=${endianness}` : ""}`,
                body: octectBuffer,
            },
            { type: type ?? "integer", properties: {} }
        )
    ).to.deep.equal(match);
};

/** Hodor will always return the String "Hodor" */
class HodorCodec implements ContentCodec {
    getMediaType(): string {
        return "text/hodor";
    }

    bytesToValue(): string {
        return "Hodor";
    }

    valueToBytes(): Buffer {
        return Buffer.from("Hodor");
    }
}

@suite("testing OctectStream codec")
class SerdesOctetTests {
    @test "OctetStream to value"() {
        checkStreamToValue([0x36, 0x30], 13872, "uint16");
        checkStreamToValue([0x36, 0x30], 13872, "uint16", Endianness.BIG_ENDIAN);
        checkStreamToValue([0x30, 0x36], 13872, "uint16", Endianness.LITTLE_ENDIAN);
        checkStreamToValue([0x49, 0x91, 0xa1, 0xc2], 1234280898, "int32");
        checkStreamToValue([0x49, 0x91, 0xa1, 0xc2], 1234280898, "int32", Endianness.BIG_ENDIAN);
        checkStreamToValue([0xc2, 0xa1, 0x91, 0x49], 1234280898, "int32", Endianness.LITTLE_ENDIAN);
        checkStreamToValue([0xa1, 0xc2, 0x49, 0x91], 1234280898, "int32", Endianness.LITTLE_ENDIAN_BYTE_SWAP);
        checkStreamToValue([0x91, 0x49, 0xc2, 0xa1], 1234280898, "int32", Endianness.BIG_ENDIAN_BYTE_SWAP);
        checkStreamToValue([0x3d, 0xd6, 0xea, 0xfc], 0.10494038462638855, "float32");
        checkStreamToValue([0x3d, 0xd6, 0xea, 0xfc], 0.10494038462638855, "float32", Endianness.BIG_ENDIAN);
        checkStreamToValue([0xfc, 0xea, 0xd6, 0x3d], 0.10494038462638855, "float32", Endianness.LITTLE_ENDIAN);
        checkStreamToValue([0xd6, 0x3d, 0xfc, 0xea], 0.10494038462638855, "float32", Endianness.BIG_ENDIAN_BYTE_SWAP);
        checkStreamToValue(
            [0xea, 0xfc, 0x3d, 0xd6],
            0.10494038462638855,
            "float32",
            Endianness.LITTLE_ENDIAN_BYTE_SWAP
        );
        checkStreamToValue([0x49, 0x25], 18725, "int16");
        checkStreamToValue([0x49, 0x25], 18725, "int16", Endianness.BIG_ENDIAN);
        checkStreamToValue([0x25, 0x49], 18725, "int16", Endianness.LITTLE_ENDIAN);
        checkStreamToValue([0x49, 0x25], 18725, "integer");
        checkStreamToValue([0x49, 0x25], 18725, "integer", Endianness.BIG_ENDIAN);
        checkStreamToValue([0x25, 0x49], 18725, "integer", Endianness.LITTLE_ENDIAN);
        checkStreamToValue([0xa4, 0x78], -23432, "int16");
        checkStreamToValue([0xa4, 0x78], -23432, "int16", Endianness.BIG_ENDIAN);
        checkStreamToValue([0x78, 0xa4], -23432, "int16", Endianness.LITTLE_ENDIAN);
        checkStreamToValue([0xeb, 0xe6, 0x90, 0x49], -5.5746861179443064e26, "number");
        checkStreamToValue([0xeb, 0xe6, 0x90, 0x49], -5.5746861179443064e26, "number", Endianness.BIG_ENDIAN);
        checkStreamToValue([0x49, 0x90, 0xe6, 0xeb], -5.5746861179443064e26, "number", Endianness.LITTLE_ENDIAN);
        checkStreamToValue([0xe6, 0xeb, 0x49, 0x90], -5.5746861179443064e26, "number", Endianness.BIG_ENDIAN_BYTE_SWAP);
        checkStreamToValue(
            [0x90, 0x49, 0xeb, 0xe6],
            -5.5746861179443064e26,
            "number",
            Endianness.LITTLE_ENDIAN_BYTE_SWAP
        );
        checkStreamToValue([0x44, 0x80], 4.5, "float16");
        checkStreamToValue([0x44, 0x80], 4.5, "float16", Endianness.BIG_ENDIAN);
        checkStreamToValue([0x80, 0x44], 4.5, "float16", Endianness.LITTLE_ENDIAN);
        checkStreamToValue([0xeb, 0xe6, 0x90, 0x49], -5.5746861179443064e26, "float32");
        checkStreamToValue([0xeb, 0xe6, 0x90, 0x49], -5.5746861179443064e26, "float32", Endianness.BIG_ENDIAN);
        checkStreamToValue([0x49, 0x90, 0xe6, 0xeb], -5.5746861179443064e26, "float32", Endianness.LITTLE_ENDIAN);
        checkStreamToValue(
            [0xe6, 0xeb, 0x49, 0x90],
            -5.5746861179443064e26,
            "float32",
            Endianness.BIG_ENDIAN_BYTE_SWAP
        );
        checkStreamToValue(
            [0x90, 0x49, 0xeb, 0xe6],
            -5.5746861179443064e26,
            "float32",
            Endianness.LITTLE_ENDIAN_BYTE_SWAP
        );
        checkStreamToValue([0xd3, 0xcd, 0xcc, 0xcc, 0xc1, 0xb4, 0x82, 0x70], -4.9728447076484896e95, "float64");
        checkStreamToValue(
            [0xd3, 0xcd, 0xcc, 0xcc, 0xc1, 0xb4, 0x82, 0x70],
            -4.9728447076484896e95,
            "float64",
            Endianness.BIG_ENDIAN
        );
        checkStreamToValue(
            [0x70, 0x82, 0xb4, 0xc1, 0xcc, 0xcc, 0xcd, 0xd3],
            -4.9728447076484896e95,
            "float64",
            Endianness.LITTLE_ENDIAN
        );
    }

    @test async "value to OctetStream"() {
        let content = ContentSerdes.valueToContent(2345, { type: "integer" }, "application/octet-stream");
        let body = await content.toBuffer();
        expect(body).to.deep.equal(Buffer.from([0x00, 0x00, 0x09, 0x29]));
        // should default to signed
        content = ContentSerdes.valueToContent(-2345, { type: "integer" }, "application/octet-stream");
        body = await content.toBuffer();
        expect(body).to.deep.equal(Buffer.from([0xff, 0xff, 0xf6, 0xd7]));

        // @ts-ignore new dataschema types are not yet supported in the td type definitions
        content = ContentSerdes.valueToContent(2345, { type: "int16" }, "application/octet-stream");
        body = await content.toBuffer();
        expect(body).to.deep.equal(Buffer.from([0x09, 0x29]));

        content = ContentSerdes.valueToContent(
            2345,
            { type: "int16" },
            "application/octet-stream;byteSeq=LITTLE_ENDIAN"
        );
        body = await content.toBuffer();
        expect(body).to.deep.equal(Buffer.from([0x29, 0x09]));

        // @ts-ignore new dataschema types are not yet supported in the td type definitions
        content = ContentSerdes.valueToContent(10, { type: "int8" }, "application/octet-stream");
        body = await content.toBuffer();
        expect(body).to.deep.equal(Buffer.from([0x0a]));

        // should serialize a number as a float16
        // @ts-ignore new dataschema types are not yet supported in the td type definitions
        content = ContentSerdes.valueToContent(4.5, { type: "float16" }, "application/octet-stream");
        body = await content.toBuffer();
        expect(body).to.deep.equal(Buffer.from([0x44, 0x80]));

        content = ContentSerdes.valueToContent(
            4.5,
            { type: "float16" },
            "application/octet-stream;byteSeq=LITTLE_ENDIAN"
        );
        body = await content.toBuffer();
        expect(body).to.deep.equal(Buffer.from([0x80, 0x44]));
    }

    @test "value to OctetStream should throw"() {
        // @ts-ignore new dataschema types are not yet supported in the td type definitions
        expect(() => ContentSerdes.valueToContent(2345, { type: "int8" }, "application/octet-stream")).to.throw(
            Error,
            "Integer overflow when representing signed 2345 in 1 byte(s)"
        );
        // @ts-ignore new dataschema types are not yet supported in the td type definitions
        expect(() => ContentSerdes.valueToContent(23450000, { type: "int16" }, "application/octet-stream")).to.throw(
            Error,
            "Integer overflow when representing signed 23450000 in 2 byte(s)"
        );
        expect(() => ContentSerdes.valueToContent(2345, undefined, "application/octet-stream")).to.throw(
            Error,
            "Unable to handle dataType undefined"
        );
    }
}

@suite("testing JSON codec")
class JsonSerdesTests {
    @test "JSON to value"() {
        checkJsonToJs(42);
        checkJsonToJs("Hallo");
        checkJsonToJs(null);
        checkJsonToJs({ foo: "bar" });
        checkJsonToJs({ answer: 42 });
        checkJsonToJs({ pi: 3.14 });
    }

    @test async "value to JSON"() {
        await checkJsToJson(42);
        await checkJsToJson("Hallo");
        await checkJsToJson(null);
        await checkJsToJson({ foo: "bar" });
        await checkJsToJson({ answer: 42 });
        await checkJsToJson({ pi: 3.14 });
    }
}

@suite("testing CBOR codec")
class CborSerdesTests {
    @test "CBOR to value"() {
        checkCborToJs(42);
        checkCborToJs("Hallo");
        checkCborToJs(null);
        checkCborToJs({ foo: "bar" });
        checkCborToJs({ answer: 42 });
        checkCborToJs({ pi: 3.14 });
    }

    @test async "value to CBOR"() {
        await checkJsToCbor(42);
        await checkJsToCbor("Hallo");
        await checkJsToCbor(null);
        await checkJsToCbor({ foo: "bar" });
        await checkJsToCbor({ answer: 42 });
        await checkJsToCbor({ pi: 3.14 });
    }
}

@suite("adding new codec")
class SerdesCodecTests {
    static before() {
        ContentSerdes.addCodec(new HodorCodec());
    }

    @test async "new codec should serialize"() {
        const content = ContentSerdes.valueToContent("The meaning of Life", { type: "string" }, "text/hodor");
        const body = await content.toBuffer();
        body.toString().should.equal("Hodor");
    }

    @test "new codec should deserialize"() {
        const buffer = Buffer.from("Some actual meaningful stuff");
        expect(ContentSerdes.contentToValue({ type: "text/hodor", body: buffer }, { type: "string" })).to.be.deep.equal(
            "Hodor"
        );
    }
}
