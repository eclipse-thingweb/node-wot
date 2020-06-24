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
 * Basic test suite for TD parsing
 */

import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import { expect, should, assert } from "chai";
// should must be called to augment all variables
should();

import Thing, { DEFAULT_CONTEXT, DEFAULT_THING_TYPE, DEFAULT_CONTEXT_LANGUAGE } from "../src/thing-description";
import * as TDParser from "../src/td-parser";

/** sample TD json-ld string from the CP page*/
let tdSample1 = `{
    "title": "MyTemperatureThing",
    "properties": {
        "temperature": {
            "type": "number",
            "forms": [{
                "href": "coap://mytemp.example.com:5683/temp",
                "contentType": "application/json"
            }]
        }
  }
}`;
/** sample TD json-ld string from the CP page*/
let tdSample2 = `{
    "@type": ["Thing"],
    "title": "MyTemperatureThing2",
    "properties": {
        "temperature": {
            "type": "number",
            "observable": false,
            "forms": [{
                "href": "coap://mytemp.example.com:5683/temp",
                "contentType": "application/json"
            }]
        }
    }
}`;
/** sample TD json-ld string from the CP page*/
let tdSample3 = `{
    "@context": ["https://www.w3.org/2019/wot/td/v1"],
    "@type": ["Thing"],
    "title": "MyTemperatureThing3",
    "base": "coap://mytemp.example.com:5683/interactions/",
    "properties": {
        "temperature": {
            "type": "number",
            "observable": false,
            "forms": [{
                "href": "temp",
                "contentType": "application/json"
            }]
        },
        "temperature2": {
            "type": "number",
            "readOnly": true,
            "observable": false,
            "forms": [{
                "href": "./temp",
                "contentType": "application/json"
            }]
        },
        "humidity": {
            "type": "number",
            "readOnly": false,
            "forms": [{
                "href": "/humid",
                "contentType": "application/json"
            }]
        }
  },
  "actions": {
    "reset": {
    "forms": [{
                "href": "/actions/reset"
            }]
    }
  },
  "events": {
    "update": {
    "forms": [{
                "href": "events/update"
            }]
    }
  }
}`;

/** sample TD json-ld string from the CP page*/
let tdSampleLemonbeatBurlingame = `{
    "@context": [
        "https://www.w3.org/2019/wot/td/v1",
        {
            "actuator": "http://example.org/actuator#",
            "sensor": "http://example.org/sensors#"
        }
    ],
    "@type": ["Thing"],
    "title": "LemonbeatThings",
    "base": "http://192.168.1.176:8080/",
    "properties": {
    "luminance": {
            "@type": ["sensor:luminance"],
            "sensor:unit": "sensor:Candela",
            "type": "number",
            "readOnly": true,
            "observable": true,
            "forms": [{
                "href" : "sensors/luminance",
                "contentType": "application/json"
            }]
    },
    "humidity": {
            "@type": ["sensor:humidity"],
            "sensor:unit": "sensor:Percent",
            type": "number",
            "readOnly": true,
            "observable": true,
            "forms": [{
                "href" : "sensors/humidity",
                "contentType": "application/json"
            }]
    },
    "temperature": {
            "@type": ["sensor:temperature"],
            "sensor:unit": "sensor:Celsius",
            "type": "number",
            "readOnly": true,
            "observable": true,
            "forms": [{
                "href" : "sensors/temperature",
                "contentType": "application/json"
            }]
    },
    "status": {
            "@type": ["actuator:onOffStatus"],
            "type": "boolean",
            "readOnly": true,
            "observable": true,
            "forms": [{
                "href" : "fan/status",
                "contentType": "application/json"
            }]
    }
  },
  "actions": {
    "turnOn": {
            "@type": ["actuator:turnOn"],
            "forms": [{
                "href" : "fan/turnon",
                "contentType": "application/json"
            }]
    },
    "turnOff": {
            "@type": ["actuator:turnOff"],
            "forms": [{
                "href" : "fan/turnoff",
                "contentType": "application/json"
            }]
        }
  }
}`;

