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
 * Basic test suite for TD transformer functions
 */

import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import { expect } from "chai";

import * as TDTransformer from "../src/td-transformer";

@suite("tests to verify the TD transformer")
class TDTransformerTest {

    @test("convert simple SantaClara TD")
    simple_TD1_V2() {
        var td1_V2 = JSON.parse('{"@context": ["http://w3c.github.io/wot/w3c-wot-td-context.jsonld"],"@type": "Thing","name": "MyTemperatureThing","interactions": [{"@type": ["Property"],"name": "temperature","outputData": {"valueType": { "type": "number" }},"writable": false,"links": [{"href" : "coap://mytemp.example.com:5683/temp","mediaType": "application/json"}]}]}');

        let td1_V1 = TDTransformer.transformTDV2ObjToV1Obj(td1_V2);

        expect(td1_V1["@context"]).to.include("http://w3c.github.io/wot/w3c-wot-td-context.jsonld");
        expect(td1_V1["@type"]).to.eq("Thing");
        expect(td1_V1["name"]).to.eq("MyTemperatureThing");
        expect(td1_V1["properties"]).to.be.an("array");
        expect(td1_V1["interactions"]).to.be.an("undefined");
        expect(td1_V1["properties"][0].name).to.eq("temperature");
        expect(td1_V1["properties"][0].writable).to.eq(false);
        expect(td1_V1["properties"][0].valueType.type).to.eq("number");
        expect(td1_V1["properties"][0].hrefs).to.include("coap://mytemp.example.com:5683/temp");
    }

    @test("convert SantaClara TD with several interactions")
    simple_TD2_V2() {
        var td2_V2 = JSON.parse('{"@context":["https://w3c.github.io/wot/w3c-wot-td-context.jsonld",{"actuator":"http://example.org/actuator#"}],"@type":"Thing","name":"MyLEDThing","base":"coap://myled.example.com:5683/","security":{"cat":"token:jwt","alg":"HS256","as":"https://authority-issuing.example.org"},"interactions":[{"@type":["Property","actuator:onOffStatus"],"name":"status","outputData":{"valueType":{"type":"boolean"}},"writable":true,"links":[{"href":"pwr","mediaType":"application/exi"},{"href":"http://mytemp.example.com:8080/status","mediaType":"application/json"}]},{"@type":["Action","actuator:fadeIn"],"name":"fadeIn","inputData":{"valueType":{"type":"integer"},"actuator:unit":"actuator:ms"},"links":[{"href":"in","mediaType":"application/exi"},{"href":"http://mytemp.example.com:8080/in","mediaType":"application/json"}]},{"@type":["Action","actuator:fadeOut"],"name":"fadeOut","inputData":{"valueType":{"type":"integer"},"actuator:unit":"actuator:ms"},"links":[{"href":"out","mediaType":"application/exi"},{"href":"http://mytemp.example.com:8080/out","mediaType":"application/json"}]},{"@type":["Event","actuator:alert"],"name":"criticalCondition","outputData":{"valueType":{"type":"string"}},"links":[{"href":"ev","mediaType":"application/exi"}]}]}');


        let td2_V1 = TDTransformer.transformTDV2ObjToV1Obj(td2_V2);

        expect(td2_V1["@context"]).to.include("https://w3c.github.io/wot/w3c-wot-td-context.jsonld");
        expect(td2_V1["@type"]).to.eq("Thing");
        expect(td2_V1["name"]).to.eq("MyLEDThing");
        expect(td2_V1["uris"]).to.include("coap://myled.example.com:5683/");
        expect(td2_V1["security"]).to.be.an("object");
        expect(td2_V1["security"].cat).to.eq("token:jwt");
        expect(td2_V1["security"].alg).to.eq("HS256");
        expect(td2_V1["security"].as).to.eq("https://authority-issuing.example.org");
        expect(td2_V1["properties"]).to.be.an("array");
        expect(td2_V1["actions"]).to.be.an("array");
        expect(td2_V1["events"]).to.be.an("array");
        expect(td2_V1["interactions"]).to.be.an("undefined");
        // Properties
        expect(td2_V1["properties"][0].name).to.eq("status");
        expect(td2_V1["properties"][0].writable).to.eq(true);
        expect(td2_V1["properties"][0].valueType.type).to.eq("boolean");
        expect(td2_V1["properties"][0].hrefs).to.include("http://mytemp.example.com:8080/status");
        // Actions
        if(td2_V1["actions"][0].name == "fadeIn") {
            // fadeOut
            expect(td2_V1["actions"][1].name).to.eq("fadeOut");
            expect(td2_V1["actions"][1].inputData.valueType.type).to.eq("integer");
            expect(td2_V1["actions"][1].hrefs).to.include("out");
            expect(td2_V1["actions"][1].hrefs).to.include("http://mytemp.example.com:8080/out");
            // fadeIn
            expect(td2_V1["actions"][0].inputData.valueType.type).to.eq("integer");
            expect(td2_V1["actions"][0].hrefs).to.include("in");
            expect(td2_V1["actions"][0].hrefs).to.include("http://mytemp.example.com:8080/in");
        } else if (td2_V1["actions"][1].name == "fadeIn") {
            // fadeOut
            expect(td2_V1["actions"][0].name).to.eq("fadeOut");
            expect(td2_V1["actions"][0].inputData.valueType.type).to.eq("integer");
            expect(td2_V1["actions"][0].hrefs).to.include("out");
            expect(td2_V1["actions"][0].hrefs).to.include("http://mytemp.example.com:8080/out");
            // fadeIn
            expect(td2_V1["actions"][1].inputData.valueType.type).to.eq("integer");
            expect(td2_V1["actions"][1].hrefs).to.include("in");
            expect(td2_V1["actions"][1].hrefs).to.include("http://mytemp.example.com:8080/in");
        } else {
            // ERROR
            expect(false).to.be.true;
        }

        // Events
        expect(td2_V1["events"][0].name).to.eq("criticalCondition");
        expect(td2_V1["events"][0].valueType.type).to.eq("string");
        expect(td2_V1["events"][0].hrefs).to.include("ev");
    }

