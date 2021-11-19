/********************************************************************************
 * Copyright (c) 2021 Contributors to the Eclipse Foundation
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
 * Basic test suite for TD canonicalization
 */

import { suite, test } from "@testdeck/mocha";
import { expect, should } from "chai";

import * as TDCanonicalizer from "../src/td-canonicalizer";

// should must be called to augment all variables
should();

@suite("TD canonicalization")
class TDCanonicalizeTest {
    @test "should short keys on root level"() {
        const testTD = `{
      "title": "T",
      "@context": ["http://www.w3.org/ns/td"]
    }`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(`{"@context":["http://www.w3.org/ns/td"],"title":"T"}`);
    }

    @test "should short keys on various levels + defaults #1"() {
        const testTD = `{
        "title": "MyThing1",
        "securityDefinitions": {
          "basic_sc": {
            "scheme": "basic",
            "in": "header"
          }
        },
        "security": "basic_sc",
        "id": "xyz",
        "properties": {
          "t2": {
            "type": "number",
            "forms": [{
              "href": "coap://mything.example.com:5683/temp",
              "contentType": "application/json"
            }]
          },
          "t1": {
            "type": "boolean",
            "forms": [{
              "contentType": "application/json",
              "href": "coap://mything.example.com:5683/temp"
            }]
          }
        }
      }`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(
            `{"id":"xyz","properties":{"t1":{"forms":[{"contentType":"application/json","href":"coap://mything.example.com:5683/temp"}],"observable":false,"readOnly":false,"type":"boolean","writeOnly":false},"t2":{"forms":[{"contentType":"application/json","href":"coap://mything.example.com:5683/temp"}],"observable":false,"readOnly":false,"type":"number","writeOnly":false}},"security":"basic_sc","securityDefinitions":{"basic_sc":{"in":"header","scheme":"basic"}},"title":"MyThing1"}`
        );
    }

    @test "example in spec - Example 38"() {
        const testTD = `{
        "@context": "http://www.w3.org/ns/td",
        "id": "urn:dev:ops:32473-WoTLamp-1234",
        "properties": {
            "status": {
                "forms": [
                    {
                        "contentType": "application/json",
                        "href": "https://mylamp.example.com/status",
                        "htv:methodName": "GET",
                        "op": "readproperty",
                        "security": "basic_sc"
                    },
                    {
                        "contentType": "application/json",
                        "href": "https://mylamp.example.com/status",
                        "htv:methodName": "PUT",
                        "op": "writeproperty",
                        "security": "basic_sc"
                    }
                ],
                "observable": false,
                "readOnly": false,
                "type": "string",
                "writeOnly": false
            }
        },
        "securityDefinitions": {
            "basic_sc": {
                "in": "header",
                "scheme": "basic"
            }
        },
        "security":["basic_sc"],
        "title": "MyLampThing"
    }`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(
            `{"@context":"http://www.w3.org/ns/td","id":"urn:dev:ops:32473-WoTLamp-1234","properties":{"status":{"forms":[{"contentType":"application/json","href":"https://mylamp.example.com/status","htv:methodName":"GET","op":"readproperty","security":"basic_sc"},{"contentType":"application/json","href":"https://mylamp.example.com/status","htv:methodName":"PUT","op":"writeproperty","security":"basic_sc"}],"observable":false,"readOnly":false,"type":"string","writeOnly":false}},"security":["basic_sc"],"securityDefinitions":{"basic_sc":{"in":"header","scheme":"basic"}},"title":"MyLampThing"}`
        );
    }

    @test "RFC8785 3.2.2 Primitive Data Types - Numbers and Literals"() {
        // https://datatracker.ietf.org/doc/html/rfc8785#section-3.2.2
        // Note: string causes issues with plain JSON.parse();
        // "string": "\u20ac$\u000F\u000aA'\u0042\u0022\u005c\\\"\/",
        const testTD = `{
        "numbers": [333333333.33333329, 1E30, 4.50,
                    2e-3, 0.000000000000000000000000001],
        "literals": [null, true, false]
      }`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(`{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27]}`);
    }

    @test.skip "RFC8785 3.2.3 Sorting of Object Properties"() {
        // Note: JSON.parse(...) fails
        // https://datatracker.ietf.org/doc/html/rfc8785#section-3.2.3
        const testTD = `{
        "\u20ac": "Euro Sign",
        "\r": "Carriage Return",
        "\ufb33": "Hebrew Letter Dalet With Dagesh",
        "1": "One",
        "\ud83d\ude00": "Emoji: Grinning Face",
        "\u0080": "Control",
        "\u00f6": "Latin Small Letter O With Diaeresis"
      }`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(`{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27]}`);
    }
}