/** sample metadata TD */
let tdSampleMetadata1 = `{
    "@context": ["https://www.w3.org/2019/wot/td/v1"],
    "@type": ["Thing"],
    "reference": "myTempThing",
    "title": "MyTemperatureThing3",
    "base": "coap://mytemp.example.com:5683/interactions/",
    "properties": {
        "myTemp": {
            "@type": ["Temperature"],
            "unit": "celsius",
            "reference": "threshold",
            "schema": {
                "type": "number"
            },
            "readOnly": true,
            "forms": [{
                "href": "temp",
                "contentType": "application/json"
            }]
        }
    }
}`;

/** Simplified TD */
let tdSimple1 = `{
  "@context": "https://www.w3.org/2019/wot/td/v1",
  "id": "urn:dev:wot:com:example:servient:lamp",
  "title": "MyLampThing",
  "properties": {
    "status": {
        "readOnly": true,
        "observable": false,
        "type": "string",
        "forms": [{
            "href": "coaps://mylamp.example.com:5683/status",
            "contentType": "application/json"
        }]
  }},
  "actions": {
    "toggle": {
    "forms": [{
        "href": "coaps://mylamp.example.com:5683/toggle",
        "contentType": "application/json"
    }]}},
  "events": {
    "overheating": {
        "type": "string",
        "forms": [{
            "href": "coaps://mylamp.example.com:5683/oh",
            "contentType": "application/json"
        }]
    }}
}`;

/** Broken TDs */
let tdBroken1 = `{
  "@context": "https://www.w3.org/2019/wot/td/v1",
  "id": "urn:dev:wot:com:example:servient:lamp",
  "title": "MyLampThing",
  "properties": {
    "status": {
        "readOnly": true,
        "observable": false,
        "type": "string",
        "form": [{
            "href": "coaps://mylamp.example.com:5683/status",
            "contentType": "application/json"
        }]
  }},
  "actions": {
    "toggle": {
    "forms": [{
        "href": "coaps://mylamp.example.com:5683/toggle",
        "contentType": "application/json"
    }]}},
  "events": {
    "overheating": {
        "type": "string",
        "forms": [{
            "href": "coaps://mylamp.example.com:5683/oh",
            "mediaType": "application/json"
        }]
    }}
}`;
let tdBroken2 = `{
  "id": "urn:dev:wot:com:example:servient:lamp",
  "title": "MyLampThing",
  "properties": {
    "status": {
        "readOnly": true,
        "observable": false,
        "type": "string",
        "forms": [{
            "href": "coaps://mylamp.example.com:5683/status",
            "mediaType": "application/json"
        }]
  }},
  "actions": {
    "toggle": {
    "forms": [{
        "mediaType": "application/json"
    }]}},
  "events": {
    "overheating": {
        "type": "string",
        "forms": [{
            "href": "coaps://mylamp.example.com:5683/oh",
            "mediaType": "application/json"
        }]
    }}
}`;
let tdBroken3 = `{
  "id": "urn:dev:wot:com:example:servient:lamp",
  "title": "MyLampThing",
  "properties": {
    "status": {
        "readOnly": true,
        "observable": false,
        "type": "string",
        "forms": [{
            "href": "coaps://mylamp.example.com:5683/status",
            "mediaType": "application/json"
        }]
  }},
  "actions": {
    "toggle": {
    "forms": [{
        "href": "coaps://mylamp.example.com:5683/toggle",
        "mediaType": "application/json"
    }]}},
  "events": {
    "overheating": {
        "type": "string",
        "forms": [{
            "href": "oh",
            "mediaType": "application/json"
        }]
    }}
}`;

@suite("TD parsing/serialising")
class TDParserTest {

  @test "should insert context"() {
    let testTD = `{ "title": "NoContext" }`;
    let thing: Thing = TDParser.parseTD(testTD);

    console.dir(thing);

    expect(thing).to.have.property("@context").that.has.length(2);
    expect(thing["@context"][0]).to.equal(DEFAULT_CONTEXT);
    expect(thing["@context"][1]).to.have.property("@language").that.equals(DEFAULT_CONTEXT_LANGUAGE);
    expect(thing).to.have.property("@type").that.equals(DEFAULT_THING_TYPE);
  }

