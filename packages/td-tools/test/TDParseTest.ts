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
// import * as AddressHelper from "@node-wot/helpers";

/** sample TD json-ld string from the CP page*/
let tdSample1 = `{
  "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
  "@type": ["Thing"],
  "name": "MyTemperatureThing",
  "interaction": [
    {
      "@type": ["Property"],
      "name": "temperature",
      "schema":  { "type": "number" },
      "form": [{
        "href" : "coap://mytemp.example.com:5683/temp",
        "mediaType": "application/json"
      }],
      "writable": false,
      "observable": false
    }
  ]
}`;
/** sample TD json-ld string from the CP page*/
let tdSample2 = `{
  "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
  "@type": ["Thing"],
  "name": "MyTemperatureThing2",
  "interaction": [
    {
      "@type": ["Property"],
      "name": "temperature",
      "schema":  { "type": "number" },
      "form": [{
        "href" : "coap://mytemp.example.com:5683/temp",
        "mediaType": "application/json"
      }],
      "writable": true,
      "observable": true
    }
  ]
}`;
/** sample TD json-ld string from the CP page*/
let tdSample3 = `{
  "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
  "@type": ["Thing"],
  "name": "MyTemperatureThing3",
  "base": "coap://mytemp.example.com:5683/interactions/",
  "interaction": [
    {
      "@type": ["Property"],
      "name": "temperature",
      "schema":  { "type": "number" },
      "writable": true,
      "observable": false,
      "form": [{
        "href" : "temp",
        "mediaType": "application/json"
        }]
    },
    {
      "@type": ["Property"],
      "name": "temperature2",
      "schema": { "type": "number" },
      "writable": false,
      "observable": false,
      "form": [{
        "href" : "./temp",
        "mediaType": "application/json"
        }]
    },
    {
      "@type": ["Property"],
      "name": "humidity",
      "schema": { "type": "number" },
      "writable": false,
      "observable": false,
      "form": [{
        "href" : "/humid",
        "mediaType": "application/json"
        }]
    }
  ]
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
	"@type": ["Thing", "sensor:Sensor"],
	"name": "LemonbeatThings",
	"base": "http://192.168.1.176:8080/",
	"interaction": [
		{
			"@type": ["Property","sensor:luminance"],
			"name": "luminance",
			"sensor:unit": "sensor:Candela",
			"schema": { "type": "number" },
			"writable": false,
			"observable": true,
			"form": [{
				"href" : "sensors/luminance", 
				"mediaType": "application/json"
			}]
		},
		{
			"@type": ["Property","sensor:humidity"],
			"name": "humidity",
			"sensor:unit": "sensor:Percent",
			"schema": { "type": "number" },
			"writable": false,
			"observable": true,
			"form": [{
				"href" : "sensors/humidity", 
				"mediaType": "application/json"
			}]
		},
		{
			"@type": ["Property","sensor:temperature"],
			"name": "temperature",
			"sensor:unit": "sensor:Celsius",
			"schema": { "type": "number" },
			"writable": false,
			"observable": true,
			"form": [{
				"href" : "sensors/temperature", 
				"mediaType": "application/json"
			}]
		},
		{
			"@type": ["Property","actuator:onOffStatus"],
			"name": "status",
			"schema": { "type": "boolean" },
			"writable": false,
			"observable": true,
			"form": [{
				"href" : "fan/status",
				"mediaType": "application/json"
			}]
		},
		{
			"@type": ["Action","actuator:turnOn"],
			"name": "turnOn",
			"form": [{
				"href" : "fan/turnon",
				"mediaType": "application/json"
			}]									
		},
		{
			"@type": ["Action","actuator:turnOff"],
			"name": "turnOff",
			"form": [{
				"href" : "fan/turnoff",
				"mediaType": "application/json"
			}]									
		}
	]
}`;

/** sample metadata TD */
let tdSampleMetadata1 = `{
  "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
  "@type": ["Thing"],
  "reference": "myTempThing",
  "name": "MyTemperatureThing3",
  "base": "coap://mytemp.example.com:5683/interactions/",
  "interaction": [
    {
      "@type": ["Property","Temperature"],
      "unit": "celsius",
      "reference": "threshold",
      "name": "myTemp",
      "schema":  { "type": "number" },
      "writable": false,
      "form": [{
        "href" : "temp",
        "mediaType": "application/json"
      }]
    }
  ]
}`;