    @test("convert simple Duesseldorf TD")
    simple_TD1_V3() {
        var td1_V2 = JSON.parse('{"@context":["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],"@type":["Thing"],"name":"MyTemperatureThing","interaction":[{"@type":["Property"],"name":"temperature","outputData":{"type":"number"},"writable":false,"link":[{"href":"coap://mytemp.example.com:5683/temp","mediaType":"application/json"}]}]}');

        let td1_V1 = TDTransformer.transformTDV3ObjToV1Obj(td1_V2);

        expect(td1_V1["@context"]).to.include("https://w3c.github.io/wot/w3c-wot-td-context.jsonld");
        // expect(td1_V1["@type"]).to.eq("Thing");
        expect(td1_V1["@type"]).to.include("Thing");
        expect(td1_V1["name"]).to.eq("MyTemperatureThing");
        expect(td1_V1["properties"]).to.be.an("array");
        expect(td1_V1["interaction"]).to.be.an("undefined");
        expect(td1_V1["properties"][0].name).to.eq("temperature");
        expect(td1_V1["properties"][0].writable).to.eq(false);
        expect(td1_V1["properties"][0].valueType.type).to.eq("number");
        expect(td1_V1["properties"][0].hrefs).to.include("coap://mytemp.example.com:5683/temp");
    }