  @test "should not ovverride existing @language in context"() {
    let testTD = `{ "title": "NoContext",
    "@context": ["https://www.w3.org/2019/wot/td/v1", {
        "iot": "http://example.org/iot"
        },
        { "@language" : "de" }
    ]
    }`;
    let thing: Thing = TDParser.parseTD(testTD);

    console.dir(thing);

    expect(thing).to.have.property("@context").that.has.length(3);
    expect(thing["@context"][0]).to.equal(DEFAULT_CONTEXT);
    expect(thing["@context"][1]).to.have.property("iot").that.equals("http://example.org/iot");
    expect(thing["@context"][2]).to.have.property("@language").that.equals("de");
    expect(thing).to.have.property("@type").that.equals(DEFAULT_THING_TYPE);
  }

  @test "should add context to single string"() {
    let testTD = `{ "title": "OtherContext", "@context": "http://iot.schema.org/", "@type": "iot:Sensor" }`;
    let thing: Thing = TDParser.parseTD(testTD);

    console.dir(thing);

    expect(thing).to.have.property("@context").that.has.length(3);
    expect(thing["@context"][0]).to.equal("http://iot.schema.org/");
    expect(thing["@context"][1]).to.equal(DEFAULT_CONTEXT);
    expect(thing["@context"][2]).to.have.property("@language").that.equals(DEFAULT_CONTEXT_LANGUAGE);

    expect(thing).to.have.property("@type").that.has.length(2);
    expect(thing["@type"][0]).to.equal(DEFAULT_THING_TYPE);
    expect(thing["@type"][1]).to.equal("iot:Sensor");
  }

  @test "should add context to array"() {
    let testTD = `{ "title": "OtherContext", "@context": ["http://iot.schema.org/"], "@type": ["iot:Sensor"] }`;
    let thing: Thing = TDParser.parseTD(testTD);

    console.dir(thing);

    expect(thing).to.have.property("@context").that.has.length(3);
    expect(thing["@context"][0]).to.equal("http://iot.schema.org/");
    expect(thing["@context"][1]).to.equal(DEFAULT_CONTEXT);
    expect(thing["@context"][2]).to.have.property("@language").that.equals(DEFAULT_CONTEXT_LANGUAGE);

    expect(thing).to.have.property("@type").that.has.length(2);
    expect(thing["@type"][0]).to.equal(DEFAULT_THING_TYPE);
    expect(thing["@type"][1]).to.equal("iot:Sensor");
  }

  @test "should add context to object"() {
    let testTD = `{ "title": "OtherContext", "@context": { "iot": "http://iot.schema.org/" } }`;
    let thing: Thing = TDParser.parseTD(testTD);

    console.dir(thing);

    expect(thing).to.have.property("@context").that.has.length(3);
    expect(thing["@context"][0]).to.have.property("iot");
    expect(thing["@context"][1]).to.equal(DEFAULT_CONTEXT);
    expect(thing["@context"][2]).to.have.property("@language").that.equals(DEFAULT_CONTEXT_LANGUAGE);
  }

  @test "should parse the example from spec"() {
    let thing: Thing = TDParser.parseTD(tdSample1);

    expect(thing).to.have.property("@context").that.has.length(2);
    expect(thing["@context"][0]).to.equal(DEFAULT_CONTEXT);
    expect(thing["@context"][1]).to.have.property("@language").that.equals(DEFAULT_CONTEXT_LANGUAGE);
    expect(thing).to.have.property("@type").that.equals("Thing");
    expect(thing).to.have.property("title").that.equals("MyTemperatureThing");
    expect(thing).to.not.have.property("base");

    expect(thing.properties).to.have.property("temperature");
    expect(thing.properties["temperature"]).to.have.property("readOnly").that.equals(false);
    expect(thing.properties["temperature"]).to.have.property("observable").that.equals(false);

    expect(thing.properties["temperature"]).to.have.property("forms").to.have.lengthOf(1);
    expect(thing.properties["temperature"].forms[0]).to.have.property("contentType").that.equals("application/json");
    expect(thing.properties["temperature"].forms[0]).to.have.property("href").that.equals("coap://mytemp.example.com:5683/temp");
  }

