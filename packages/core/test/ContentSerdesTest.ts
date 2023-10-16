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

const checkStreamToValue = (value: number[], match: unknown, type: string, schema?: { [key: string]: string | number | undefined }): void => {
    const octectBuffer = Buffer.from(value);
    expect(
        ContentSerdes.contentToValue(
            { type: "application/octet-stream", body: octectBuffer },
            { type: type ?? "integer", properties: {}, ...schema }
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
        checkStreamToValue([0x36, 0x30], 13872, "uint16", {byteSeq: Endianness.BIG_ENDIAN});
        checkStreamToValue([0x30, 0x36], 13872, "uint16", {byteSeq: Endianness.LITTLE_ENDIAN});
        checkStreamToValue([0x49, 0x91, 0xa1, 0xc2], 1234280898, "int32");
        checkStreamToValue([0x49, 0x91, 0xa1, 0xc2], 1234280898, "int32", {byteSeq: Endianness.BIG_ENDIAN});
        checkStreamToValue([0xc2, 0xa1, 0x91, 0x49], 1234280898, "int32", {byteSeq: Endianness.LITTLE_ENDIAN});
        checkStreamToValue([0xa1, 0xc2, 0x49, 0x91], 1234280898, "int32", {byteSeq: Endianness.LITTLE_ENDIAN_BYTE_SWAP});
        checkStreamToValue([0x91, 0x49, 0xc2, 0xa1], 1234280898, "int32", {byteSeq: Endianness.BIG_ENDIAN_BYTE_SWAP});
        checkStreamToValue([0x3d, 0xd6, 0xea, 0xfc], 0.10494038462638855, "float32");
        checkStreamToValue([0x3d, 0xd6, 0xea, 0xfc], 0.10494038462638855, "float32", {byteSeq: Endianness.BIG_ENDIAN});
        checkStreamToValue([0xfc, 0xea, 0xd6, 0x3d], 0.10494038462638855, "float32", {byteSeq: Endianness.LITTLE_ENDIAN});
        checkStreamToValue([0xd6, 0x3d, 0xfc, 0xea], 0.10494038462638855, "float32", {byteSeq: Endianness.BIG_ENDIAN_BYTE_SWAP});
        checkStreamToValue(
            [0xea, 0xfc, 0x3d, 0xd6],
            0.10494038462638855,
            "float32",
            {byteSeq: Endianness.LITTLE_ENDIAN_BYTE_SWAP}
        );
        checkStreamToValue([0x49, 0x25], 18725, "int16");
        checkStreamToValue([0x49, 0x25], 18725, "int16", {byteSeq: Endianness.BIG_ENDIAN});
        checkStreamToValue([0x25, 0x49], 18725, "int16", {byteSeq: Endianness.LITTLE_ENDIAN});
        checkStreamToValue([0x49, 0x25], 18725, "integer");
        checkStreamToValue([0x49, 0x25], 18725, "integer", {byteSeq: Endianness.BIG_ENDIAN});
        checkStreamToValue([0x25, 0x49], 18725, "integer", {byteSeq: Endianness.LITTLE_ENDIAN});
        checkStreamToValue([0xa4, 0x78], -23432, "int16");
        checkStreamToValue([0xa4, 0x78], -23432, "int16", {byteSeq: Endianness.BIG_ENDIAN});
        checkStreamToValue([0x78, 0xa4], -23432, "int16", {byteSeq: Endianness.LITTLE_ENDIAN});
        checkStreamToValue([0xeb, 0xe6, 0x90, 0x49], -5.5746861179443064e26, "number");
        checkStreamToValue([0xeb, 0xe6, 0x90, 0x49], -5.5746861179443064e26, "number", {byteSeq: Endianness.BIG_ENDIAN});
        checkStreamToValue([0x49, 0x90, 0xe6, 0xeb], -5.5746861179443064e26, "number", {byteSeq: Endianness.LITTLE_ENDIAN});
        checkStreamToValue([0xe6, 0xeb, 0x49, 0x90], -5.5746861179443064e26, "number", {byteSeq: Endianness.BIG_ENDIAN_BYTE_SWAP});
        checkStreamToValue(
            [0x90, 0x49, 0xeb, 0xe6],
            -5.5746861179443064e26,
            "number",
            {byteSeq: Endianness.LITTLE_ENDIAN_BYTE_SWAP}
        );
        checkStreamToValue([0x44, 0x80], 4.5, "float16");
        checkStreamToValue([0x44, 0x80], 4.5, "float16", {byteSeq: Endianness.BIG_ENDIAN});
        checkStreamToValue([0x80, 0x44], 4.5, "float16", {byteSeq: Endianness.LITTLE_ENDIAN});
        checkStreamToValue([0xeb, 0xe6, 0x90, 0x49], -5.5746861179443064e26, "float32");
        checkStreamToValue([0xeb, 0xe6, 0x90, 0x49], -5.5746861179443064e26, "float32", {byteSeq: Endianness.BIG_ENDIAN});
        checkStreamToValue([0x49, 0x90, 0xe6, 0xeb], -5.5746861179443064e26, "float32", {byteSeq: Endianness.LITTLE_ENDIAN});
        checkStreamToValue(
            [0xe6, 0xeb, 0x49, 0x90],
            -5.5746861179443064e26,
            "float32",
            {byteSeq: Endianness.BIG_ENDIAN_BYTE_SWAP}
        );
        checkStreamToValue(
            [0x90, 0x49, 0xeb, 0xe6],
            -5.5746861179443064e26,
            "float32",
            {byteSeq: Endianness.LITTLE_ENDIAN_BYTE_SWAP}
        );
        checkStreamToValue([0xd3, 0xcd, 0xcc, 0xcc, 0xc1, 0xb4, 0x82, 0x70], -4.9728447076484896e95, "float64");
        checkStreamToValue(
            [0xd3, 0xcd, 0xcc, 0xcc, 0xc1, 0xb4, 0x82, 0x70],
            -4.9728447076484896e95,
            "float64",
            {byteSeq: Endianness.BIG_ENDIAN}
        );
        checkStreamToValue(
            [0x70, 0x82, 0xb4, 0xc1, 0xcc, 0xcc, 0xcd, 0xd3],
            -4.9728447076484896e95,
            "float64",
            {byteSeq: Endianness.LITTLE_ENDIAN}
        );
        // 0011 0110 0011 0000 -> 0011
        checkStreamToValue([0x36, 0x30], 3, "integer", { 'ex:bitOffset': 0, 'ex:bitLength': 4 });

        // 0011 0000 0011 0110 -> 0011
        checkStreamToValue([0x30, 0x36], 3, "integer", { 'ex:bitOffset': 8, 'ex:bitLength': 4, byteSeq: Endianness.LITTLE_ENDIAN });

        // 0011 0110 0011 0000 -> 0 0110
        checkStreamToValue([0x36, 0x30], 6, "integer", { 'ex:bitOffset': 0, 'ex:bitLength': 5 });

        // 0011 0110 0011 0000 -> 011 0001
        checkStreamToValue([0x36, 0x30], 49, "integer", { 'ex:bitOffset': 4, 'ex:bitLength': 7 });

        // 0011 0110 0011 0000 -> 0110 0011
        checkStreamToValue([0x36, 0x30], 99, "integer", { 'ex:bitOffset': 4, 'ex:bitLength': 8 });

        // 0011 0110 0011 0000 -> 001 1011 0001
        checkStreamToValue([0x36, 0x30], 433, "integer", { 'ex:bitOffset': 0, 'ex:bitLength': 11 });

        // 1110 1011 1110 0110 1001 0000 0100 1001 -> 111 1001 1010 0100 0001
        checkStreamToValue([0xeb, 0xe6, 0x90, 0x49], 498241, "integer", {'ex:bitOffset': 7, 'ex:bitLength': 19});

        // 0011 0110 0011 0000 -> 1101 1000
        checkStreamToValue([0x36, 0x30], 216, "uint8", { 'ex:bitOffset': 2, 'ex:bitLength': 8 });
        checkStreamToValue([0x36, 0x30], 216, "uint8", { 'ex:bitOffset': 2, 'ex:bitLength': 8, byteSeq: Endianness.BIG_ENDIAN });
        // 0011 0000 0011 0110 -> 1100 0000
        checkStreamToValue([0x30, 0x36], 192, "uint8", { 'ex:bitOffset': 2, 'ex:bitLength': 8, byteSeq: Endianness.LITTLE_ENDIAN });

        // 0000 0110 1000 1001 0000 0000 -> 0100 0100 1000 0000
        checkStreamToValue([0x06, 0x89, 0x00], 4.5, "float16", { 'ex:bitOffset': 7, 'ex:bitLength': 16 });

        // 1100 1110 1011 1110 0110 1001 0000 0100 1001 1101 -> 1110 1011 1110 0110 1001 0000 0100 1001
        // CE BE 69 04 9D -> Eb E6 90 49
        checkStreamToValue([0xce, 0xbe, 0x69, 0x04, 0x9d], -5.5746861179443064e26, "float32", { 'ex:bitOffset': 4, 'ex:bitLength': 32 });

        // 0011 1110 1001 1110 0110 1110 0110 0110 0110 0110 0000 1101 1010 0100 0001 0011 1000 0111
        // -> 1101 0011 1100 1101 1100 1100 1100 1100 1100 0001 1011 0100 1000 0010 0111 0000
        // 3E 9E 6E 66 66 0D A4 13 87 -> D3 CD CC CC C1 B4 82 70
        checkStreamToValue([0x3e, 0x9e, 0x6e, 0x66, 0x66, 0x0d, 0xa4, 0x13, 0x87], -4.9728447076484896e95, "float64", { 'ex:bitOffset': 5, 'ex:bitLength': 64 });

        // bit 4 to 36 are the same as a few lines above, so -5.5746861179443064e26 should be the result again
        checkStreamToValue([0xce, 0xbe, 0x69, 0x04, 0x9d], -5.5746861179443064e26, "number", { 'ex:bitOffset': 4, 'ex:bitLength': 32 });

        // Value verified with https://evanw.github.io/float-toy/
        checkStreamToValue([0xFF, 0xFF], 0.00012201070785522461, "number", { 'ex:bitOffset': 2, 'ex:bitLength': 11});

        // 0001 0101 0111 0110 0101 0110 0010 0011 -> 101 0111 0110 0101 0110 0010
        checkStreamToValue([0xf5, 0x76, 0x56, 0x23], "Web", "string", { 'ex:bitOffset': 5, 'ex:bitLength': 23 });
    }

    @test async "OctetStream to value should throw"() {
        expect(() => ContentSerdes.contentToValue({ type: "application/octet-stream", body: Buffer.from([0x36]) }, { type: "int8", 'ex:bitOffset': 3, 'ex:bitLength': 1 })).to.throw(
            Error,
            "Type is 'int8' but 'ex:bitLength' is 1"
        );
        expect(() => ContentSerdes.contentToValue({ type: "application/octet-stream", body: Buffer.from([0x36]) }, { type: "int8", 'ex:bitOffset': 0, 'ex:bitLength': 9 })).to.throw(
            Error,
            "Type is 'int8' but 'ex:bitLength' is 9"
        );
        expect(() => ContentSerdes.contentToValue({ type: "application/octet-stream", body: Buffer.from([0x36]) }, { type: "uint16" })).to.throw(
            Error,
            "Type is 'uint16' but 'ex:bitLength' is 8"
        );
        expect(() => ContentSerdes.contentToValue({ type: "application/octet-stream", body: Buffer.from([0x36, 0x47]) }, { type: "int32" })).to.throw(
            Error,
            "Type is 'int32' but 'ex:bitLength' is 16"
        );
        expect(() => ContentSerdes.contentToValue({ type: "application/octet-stream", body: Buffer.from([0x36]) }, { type: "float64" })).to.throw(
            Error,
            "Type is 'float64' but 'ex:bitLength' is 8"
        );
        expect(() => ContentSerdes.contentToValue({ type: "application/octet-stream", body: Buffer.from([0x36])}, { type: "integer", 'ex:bitOffset': 0, 'ex:bitLength': 9 })).to.throw(
            Error,
            "'ex:bitLength' is 9, but buffer length at offset 0 is 8"
        );
        expect(() => ContentSerdes.contentToValue({ type: "application/octet-stream", body: Buffer.from([0x36])}, { type: "integer", 'ex:bitOffset': 1, 'ex:bitLength': 8 })).to.throw(
            Error,
            "'ex:bitLength' is 8, but buffer length at offset 1 is 7"
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
            { type: "int16", byteSeq: Endianness.LITTLE_ENDIAN },
            "application/octet-stream"
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
            { type: "float16", byteSeq: Endianness.LITTLE_ENDIAN },
            "application/octet-stream"
        );
        body = await content.toBuffer();
        expect(body).to.deep.equal(Buffer.from([0x80, 0x44]));

        content = ContentSerdes.valueToContent(2345, { type: "integer", 'ex:bitLength': 24 }, "application/octet-stream");
        body = await content.toBuffer();
        expect(body).to.deep.equal(Buffer.from([0x00, 0x09, 0x29]));

        content = ContentSerdes.valueToContent(-32768, { type: "integer", 'ex:bitOffset': 0, 'ex:bitLength': 16 }, "application/octet-stream");
        body = await content.toBuffer();
        expect(body).to.deep.equal(Buffer.from([0x80, 0x00]));

        content = ContentSerdes.valueToContent(-32768, { type: "integer", 'ex:bitOffset': 5, 'ex:bitLength': 16}, "application/octet-stream");
        body = await content.toBuffer();
        expect(body).to.deep.equal(Buffer.from([0x04, 0x00, 0x00]));

        content = ContentSerdes.valueToContent(-32767, { type: "integer", 'ex:bitOffset': 5, 'ex:bitLength': 16}, "application/octet-stream");
        body = await content.toBuffer();
        expect(body).to.deep.equal(Buffer.from([0x04, 0x00, 0x08]));

        content = ContentSerdes.valueToContent(-32767, { type: "integer", 'ex:bitOffset': 16, 'ex:bitLength': 16}, "application/octet-stream");
        body = await content.toBuffer();
        expect(body).to.deep.equal(Buffer.from([0x00, 0x00, 0x80, 0x01]));

        content = ContentSerdes.valueToContent(4.5, { type: "float16", 'ex:bitOffset': 16, 'ex:bitLength': 16 }, "application/octet-stream");
        body = await content.toBuffer();
        expect(body).to.deep.equal(Buffer.from([0x00, 0x00, 0x44, 0x80]));

        content = ContentSerdes.valueToContent(-4.9728447076484896e95, { type: "float64", 'ex:bitOffset': 16, 'ex:bitLength': 64 }, "application/octet-stream");
        body = await content.toBuffer();
        expect(body).to.deep.equal(Buffer.from([0x00, 0x00, 0xd3, 0xcd, 0xcc, 0xcc, 0xc1, 0xb4, 0x82, 0x70]));

        content = ContentSerdes.valueToContent("Web", { type: "string", 'ex:bitOffset': 16 }, "application/octet-stream");
        body = await content.toBuffer();
        expect(body).to.deep.equal(Buffer.from([0x00, 0x00, 0x57, 0x65, 0x62]));

        // 0101 0111 0110 0101 0110 0010 -> 0010 1011 1011 0010 1011 0001 0000
        content = ContentSerdes.valueToContent("Web", { type: "string", 'ex:bitOffset': 1 }, "application/octet-stream");
        body = await content.toBuffer();
        expect(body).to.deep.equal(Buffer.from([0x2b, 0xb2, 0xb1, 0x00]));
    }

    @test "value to OctetStream should throw"() {
        // @ts-ignore new dataschema types are not yet supported in the td type definitions
        expect(() => ContentSerdes.valueToContent(2345, { type: "int8" }, "application/octet-stream")).to.throw(
            Error,
            "Integer overflow when representing signed 2345 in 8 bit(s)"
        );
        // @ts-ignore new dataschema types are not yet supported in the td type definitions
        expect(() => ContentSerdes.valueToContent(23450000, { type: "int16" }, "application/octet-stream")).to.throw(
            Error,
            "Integer overflow when representing signed 23450000 in 16 bit(s)"
        );
        expect(() => ContentSerdes.valueToContent(2345, undefined, "application/octet-stream")).to.throw(
            Error,
            "Unable to handle dataType undefined"
        );
        expect(() => ContentSerdes.valueToContent(-2345, { type: "integer", 'ex:bitOffset': 0, 'ex:bitLength': 10 }, "application/octet-stream")).to.throw(
            Error,
            "Integer overflow when representing signed -2345 in 10 bit(s)"
        );
        expect(() => ContentSerdes.valueToContent(-32769, { type: "integer", 'ex:bitOffset': 0, 'ex:bitLength': 16 }, "application/octet-stream")).to.throw(
            Error,
            "Integer overflow when representing signed -32769 in 16 bit(s)"
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