@suite("TD parsing/serialising")
class TDParserTest {

  @test "should parse the example from Current Practices"() {
    let thing: Thing = TDParser.parseTDString(tdSample1);

    expect(thing).to.have.property("context").that.has.lengthOf(1); // TD context
    expect(thing).to.have.property("semanticType").to.have.lengthOf(0); // semanticType is subset of @type
    expect(thing).to.have.property("name").that.equals("MyTemperatureThing");
    expect(thing).to.not.have.property("base");

    expect(thing.interaction).to.have.lengthOf(1);
    expect(thing.interaction[0]).to.have.property("pattern").that.equals("Property");
    expect(thing.interaction[0]).to.have.property("semanticType").that.is.empty;
    expect(thing.interaction[0]).to.have.property("name").that.equals("temperature");
    expect(thing.interaction[0]).to.have.property("writable").that.equals(false);

    expect(thing.interaction[0].form).to.have.lengthOf(1);
    expect(thing.interaction[0].form[0]).to.have.property("mediaType").that.equals("application/json");
    expect(thing.interaction[0].form[0]).to.have.property("href").that.equals("coap://mytemp.example.com:5683/temp");
  }

  @test "should parse writable Property"() {
    let thing: Thing = TDParser.parseTDString(tdSample2);

    expect(thing).to.have.property("context").that.has.lengthOf(1); // TD context
    expect(thing).to.have.property("semanticType").to.have.lengthOf(0); // semanticType is subset of @type
    expect(thing).to.have.property("name").that.equals("MyTemperatureThing2");
    expect(thing).to.not.have.property("base");

    expect(thing.interaction).to.have.lengthOf(1);
    expect(thing.interaction[0]).to.have.property("pattern").that.equals("Property");
    expect(thing.interaction[0]).to.have.property("name").that.equals("temperature");
    expect(thing.interaction[0]).to.have.property("writable").that.equals(true);

    expect(thing.interaction[0].form).to.have.lengthOf(1);
    expect(thing.interaction[0].form[0]).to.have.property("mediaType").that.equals("application/json");
    expect(thing.interaction[0].form[0]).to.have.property("href").that.equals("coap://mytemp.example.com:5683/temp");
  }

  @test "should parse and apply base field"() {
    let thing: Thing = TDParser.parseTDString(tdSample3);

    expect(thing).to.have.property("context").that.has.lengthOf(1);
    expect(thing).to.have.property("semanticType").to.have.lengthOf(0); // semanticType is subset of @type
    expect(thing).to.have.property("name").that.equals("MyTemperatureThing3");
    expect(thing).to.have.property("base").that.equals("coap://mytemp.example.com:5683/interactions/");

    expect(thing.interaction).to.have.lengthOf(3);
    expect(thing.interaction[0]).to.have.property("name").that.equals("temperature");
    expect(thing.interaction[0]).to.have.property("pattern").that.equals("Property");
    expect(thing.interaction[0]).to.have.property("writable").that.equals(true);

    expect(thing.interaction[0].form).to.have.lengthOf(1);
    expect(thing.interaction[0].form[0]).to.have.property("mediaType").that.equals("application/json");
    expect(thing.interaction[0].form[0]).to.have.property("href").that.equals("coap://mytemp.example.com:5683/interactions/temp");

    expect(thing.interaction[1]).to.have.property("name").that.equals("temperature2");
    expect(thing.interaction[1]).to.have.property("pattern").that.equals("Property");
    expect(thing.interaction[1]).to.have.property("writable").that.equals(false);

    expect(thing.interaction[1].form).to.have.lengthOf(1);
    expect(thing.interaction[1].form[0]).to.have.property("mediaType").that.equals("application/json");
    expect(thing.interaction[1].form[0]).to.have.property("href").that.equals("coap://mytemp.example.com:5683/interactions/temp");

    expect(thing.interaction[2]).to.have.property("name").that.equals("humidity");
    expect(thing.interaction[2]).to.have.property("pattern").that.equals("Property");
    expect(thing.interaction[2]).to.have.property("writable").that.equals(false);

    expect(thing.interaction[2].form).to.have.lengthOf(1);
    expect(thing.interaction[2].form[0]).to.have.property("mediaType").that.equals("application/json");
    expect(thing.interaction[2].form[0]).to.have.property("href").that.equals("coap://mytemp.example.com:5683/humid");
  }