  @test "should parse writable Property"() {
    let thing: Thing = TDParser.parseTD(tdSample2);

    expect(thing).to.have.property("@context").that.contains(DEFAULT_CONTEXT);
    expect(thing).to.have.property("@type").that.has.lengthOf(1);
    expect(thing).to.have.property("@type").that.contains("Thing");
    expect(thing).to.have.property("title").that.equals("MyTemperatureThing2");
    expect(thing).to.not.have.property("base");

    expect(thing.properties).to.have.property("temperature");
    expect(thing.properties["temperature"]).to.have.property("readOnly").that.equals(false);
    expect(thing.properties["temperature"]).to.have.property("observable").that.equals(false);

    expect(thing.properties["temperature"]).to.have.property("forms").to.have.lengthOf(1);
    expect(thing.properties["temperature"].forms[0]).to.have.property("contentType").that.equals("application/json");
    expect(thing.properties["temperature"].forms[0]).to.have.property("href").that.equals("coap://mytemp.example.com:5683/temp");

  }

  @test "should parse TD with base field"() {
    let thing: Thing = TDParser.parseTD(tdSample3);

    expect(thing).to.have.property("@context").that.has.lengthOf(2);
    expect(thing).to.have.property("@context").contains(DEFAULT_CONTEXT);
    expect(thing["@context"][1]).to.have.property("@language").that.equals(DEFAULT_CONTEXT_LANGUAGE);
    expect(thing).to.have.property("title").that.equals("MyTemperatureThing3");
    expect(thing).to.have.property("base").that.equals("coap://mytemp.example.com:5683/interactions/");

    expect(thing.properties).to.have.property("temperature");
    expect(thing.properties["temperature"]).to.have.property("readOnly").that.equals(false);
    expect(thing.properties["temperature"]).to.have.property("observable").that.equals(false);
    expect(thing.properties["temperature"]).to.have.property("forms").to.have.lengthOf(1);
    expect(thing.properties["temperature"].forms[0]).to.have.property("contentType").that.equals("application/json");

    expect(thing.properties).to.have.property("temperature2");
    expect(thing.properties["temperature2"]).to.have.property("readOnly").that.equals(true);
    expect(thing.properties["temperature2"]).to.have.property("observable").that.equals(false);
    expect(thing.properties["temperature2"]).to.have.property("forms").to.have.lengthOf(1);
    expect(thing.properties["temperature2"].forms[0]).to.have.property("contentType").that.equals("application/json");

    expect(thing.properties).to.have.property("humidity");
    expect(thing.properties["humidity"]).to.have.property("readOnly").that.equals(false);
    expect(thing.properties["humidity"]).to.have.property("observable").that.equals(false);
    expect(thing.properties["humidity"]).to.have.property("forms").to.have.lengthOf(1);
    expect(thing.properties["humidity"].forms[0]).to.have.property("contentType").that.equals("application/json");
  }

  // TODO: wait for exclude https://github.com/chaijs/chai/issues/885
  @test.skip "should return equivalent TD in round-trips"() {
    // sample1
    let thing1: Thing = TDParser.parseTD(tdSample1);
    let newJson1 = TDParser.serializeTD(thing1);

    let jsonExpected = JSON.parse(tdSample1);
    let jsonActual = JSON.parse(newJson1);

    expect(jsonActual).to.deep.equal(jsonExpected);

    // sample2
    let thing2: Thing = TDParser.parseTD(tdSample2)
    let newJson2 = TDParser.serializeTD(thing2);

    jsonExpected = JSON.parse(tdSample2);
    jsonActual = JSON.parse(newJson2);

    expect(jsonActual).to.deep.equal(jsonExpected);

    // sample3
    // Note: avoid href normalization in this test-case
    // "href": "coap://mytemp.example.com:5683/interactions/temp" vs "href": "temp"
    let thing3: Thing = TDParser.parseTD(tdSample3, false);
    let newJson3 = TDParser.serializeTD(thing3);

    jsonExpected = JSON.parse(tdSample3);
    jsonActual = JSON.parse(newJson3);
    // TODO how to compare best differences in observable/writable false compared to not present ?
    // expect(jsonActual).to.deep.equal(jsonExpected);
    // sampleLemonbeatBurlingame
    // Note: avoid href normalization in this test-case
    let tdLemonbeatBurlingame: Thing = TDParser.parseTD(tdSampleLemonbeatBurlingame, false)

    let newJsonLemonbeatBurlingame = TDParser.serializeTD(tdLemonbeatBurlingame);

    jsonExpected = JSON.parse(tdSampleLemonbeatBurlingame);
    jsonActual = JSON.parse(newJsonLemonbeatBurlingame);

    expect(jsonActual).to.deep.equal(jsonExpected);
  }


