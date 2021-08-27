/********************************************************************************
 * Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
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

import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import { expect, should } from "chai";
// should must be called to augment all variables
should();

import ContentSerdes from "../src/content-serdes";
import { ContentCodec } from "../src/content-serdes";
import { ProtocolHelpers } from "../src/core";

let checkJsonToJs = (value: any): void => {
    let jsonBuffer = Buffer.from(JSON.stringify(value));
    expect(ContentSerdes.contentToValue({ type: "application/json", body: jsonBuffer }, { type: "object", properties: {} })).to.deep.equal(value);
}

let checkJsToJson = async (value: any) => {
    let jsonContent = ContentSerdes.valueToContent(value, { type: "object", properties: {} })
    const body = await ProtocolHelpers.readStreamFully(jsonContent.body);
    let reparsed = JSON.parse(body.toString());
    expect(reparsed).to.deep.equal(value);
}

let checkStreamToValue = (value: any, match : any, type? : any): void => {
    let octectBuffer = Buffer.from(value);
    expect(
        ContentSerdes.contentToValue(
            { type: "application/octet-stream", body: octectBuffer }, 
            { type: type ?? "integer", properties: {} }
        )
    ).to.deep.equal(match);
}

/** Hodor will always return the String "Hodor" */
class HodorCodec implements ContentCodec {
    getMediaType(): string { return "text/hodor"; }
    bytesToValue(bytes: Buffer): any { return "Hodor"; }
    valueToBytes(value: any): Buffer { return Buffer.from("Hodor"); }
}

@suite("testing OctectStream codec")
class SerdesOctetTests {

    @test "OctetStream to value"() {
        checkStreamToValue([ 0x36, 0x30 ], 13872, "uint16")
        checkStreamToValue([ 0x49, 0x91, 0xA1, 0xC2 ], 1234280898, "int32")
        checkStreamToValue([ 0x3D, 0xD6, 0xEA, 0xFC ], 0.10494038462638855, "float32")
        checkStreamToValue([ 0x49, 0x25 ], 18725, "int16")
        checkStreamToValue([ 0x49, 0x25 ], 18725, "integer")
        checkStreamToValue([ 0xA4, 0x78 ], -23432, "int16")
        checkStreamToValue([ 0xEB, 0xE6, 0x90, 0x49 ], -5.5746861179443064e+26, "number")
        checkStreamToValue([0x44, 0x80], 4.5, "float16")
        checkStreamToValue([ 0xEB, 0xE6, 0x90, 0x49 ], -5.5746861179443064e+26, "float32")
        checkStreamToValue([ 0xD3, 0xCD, 0xCC, 0xCC, 0xC1, 0xB4, 0x82, 0x70 ], -4.9728447076484896e+95, "float64")
    }
    @test.skip "value to OctetStream"() { // @relu91
        let content = ContentSerdes.valueToContent(2345, { type: "integer" }, "application/octet-stream")
        expect(content.body).to.deep.equal(Buffer.from([0x00, 0x00, 0x09, 0x29 ]));
        // should default to signed
        content = ContentSerdes.valueToContent(-2345, { type: "integer" }, "application/octet-stream")
        expect(content.body).to.deep.equal(Buffer.from([0xFF, 0xFF, 0xF6, 0xD7]));

        //@ts-ignore new dataschema types are not yet supported in the td type definitions 
        content = ContentSerdes.valueToContent(2345, { type: "int16" }, "application/octet-stream")
        expect(content.body).to.deep.equal(Buffer.from([0x09, 0x29]));

        //@ts-ignore new dataschema types are not yet supported in the td type definitions 
        content = ContentSerdes.valueToContent(10, { type: "int8" }, "application/octet-stream")
        expect(content.body).to.deep.equal(Buffer.from([0x0a]));

        //should serialize a number as a float16
        //@ts-ignore new dataschema types are not yet supported in the td type definitions 
        content = ContentSerdes.valueToContent(4.5, { type: "float16" }, "application/octet-stream")
        expect(content.body).to.deep.equal(Buffer.from([0x44, 0x80]));
    }

    @test "value to OctetStream should throw for overflow"() {
        //@ts-ignore new dataschema types are not yet supported in the td type definitions 
        expect(() => ContentSerdes.valueToContent(2345, { type: "int8" }, "application/octet-stream") )
            .to.throw(Error, "Integer overflow when representing signed 2345 in 1 byte(s)");
        //@ts-ignore new dataschema types are not yet supported in the td type definitions 
        expect(() => ContentSerdes.valueToContent(23450000, { type: "int16" }, "application/octet-stream"))
            .to.throw(Error, "Integer overflow when representing signed 23450000 in 2 byte(s)");
    }
}

@suite("testing JSON codec")
class SerdesTests {

    @test "JSON to value"() {
        checkJsonToJs(42)
        checkJsonToJs("Hallo")
        checkJsonToJs(null)
        checkJsonToJs({ "foo": "bar" })
        checkJsonToJs({ "answer": 42 })
        checkJsonToJs({ "pi": 3.14 })
    }

    @test async "value to JSON"() {
        await checkJsToJson(42)
        await checkJsToJson("Hallo")
        await checkJsToJson(null)
        await checkJsToJson({ "foo": "bar" })
        await checkJsToJson({ "answer": 42 })
        await checkJsToJson({ "pi": 3.14 })
    }
}

@suite("adding new codec")
class SerdesCodecTests {

    static before() {
        ContentSerdes.addCodec(new HodorCodec())
    }

    static after() {
    }

    @test async "new codec should serialize"() {
        const content = ContentSerdes.valueToContent("The meaning of Life", { type: "string" }, "text/hodor")
        const body = await ProtocolHelpers.readStreamFully(content.body);
        body.toString().should.equal("Hodor")
    }

    @test "new codec should deserialize"() {
        let buffer = Buffer.from("Some actual meaningful stuff")
        ContentSerdes.contentToValue({ type: "text/hodor", body: buffer }, { type: "string" }).should.deep.equal("Hodor")
    }
}