  @test "should parse additional contexts"() {
    let thing: Thing = TDParser.parseTDString(tdSampleLemonbeatBurlingame);

    expect(thing).to.have.property("context").that.has.lengthOf(2); // TD, { actuator, sensor }
    expect(thing).to.have.property("semanticType").to.have.lengthOf(1); // "sensor:Sensor"
    expect(thing.semanticType[0]).to.have.property("prefix").that.equals("sensor");
    expect(thing.semanticType[0]).to.have.property("name").that.equals("Sensor");
    expect(thing).to.have.property("name").that.equals("LemonbeatThings");
    expect(thing).to.have.property("base").that.equals("http://192.168.1.176:8080/");

    expect(thing.interaction).to.have.lengthOf(6);
    expect(thing.interaction[0]).to.have.property("name").that.equals("luminance");
    expect(thing.interaction[0]).to.have.property("pattern").that.equals("Property");
    expect(thing.interaction[0]).to.have.property("semanticType").to.have.lengthOf(1); // "sensor:luminance"
    expect(thing.interaction[0].semanticType[0]).to.have.property("prefix").that.equals("sensor");
    expect(thing.interaction[0].semanticType[0]).to.have.property("name").that.equals("luminance");
    expect(thing.interaction[0]).to.have.property("metadata").to.have.lengthOf(1); // "sensor:unit": "sensor:Candela"
    expect(thing.interaction[0].metadata[0]).to.have.property("type").that.has.property("prefix").that.equals("sensor");
    expect(thing.interaction[0].metadata[0]).to.have.property("type").that.has.property("name").that.equals("unit");
    expect(thing.interaction[0].metadata[0]).to.have.property("value").that.equals("sensor:Candela");

    expect(thing.interaction).to.have.lengthOf(6);
    expect(thing.interaction[1]).to.have.property("name").that.equals("humidity");
    expect(thing.interaction[1]).to.have.property("pattern").that.equals("Property");
    expect(thing.interaction[1]).to.have.property("semanticType").to.have.lengthOf(1); // "sensor:humidity"
    expect(thing.interaction[1].semanticType[0]).to.have.property("prefix").that.equals("sensor");
    expect(thing.interaction[1].semanticType[0]).to.have.property("name").that.equals("humidity");
    expect(thing.interaction[1]).to.have.property("metadata").to.have.lengthOf(1); // "sensor:unit": "sensor:Percent"
    expect(thing.interaction[1].metadata[0]).to.have.property("type").that.has.property("prefix").that.equals("sensor");
    expect(thing.interaction[1].metadata[0]).to.have.property("type").that.has.property("name").that.equals("unit");
    expect(thing.interaction[1].metadata[0]).to.have.property("value").that.equals("sensor:Percent");

    expect(thing.interaction).to.have.lengthOf(6);
    expect(thing.interaction[4]).to.have.property("name").that.equals("turnOn");
    expect(thing.interaction[4]).to.have.property("pattern").that.equals("Action");
    expect(thing.interaction[4]).to.have.property("semanticType").to.have.lengthOf(1); // "actuator:turnOn"
    expect(thing.interaction[4].semanticType[0]).to.have.property("prefix").that.equals("actuator");
    expect(thing.interaction[4].semanticType[0]).to.have.property("name").that.equals("turnOn");
    expect(thing.interaction[4]).to.have.property("metadata").to.have.lengthOf(0);
  }