  @test "should parse and serialize metadata fields"() {
    // parse TD
    let thing: Thing = TDParser.parseTD(tdSampleMetadata1);

    expect(thing).to.have.property("@context").that.has.lengthOf(2);
    expect(thing).to.have.property("@context").contains(DEFAULT_CONTEXT);
    expect(thing["@context"][1]).to.have.property("@language").that.equals(DEFAULT_CONTEXT_LANGUAGE);
    expect(thing).to.have.property("title").that.equals("MyTemperatureThing3");
    expect(thing).to.have.property("base").that.equals("coap://mytemp.example.com:5683/interactions/");

    // thing metadata "reference": "myTempThing" in metadata
    expect(thing).to.have.property("reference").that.equals("myTempThing");

    expect(thing.properties).to.have.property("myTemp");
    expect(thing.properties["myTemp"]).to.have.property("readOnly").that.equals(true);
    expect(thing.properties["myTemp"]).to.have.property("observable").that.equals(false);
    expect(thing.properties["myTemp"]).to.have.property("forms").to.have.lengthOf(1);
    expect(thing.properties["myTemp"].forms[0]).to.have.property("contentType").that.equals("application/json");

    // metadata
    // metadata "unit": "celsius"
    expect(thing.properties["myTemp"]).to.have.property("unit").that.equals("celsius");
    // metadata "reference": "threshold"
    expect(thing.properties["myTemp"]).to.have.property("reference").that.equals("threshold");

    // serialize
    let newJson = TDParser.serializeTD(thing);
    // TODO JSON.parse() and expect
  }

  @test "should normalize forms with base"() {

    let thing: Thing = TDParser.parseTD(tdSample3);

    expect(thing).to.have.property("base").that.equals("coap://mytemp.example.com:5683/interactions/");

    expect(thing.properties["temperature"].forms[0]).to.have.property("href").that.equals("coap://mytemp.example.com:5683/interactions/temp");
    expect(thing.properties["temperature2"].forms[0]).to.have.property("href").that.equals("coap://mytemp.example.com:5683/interactions/temp");
    expect(thing.properties["humidity"].forms[0]).to.have.property("href").that.equals("coap://mytemp.example.com:5683/humid");

    expect(thing.actions["reset"].forms[0]).to.have.property("href").that.equals("coap://mytemp.example.com:5683/actions/reset");

    expect(thing.events["update"].forms[0]).to.have.property("href").that.equals("coap://mytemp.example.com:5683/interactions/events/update");
  }

  @test "simplified TD 1"() {
    let thing: Thing = TDParser.parseTD(tdSimple1);

    // simple elements
    expect(thing).to.have.property("@context").that.equals(DEFAULT_CONTEXT);
    expect(thing.id).equals("urn:dev:wot:com:example:servient:lamp");
    expect(thing.title).equals("MyLampThing");

    // interaction arrays
    expect(thing).to.have.property("properties");
    expect(thing).to.have.property("actions");
    expect(thing).to.have.property("events");

    // console.debug(td["@context"]);
    expect(thing.properties).to.have.property("status");
    expect(thing.properties["status"].readOnly).equals(true);
    expect(thing.properties["status"].observable).equals(false);
  }