    @test("convert Duesseldorf TD with several interactions")
    simple_TD2_V3() {
        var td2_V3 = JSON.parse('{"@context":["https://w3c.github.io/wot/w3c-wot-td-context.jsonld",{"actuator":"http://example.org/actuator#"}],"@type":["Thing"],"name":"MyLEDThing","base":"coap://myled.example.com:5683/","security":{"cat":"token:jwt","alg":"HS256","as":"https://authority-issuing.example.org"},"interaction":[{"@type":["Property","actuator:onOffStatus"],"name":"status","outputData":{"type":"boolean"},"writable":true,"link":[{"href":"pwr","mediaType":"application/exi"},{"href":"http://mytemp.example.com:8080/status","mediaType":"application/json"}]},{"@type":["Action","actuator:fadeIn"],"name":"fadeIn","inputData":{"type":"integer"},"link":[{"href":"in","mediaType":"application/exi"},{"href":"http://mytemp.example.com:8080/in","mediaType":"application/json"}]},{"@type":["Action","actuator:fadeOut"],"name":"fadeOut","inputData":{"type":"integer"},"link":[{"href":"out","mediaType":"application/exi"},{"href":"http://mytemp.example.com:8080/out","mediaType":"application/json"}]},{"@type":["Event","actuator:alert"],"name":"criticalCondition","outputData":{"type":"string"},"link":[{"href":"ev","mediaType":"application/exi"}]}]}');


        let td2_V1 = TDTransformer.transformTDV3ObjToV1Obj(td2_V3);

        expect(td2_V1["@context"]).to.include("https://w3c.github.io/wot/w3c-wot-td-context.jsonld");
        // expect(td2_V1["@type"]).to.eq("Thing");
        expect(td2_V1["@type"]).to.include("Thing");
        expect(td2_V1["name"]).to.eq("MyLEDThing");
        expect(td2_V1["uris"]).to.include("coap://myled.example.com:5683/");
        expect(td2_V1["security"]).to.be.an("object");
        expect(td2_V1["security"].cat).to.eq("token:jwt");
        expect(td2_V1["security"].alg).to.eq("HS256");
        expect(td2_V1["security"].as).to.eq("https://authority-issuing.example.org");
        expect(td2_V1["properties"]).to.be.an("array");
        expect(td2_V1["actions"]).to.be.an("array");
        expect(td2_V1["events"]).to.be.an("array");
        expect(td2_V1["interactions"]).to.be.an("undefined");
        // Properties
        expect(td2_V1["properties"][0].name).to.eq("status");
        expect(td2_V1["properties"][0].writable).to.eq(true);
        expect(td2_V1["properties"][0].valueType.type).to.eq("boolean");
        expect(td2_V1["properties"][0].hrefs).to.include("http://mytemp.example.com:8080/status");
        // Actions
        if(td2_V1["actions"][0].name == "fadeIn") {
            // fadeOut
            expect(td2_V1["actions"][1].name).to.eq("fadeOut");
            expect(td2_V1["actions"][1].inputData.valueType.type).to.eq("integer");
            expect(td2_V1["actions"][1].hrefs).to.include("out");
            expect(td2_V1["actions"][1].hrefs).to.include("http://mytemp.example.com:8080/out");
            // fadeIn
            expect(td2_V1["actions"][0].inputData.valueType.type).to.eq("integer");
            expect(td2_V1["actions"][0].hrefs).to.include("in");
            expect(td2_V1["actions"][0].hrefs).to.include("http://mytemp.example.com:8080/in");
        } else if (td2_V1["actions"][1].name == "fadeIn") {
            // fadeOut
            expect(td2_V1["actions"][0].name).to.eq("fadeOut");
            expect(td2_V1["actions"][0].inputData.valueType.type).to.eq("integer");
            expect(td2_V1["actions"][0].hrefs).to.include("out");
            expect(td2_V1["actions"][0].hrefs).to.include("http://mytemp.example.com:8080/out");
            // fadeIn
            expect(td2_V1["actions"][1].inputData.valueType.type).to.eq("integer");
            expect(td2_V1["actions"][1].hrefs).to.include("in");
            expect(td2_V1["actions"][1].hrefs).to.include("http://mytemp.example.com:8080/in");
        } else {
            // ERROR
            expect(false).to.be.true;
        }

        // Events
        expect(td2_V1["events"][0].name).to.eq("criticalCondition");
        expect(td2_V1["events"][0].valueType.type).to.eq("string");
        expect(td2_V1["events"][0].hrefs).to.include("ev");
    }


}
