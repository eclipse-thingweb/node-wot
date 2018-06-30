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
 * Basic test suite for TD parsing
 */

import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import { expect, should } from "chai";
// should must be called to augment all variables
should();

import Thing from "../src/thing-description";
import * as TDParser from "../src/td-parser";

/** sample TD json-ld string from the CP page*/
let tdSample1 = `{
	"name": "MyTemperatureThing",
	"properties": {
		"temperature": {
			"type": "number",
			"forms": [{
				"href": "coap://mytemp.example.com:5683/temp",
				"mediaType": "application/json"
			}]
		}
  }
}`;
/** sample TD json-ld string from the CP page*/
let tdSample2 = `{
	"@context": "https://w3c.github.io/wot/w3c-wot-td-context.jsonld",
	"@type": ["Thing"],
	"name": "MyTemperatureThing2",
	"properties": {
		"temperature": {
			"type": "number",
			"writable": true,
			"observable": false,
			"forms": [{
				"href": "coap://mytemp.example.com:5683/temp",
				"mediaType": "application/json"
			}]
		}
	}
}`;
/** sample TD json-ld string from the CP page*/
let tdSample3 = `{
	"@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
	"@type": ["Thing"],
	"name": "MyTemperatureThing3",
	"base": "coap://mytemp.example.com:5683/interactions/",
	"properties": {
		"temperature": {
			"type": "number",
			"writable": true,
			"observable": false,
			"forms": [{
				"href": "temp",
				"mediaType": "application/json"
			}]
		},
		"temperature2": {
			"type": "number",
			"writable": false,
			"observable": false,
			"forms": [{
				"href": "./temp",
				"mediaType": "application/json"
			}]
		},
		"humidity": {
			"type": "number",
			"forms": [{
				"href": "/humid",
				"mediaType": "application/json"
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
		"https://w3c.github.io/wot/w3c-wot-td-context.jsonld",
		{
			"actuator": "http://example.org/actuator#",
			"sensor": "http://example.org/sensors#"
		}
	],
	"@type": ["Thing"],
	"name": "LemonbeatThings",
	"base": "http://192.168.1.176:8080/",
	"properties": {
    "luminance": {
			"@type": ["sensor:luminance"],
			"sensor:unit": "sensor:Candela",
			"type": "number",
			"writable": false,
			"observable": true,
			"forms": [{
				"href" : "sensors/luminance", 
				"mediaType": "application/json"
			}]
    },
    "humidity": {
			"@type": ["sensor:humidity"],
			"sensor:unit": "sensor:Percent",
			type": "number",
			"writable": false,
			"observable": true,
			"forms": [{
				"href" : "sensors/humidity", 
				"mediaType": "application/json"
			}]
    },
    "temperature": {
			"@type": ["sensor:temperature"],
			"sensor:unit": "sensor:Celsius",
			"type": "number",
			"writable": false,
			"observable": true,
			"forms": [{
				"href" : "sensors/temperature", 
				"mediaType": "application/json"
			}]
    },
    "status": {
			"@type": ["actuator:onOffStatus"],
			"type": "boolean",
			"writable": false,
			"observable": true,
			"forms": [{
				"href" : "fan/status",
				"mediaType": "application/json"
			}]
    }
  },
  "actions": {
    "turnOn": {
			"@type": ["actuator:turnOn"],
			"forms": [{
				"href" : "fan/turnon",
				"mediaType": "application/json"
			}]									
    },
    "turnOff": {
			"@type": ["actuator:turnOff"],
			"forms": [{
				"href" : "fan/turnoff",
				"mediaType": "application/json"
			}]									
		}
  }
}`;

/** sample metadata TD */
let tdSampleMetadata1 = `{
	"@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
	"@type": ["Thing"],
	"reference": "myTempThing",
	"name": "MyTemperatureThing3",
	"base": "coap://mytemp.example.com:5683/interactions/",
	"properties": {
		"myTemp": {
			"@type": ["Temperature"],
			"unit": "celsius",
			"reference": "threshold",
			"schema": {
				"type": "number"
			},
			"writable": false,
			"forms": [{
				"href": "temp",
				"mediaType": "application/json"
			}]
		}
	}
}`;

/** Simplified TD */
let tdSimple1 = `{
  "@context": "https://w3c.github.io/wot/w3c-wot-td-context.jsonld",
  "id": "urn:dev:wot:com:example:servient:lamp",
  "name": "MyLampThing",
  "properties": {
      "status": {
       "writable": false,
       "observable": false,
       "type": "string",
       "form": [{
           "href": "coaps://mylamp.example.com:5683/status",
           "mediaType": "application/json"
       }]
  }},
  "actions": {
   "toggle": {
      "form": [{
          "href": "coaps://mylamp.example.com:5683/toggle",
          "mediaType": "application/json"
      }]}},
  "events": {
      "overheating": {
          "type": "string",
          "form": [{
              "href": "coaps://mylamp.example.com:5683/oh",
              "mediaType": "application/json"
          }]
      }}
}`;


@suite("TD parsing/serialising")
class TDParserTest {