  @test "should detect broken TDs"() {

    assert.throws( () => { TDParser.parseTD(tdBroken1); }, Error, "Property 'status' has no forms field");
    assert.throws( () => { TDParser.parseTD(tdBroken2); }, Error, "Form of Action 'toggle' has no href field");
    assert.throws( () => { TDParser.parseTD(tdBroken3); }, Error, "Form of Event 'overheating' has relative URI while TD has no base field");

  }

  @test "uriVarables in combination with and without http base"() {
    // see https://github.com/eclipse/thingweb.node-wot/issues/97

    let tdTest = `{
    "@context": "https://www.w3.org/2019/wot/td/v1",
    "id": "urn:dev:wot:com:example:servient:urivarables",
    "base": "coap://localhost:8080/uv/",
    "title": "UriVarables",
    "properties": {
        "without": {
        "readOnly": true,
        "observable": false,
        "type": "string",
        "forms": [{
            "href": "coap://localhost:8080/uv/without{?step}",
            "contentType": "application/json"
        }]
        },
        "with1": {
        "readOnly": true,
        "observable": false,
        "type": "string",
        "forms": [{
            "href": "with1{?step}",
            "contentType": "application/json"
        }]
        },
        "with2": {
        "readOnly": true,
        "observable": false,
        "type": "string",
        "forms": [{
            "href": "with2{?step,a}",
            "contentType": "application/json"
        }]
        }
    }
    }`;


    let thing: Thing = TDParser.parseTD(tdTest);

    // simple elements
    expect(thing).to.have.property("@context").that.equals(DEFAULT_CONTEXT);
    expect(thing.id).equals("urn:dev:wot:com:example:servient:urivarables");
    expect(thing.title).equals("UriVarables");

    // interaction arrays
    expect(thing).to.have.property("properties");

    expect(thing.properties).to.have.property("without");
    expect(thing.properties["without"].forms[0].href).equals("coap://localhost:8080/uv/" + "without{?step}");

    expect(thing.properties).to.have.property("with1");
    expect(thing.properties["with1"].forms[0].href).equals("coap://localhost:8080/uv/" + "with1{?step}");

    expect(thing.properties).to.have.property("with2");
    expect(thing.properties["with2"].forms[0].href).equals("coap://localhost:8080/uv/" + "with2{?step,a}");
  }

  @test "uriVarables in combination with and without coap base"() {
    let tdTest = `{
    "@context": "https://www.w3.org/2019/wot/td/v1",
    "id": "urn:dev:wot:com:example:servient:urivarables",
    "base": "http://localhost:8080/uv/",
    "title": "UriVarables",
    "properties": {
        "without": {
        "readOnly": true,
        "observable": false,
        "type": "string",
        "forms": [{
            "href": "http://localhost:8080/uv/without{?step}",
            "contentType": "application/json"
        }]
        },
        "with1": {
        "readOnly": true,
        "observable": false,
        "type": "string",
        "forms": [{
            "href": "with1{?step}",
            "contentType": "application/json"
        }]
        },
        "with2": {
        "readOnly": true,
        "observable": false,
        "type": "string",
        "forms": [{
            "href": "with2{?step,a}",
            "contentType": "application/json"
        }]
        }
    }
    }`;


    let thing: Thing = TDParser.parseTD(tdTest);

    // simple elements
    expect(thing).to.have.property("@context").that.equals(DEFAULT_CONTEXT);
    expect(thing.id).equals("urn:dev:wot:com:example:servient:urivarables");
    expect(thing.title).equals("UriVarables");

    // interaction arrays
    expect(thing).to.have.property("properties");

    expect(thing.properties).to.have.property("without");
    expect(thing.properties["without"].forms[0].href).equals("http://localhost:8080/uv/" + "without{?step}");

    expect(thing.properties).to.have.property("with1");
    expect(thing.properties["with1"].forms[0].href).equals("http://localhost:8080/uv/" + "with1{?step}");

    expect(thing.properties).to.have.property("with2");
    expect(thing.properties["with2"].forms[0].href).equals("http://localhost:8080/uv/" + "with2{?step,a}");
  }

}
