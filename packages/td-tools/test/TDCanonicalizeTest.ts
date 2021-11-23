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
      "@context": "http://www.w3.org/ns/td"
    }`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(`{"@context":"http://www.w3.org/ns/td","title":"T"}`);
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
            `{"id":"xyz","properties":{"t1":{"forms":[{"contentType":"application/json","href":"coap://mything.example.com:5683/temp","op":["readproperty","writeproperty"]}],"observable":false,"readOnly":false,"type":"boolean","writeOnly":false},"t2":{"forms":[{"contentType":"application/json","href":"coap://mything.example.com:5683/temp","op":["readproperty","writeproperty"]}],"observable":false,"readOnly":false,"type":"number","writeOnly":false}},"security":"basic_sc","securityDefinitions":{"basic_sc":{"in":"header","scheme":"basic"}},"title":"MyThing1"}`
        );
    }

    @test "should add defaults for property forms"() {
        const testTD = `{
      "@context": "https://www.w3.org/2019/wot/td/v1",
      "title": "MyThing1",
      "securityDefinitions": {
        "basic_sc": {
          "scheme": "basic",
          "in": "header"
        }
      },
      "security": "basic_sc",
      "properties": {
        "t1": {
          "type": "boolean",
          "forms": [{
            "href": "coap://mything.example.com:5683/temp"
          }]
        }
      }
    }`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(
            `{"@context":"https://www.w3.org/2019/wot/td/v1","properties":{"t1":{"forms":[{"contentType":"application/json","href":"coap://mything.example.com:5683/temp","op":["readproperty","writeproperty"]}],"observable":false,"readOnly":false,"type":"boolean","writeOnly":false}},"security":"basic_sc","securityDefinitions":{"basic_sc":{"in":"header","scheme":"basic"}},"title":"MyThing1"}`
        );
    }

    @test "should add defaults for action input/output"() {
        const testTD = `{
        "@context": "https://www.w3.org/2019/wot/td/v1",
        "actions": {
          "a1": {
            "forms": [{
              "contentType": "text/html",
              "href": "/a1",
              "op": ["invokeaction"]
            }],
            "idempotent": false,
                  "input": {},
                  "output": {},
            "safe": false
          }
        },
        "security": "nosec_sc",
        "securityDefinitions": {
          "nosec_sc": {
            "scheme": "nosec"
          }
        },
        "title": "MyThing"
      }`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(
            `{"@context":"https://www.w3.org/2019/wot/td/v1","actions":{"a1":{"forms":[{"contentType":"text/html","href":"/a1","op":["invokeaction"]}],"idempotent":false,"input":{"readOnly":false,"writeOnly":false},"output":{"readOnly":false,"writeOnly":false},"safe":false}},"security":"nosec_sc","securityDefinitions":{"nosec_sc":{"scheme":"nosec"}},"title":"MyThing"}`
        );
    }

    @test "should add defaults for event cancellation/data/output"() {
        const testTD = `{
        "@context": "https://www.w3.org/2019/wot/td/v1",
        "events": {
          "e1": {
            "forms": [{
              "contentType": "application/json",
              "href": "/e1",
              "op": ["subscribeevent", "unsubscribeevent"]
            }],
                  "cancellation": {},
                  "data": {},
                  "subscription": {}
          }
        },
        "security": "nosec_sc",
        "securityDefinitions": {
          "nosec_sc": {
            "scheme": "nosec"
          }
        },
        "title": "MyThing"
      }`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(
            `{"@context":"https://www.w3.org/2019/wot/td/v1","events":{"e1":{"cancellation":{"readOnly":false,"writeOnly":false},"data":{"readOnly":false,"writeOnly":false},"forms":[{"contentType":"application/json","href":"/e1","op":["subscribeevent","unsubscribeevent"]}],"subscription":{"readOnly":false,"writeOnly":false}}},"security":"nosec_sc","securityDefinitions":{"nosec_sc":{"scheme":"nosec"}},"title":"MyThing"}`
        );
    }

    @test "should add defaults for BasicSecurityScheme"() {
        const testTD = `{
        "@context": "https://www.w3.org/2019/wot/td/v1",
        "title": "MyThingSecurity",
        "security": "basic_sc",
        "securityDefinitions": {
          "basic_sc": {
            "scheme": "basic"
          }
        }
      }`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(
            `{"@context":"https://www.w3.org/2019/wot/td/v1","security":"basic_sc","securityDefinitions":{"basic_sc":{"in":"header","scheme":"basic"}},"title":"MyThingSecurity"}`
        );
    }

    @test "should add defaults for DigestSecurityScheme"() {
        const testTD = `{
      "@context": "https://www.w3.org/2019/wot/td/v1",
      "security": "digest_sc",
      "securityDefinitions": {
        "digest_sc": {
                "scheme": "digest"
        }
      },
        "title": "MyThingSecurity"
    }`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(
            `{"@context":"https://www.w3.org/2019/wot/td/v1","security":"digest_sc","securityDefinitions":{"digest_sc":{"in":"header","qop":"auth","scheme":"digest"}},"title":"MyThingSecurity"}`
        );
    }

    @test "should add defaults for BearerSecurityScheme"() {
        const testTD = `{
    "@context": "https://www.w3.org/2019/wot/td/v1",
    "security": "bearer_sc",
    "securityDefinitions": {
      "bearer_sc": {
              "scheme": "bearer"
      }
    },
      "title": "MyThingSecurity"
  }`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(
            `{"@context":"https://www.w3.org/2019/wot/td/v1","security":"bearer_sc","securityDefinitions":{"bearer_sc":{"alg":"ES256","format":"jwt","in":"header","scheme":"bearer"}},"title":"MyThingSecurity"}`
        );
    }

    @test "should add defaults for APIKeySecurityScheme"() {
        const testTD = `{
    "@context": "https://www.w3.org/2019/wot/td/v1",
    "security": "apikey_sc",
    "securityDefinitions": {
      "apikey_sc": {
              "scheme": "apikey"
      }
    },
      "title": "MyThingSecurity"
  }`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(
            `{"@context":"https://www.w3.org/2019/wot/td/v1","security":"apikey_sc","securityDefinitions":{"apikey_sc":{"in":"query","scheme":"apikey"}},"title":"MyThingSecurity"}`
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

    @test "should canoncalize dateTime #1"() {
        const testTD = `{
    "created": "2018-11-13T20:20:39+00:00"
  }`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(`{"created":"2018-11-13T20:20:39Z"}`);
    }

    @test "should canoncalize dateTime #2"() {
        const testTD = `{
  "modified": "2018-11-13T20:20:39+01:00"
}`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(`{"modified":"2018-11-13T19:20:39Z"}`);
    }

    @test "should canoncalize dateTime #3"() {
        const testTD = `{
"created": "2015-08-11T23:00:00+09:00"
}`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(`{"created":"2015-08-11T14:00:00Z"}`);
    }

    @test "should canoncalize dateTime #4"() {
        const testTD = `{
"created": "2015-08-11T23:00:00-09:00"
}`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(`{"created":"2015-08-12T08:00:00Z"}`);
    }

    @test "should canoncalize dateTime #5"() {
        const testTD = `{
"created": "2015-08-11T23:00:00Z"
}`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(`{"created":"2015-08-11T23:00:00Z"}`);
    }

    @test.skip "should canoncalize dateTimehour 25 #5"() {
        // fails with RangeError: Invalid time value
        const testTD = `{
"created": "2014-08-11T25:00:00Z"
}`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(`{"created":"2014-08-12T01:00:00Z"}`);
    }

    @test "should convert single array to single value @context"() {
        const testTD = `{
      "@context": [ "https://www.w3.org/2019/wot/td/v1" ],
      "security": "nosec_sc",
      "securityDefinitions": {
        "nosec_sc": {
          "scheme": "nosec"
        }
      },
      "title": "MyThing"
    }`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(
            `{"@context":"https://www.w3.org/2019/wot/td/v1","security":"nosec_sc","securityDefinitions":{"nosec_sc":{"scheme":"nosec"}},"title":"MyThing"}`
        );
    }

    @test "should convert single array to single value @type"() {
        const testTD = `{
        "@context": "https://www.w3.org/2019/wot/td/v1",
        "@type": ["Thing"],
        "security": "nosec_sc",
        "securityDefinitions": {
          "nosec_sc": {
            "scheme": "nosec"
          }
        },
        "title": "MyThing"
      }`;
        const canTD: string = TDCanonicalizer.canonicalizeTD(testTD);
        expect(canTD).to.equals(
            `{"@context":"https://www.w3.org/2019/wot/td/v1","@type":"Thing","security":"nosec_sc","securityDefinitions":{"nosec_sc":{"scheme":"nosec"}},"title":"MyThing"}`
        );
    }
}
