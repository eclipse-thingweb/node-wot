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

let checkJsonToJs = (value: any): void => {
    let jsonBuffer = Buffer.from(JSON.stringify(value));
    expect(ContentSerdes.contentToValue({ type: "application/json", body: jsonBuffer }, { type: "object", properties: {} })).to.deep.equal(value);
}

let checkJsToJson = (value: any): void => {
    let jsonContent = ContentSerdes.valueToContent(value, { type: "object", properties: {} })
    let reparsed = JSON.parse(jsonContent.body.toString());
    expect(reparsed).to.deep.equal(value);
}

let checkStreamToValue = (value: any, match : any, type? : any, semanticType? : any): void => {
    let octectBuffer = Buffer.from(value);
    expect(
        ContentSerdes.contentToValue(
            { type: "application/octet-stream", body: octectBuffer }, 
            { type: type ?? "integer", "@type": semanticType ?? [], properties: {} }
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
        checkStreamToValue([ 0x30, 0x36 ], 13872, "int16", ["xsd:littleEndian"])
        checkStreamToValue([ 0x49, 0x91, 0xA1, 0xC2 ], 1234280898, "int32")
        checkStreamToValue([ 0x3D, 0xD6, 0xEA, 0xFC ], 0.10494038462638855, "float32", ["xsd:bigEndian"])
        checkStreamToValue([ 0x49, 0x25 ], 18725, "integer", ["xsd:unsignedInt", "xsd:bigEndian"])
        checkStreamToValue([ 0x49, 0x25 ], 18725, "number", ["xsd:unsignedInt", "xsd:bigEndian"])
        checkStreamToValue([ 0x78, 0xA4 ], -23432, "number", ["xsd:int", "xsd:littleEndian"])
        checkStreamToValue([ 0x49, 0x90, 0xE6, 0xEB ], -5.5746861179443064e+26, "integer", ["xsd:float", "xsd:littleEndian"])
        checkStreamToValue([ 0xD3, 0xCD, 0xCC, 0xCC, 0xC1, 0xB4, 0x82, 0x70 ], -4.9728447076484896e+95, "integer", ["xsd:double", "xsd:bigEndian"])
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

    @test "value to JSON"() {
        checkJsToJson(42)
        checkJsToJson("Hallo")
        checkJsToJson(null)
        checkJsToJson({ "foo": "bar" })
        checkJsToJson({ "answer": 42 })
        checkJsToJson({ "pi": 3.14 })
    }
}

@suite("adding new codec")
class SerdesCodecTests {

    static before() {
        ContentSerdes.addCodec(new HodorCodec())
    }

    static after() {
    }

    @test "new codec should serialize"() {
        ContentSerdes.valueToContent("The meaning of Life", { type: "string" }, "text/hodor").body.toString().should.equal("Hodor")
    }

    @test "new codec should deserialize"() {
        let buffer = Buffer.from("Some actual meaningful stuff")
        ContentSerdes.contentToValue({ type: "text/hodor", body: buffer }, { type: "string" }).should.deep.equal("Hodor")
    }
}