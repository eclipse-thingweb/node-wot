/********************************************************************************
 * Copyright (c) 2018 Contributors to the Eclipse Foundation
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
import {ContentCodec} from "../src/content-serdes";

let checkJsonToJs = (value : any) : void => {
        let jsonBuffer = new Buffer(JSON.stringify(value));
        expect(ContentSerdes.contentToValue({ mediaType: "application/json", body: jsonBuffer })).to.deep.equal(value);
}

let checkJsToJson = (value: any) : void => {
        let jsonContent = ContentSerdes.valueToContent(value)
        let reparsed = JSON.parse(jsonContent.body.toString());
        expect(reparsed).to.deep.equal(value);
}

/** Hodor will always return the String "Hodor" */
class HodorCodec implements ContentCodec {
    getMediaType() : string { return "text/hodor"; }
    bytesToValue(bytes : Buffer) : any { return "Hodor"; }
    valueToBytes(value : any) : Buffer { return new Buffer("Hodor"); }
}

@suite("testing JSON codec")
class SerdesTests {

    @test "JSON to value"() {
        checkJsonToJs(42)
        checkJsonToJs("Hallo")
        checkJsonToJs(null)
        checkJsonToJs({"foo" : "bar"})
        checkJsonToJs({"answer" : 42})
        checkJsonToJs({"pi" : 3.14})
    }

    @test "value to JSON"() {
        checkJsToJson(42)
        checkJsToJson("Hallo")
        checkJsToJson(null)
        checkJsToJson({"foo" : "bar"})
        checkJsToJson({"answer" : 42})
        checkJsToJson({"pi" : 3.14})
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
        ContentSerdes.valueToContent("The meaning of Life", "text/hodor").body.toString().should.equal("Hodor")
    }

    @test "new codec should deserialize"() {
        let buffer = new Buffer("Some actual meaningful stuff")
        ContentSerdes.contentToValue({ mediaType: "text/hodor", body: buffer }).should.deep.equal("Hodor")
    }
}