  @test "should return same TD in round-trips"() {
    // sample1
    let thing1: Thing = TDParser.parseTDString(tdSample1);
    let newJson1 = TDParser.serializeTD(thing1);

    let jsonExpected = JSON.parse(tdSample1);
    let jsonActual = JSON.parse(newJson1);

    expect(jsonActual).to.deep.equal(jsonExpected);

    // sample2
    let thing2: Thing = TDParser.parseTDString(tdSample2)
    let newJson2 = TDParser.serializeTD(thing2);

    jsonExpected = JSON.parse(tdSample2);
    jsonActual = JSON.parse(newJson2);

    expect(jsonActual).to.deep.equal(jsonExpected);

    // sample3
    // Note: avoid href normalization in this test-case
    // "href": "coap://mytemp.example.com:5683/interactions/temp" vs "href": "temp"
    let thing3: Thing = TDParser.parseTDString(tdSample3, false);
    let newJson3 = TDParser.serializeTD(thing3);

    jsonExpected = JSON.parse(tdSample3);
    jsonActual = JSON.parse(newJson3);

    expect(jsonActual).to.deep.equal(jsonExpected);

    // sampleLemonbeatBurlingame
    // Note: avoid href normalization in this test-case
    let tdLemonbeatBurlingame: Thing = TDParser.parseTDString(tdSampleLemonbeatBurlingame, false)

    // test context
    /*
    "@context": [
      "https://w3c.github.io/wot/w3c-wot-td-context.jsonld",
      {
        "actuator": "http://example.org/actuator#",
        "sensor": "http://example.org/sensors#"
      }
    ],
    */

    /*
    // simple contexts
    let scs = tdLemonbeatBurlingame.context;
    expect(scs).to.have.lengthOf(1);
    expect(scs[0]).that.equals("https://w3c.github.io/wot/w3c-wot-td-context.jsonld");

    // prefixed contexts
    let pcs = tdLemonbeatBurlingame.getPrefixedContexts();

    expect(pcs).to.have.lengthOf(2);
    expect(pcs[0].prefix).that.equals("actuator");
    expect(pcs[0].context).that.equals("http://example.org/actuator#");
    expect(pcs[1].prefix).that.equals("sensor");
    expect(pcs[1].context).that.equals("http://example.org/sensors#");
    */

    let newJsonLemonbeatBurlingame = TDParser.serializeTD(tdLemonbeatBurlingame);

    jsonExpected = JSON.parse(tdSampleLemonbeatBurlingame);
    jsonActual = JSON.parse(newJsonLemonbeatBurlingame);

    expect(jsonActual).to.deep.equal(jsonExpected);
  }


  @test "should parse and serialize metadata fields"() {
    // parse TD
    let td: Thing = TDParser.parseTDString(tdSampleMetadata1);

    expect(td).to.have.property("context").that.has.lengthOf(1);
    expect(td).to.have.property("semanticType").to.have.lengthOf(0); // semanticType is subset of @type

    expect(td).to.have.property("name").that.equals("MyTemperatureThing3");
    expect(td).to.have.property("base").that.equals("coap://mytemp.example.com:5683/interactions/");

    // thing metadata "reference": "myTempThing" in metadata
    expect(td).to.have.property("metadata").to.have.lengthOf(1);
    expect(td.metadata[0].type).to.have.property("name").that.equals("reference");
    expect(td.metadata[0]).to.have.property("value").that.equals("myTempThing");

    expect(td.interaction).to.have.lengthOf(1);
    expect(td.interaction[0]).to.have.property("name").that.equals("myTemp");
    expect(td.interaction[0]).to.have.property("pattern").that.equals("Property");
    expect(td.interaction[0]).to.have.property("writable").that.equals(false);

    // metadata
    expect(td.interaction[0]).to.have.property("metadata").to.have.lengthOf(2);
    // metadata "unit": "celsius"
    expect(td.interaction[0].metadata[0].type).to.have.property("name").that.equals("unit");
    expect(td.interaction[0].metadata[0]).to.have.property("value").that.equals("celsius");
    // metadata "reference": "threshold"
    expect(td.interaction[0].metadata[1].type).to.have.property("name").that.equals("reference");
    expect(td.interaction[0].metadata[1]).to.have.property("value").that.equals("threshold");

    expect(td.interaction[0].form).to.have.lengthOf(1);
    expect(td.interaction[0].form[0]).to.have.property("mediaType").that.equals("application/json");
    expect(td.interaction[0].form[0]).to.have.property("href").that.equals("coap://mytemp.example.com:5683/interactions/temp");

    // serialize
    let newJson = TDParser.serializeTD(td);
  }

}