  @test "should parse the example from Current Practices"() {
    let thing: Thing = TDParser.parseTD(tdSample1);

    expect(thing).to.have.property("@context").that.equals("https://w3c.github.io/wot/w3c-wot-td-context.jsonld");
    expect(thing).to.have.property("@type").that.equals("Thing");
    expect(thing).to.have.property("name").that.equals("MyTemperatureThing");
    expect(thing).to.not.have.property("base");

    expect(thing.properties).to.have.property("temperature");
    expect(thing.properties["temperature"]).to.have.property("writable").that.equals(false);
    expect(thing.properties["temperature"]).to.have.property("observable").that.equals(false);

    expect(thing.properties["temperature"]).to.have.property("forms").to.have.lengthOf(1);
    expect(thing.properties["temperature"].forms[0]).to.have.property("mediaType").that.equals("application/json");
    expect(thing.properties["temperature"].forms[0]).to.have.property("href").that.equals("coap://mytemp.example.com:5683/temp");
  }

  @test "should parse writable Property"() {
    let thing: Thing = TDParser.parseTD(tdSample2);

    expect(thing).to.have.property("@context").that.equals("https://w3c.github.io/wot/w3c-wot-td-context.jsonld");
    expect(thing).to.have.property("@type").that.has.lengthOf(1);
    expect(thing).to.have.property("@type").that.contains("Thing");
    expect(thing).to.have.property("name").that.equals("MyTemperatureThing2");
    expect(thing).to.not.have.property("base");

    expect(thing.properties).to.have.property("temperature");
    expect(thing.properties["temperature"]).to.have.property("writable").that.equals(true);
    expect(thing.properties["temperature"]).to.have.property("observable").that.equals(false);

    expect(thing.properties["temperature"]).to.have.property("forms").to.have.lengthOf(1);
    expect(thing.properties["temperature"].forms[0]).to.have.property("mediaType").that.equals("application/json");
    expect(thing.properties["temperature"].forms[0]).to.have.property("href").that.equals("coap://mytemp.example.com:5683/temp");

  }

  @test "should parse TD with base field"() {
    let thing: Thing = TDParser.parseTD(tdSample3);

    expect(thing).to.have.property("@context").that.has.lengthOf(1);
    expect(thing).to.have.property("@context").contains("https://w3c.github.io/wot/w3c-wot-td-context.jsonld");
    expect(thing).to.have.property("name").that.equals("MyTemperatureThing3");
    expect(thing).to.have.property("base").that.equals("coap://mytemp.example.com:5683/interactions/");

    expect(thing.properties).to.have.property("temperature");
    expect(thing.properties["temperature"]).to.have.property("writable").that.equals(true);
    expect(thing.properties["temperature"]).to.have.property("observable").that.equals(false);
    expect(thing.properties["temperature"]).to.have.property("forms").to.have.lengthOf(1);
    expect(thing.properties["temperature"].forms[0]).to.have.property("mediaType").that.equals("application/json");

    expect(thing.properties).to.have.property("temperature2");
    expect(thing.properties["temperature2"]).to.have.property("writable").that.equals(false);
    expect(thing.properties["temperature2"]).to.have.property("observable").that.equals(false);
    expect(thing.properties["temperature2"]).to.have.property("forms").to.have.lengthOf(1);
    expect(thing.properties["temperature2"].forms[0]).to.have.property("mediaType").that.equals("application/json");

    expect(thing.properties).to.have.property("humidity");
    expect(thing.properties["humidity"]).to.have.property("writable").that.equals(false);
    expect(thing.properties["humidity"]).to.have.property("observable").that.equals(false);
    expect(thing.properties["humidity"]).to.have.property("forms").to.have.lengthOf(1);
    expect(thing.properties["humidity"].forms[0]).to.have.property("mediaType").that.equals("application/json");
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

    expect(thing).to.have.property("@context").that.has.lengthOf(1);
    expect(thing).to.have.property("@context").contains("https://w3c.github.io/wot/w3c-wot-td-context.jsonld");
    expect(thing).to.have.property("name").that.equals("MyTemperatureThing3");
    expect(thing).to.have.property("base").that.equals("coap://mytemp.example.com:5683/interactions/");

    // thing metadata "reference": "myTempThing" in metadata
    expect(thing).to.have.property("reference").that.equals("myTempThing");

    expect(thing.properties).to.have.property("myTemp");
    expect(thing.properties["myTemp"]).to.have.property("writable").that.equals(false);
    expect(thing.properties["myTemp"]).to.have.property("observable").that.equals(false);
    expect(thing.properties["myTemp"]).to.have.property("forms").to.have.lengthOf(1);
    expect(thing.properties["myTemp"].forms[0]).to.have.property("mediaType").that.equals("application/json");

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
    expect(thing).to.have.property("@context").that.equals("https://w3c.github.io/wot/w3c-wot-td-context.jsonld");
    expect(thing["@context"]).equals("https://w3c.github.io/wot/w3c-wot-td-context.jsonld");
    expect(thing.id).equals("urn:dev:wot:com:example:servient:lamp");
    expect(thing.name).equals("MyLampThing");

    // interaction arrays
    expect(thing).to.have.property("properties");
    expect(thing).to.have.property("actions");
    expect(thing).to.have.property("events");

    // console.log(td["@context"]);
    expect(thing.properties).to.have.property("status");
    expect(thing.properties["status"].writable).equals(false);
    expect(thing.properties["status"].observable).equals(false);
  }

}
