/* eslint-disable no-unused-expressions */
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
 * Basic test suite for helper functions
 * uncomment the @skip to see failing tests
 *
 * h0ru5: there is currently some problem with VSC failing to recognize experimentalDecorators option, it is present in both tsconfigs
 */

import { suite, test } from "@testdeck/mocha";
import { expect } from "chai";
import { ExposedThingInit } from "wot-typescript-definitions";

import Helpers from "../src/helpers";

@suite("tests to verify the helpers")
class HelperTest {
    @test "should extract the http scheme"() {
        const scheme = Helpers.extractScheme("http://blablupp.de");
        expect(scheme).to.eq("http");
    }

    @test "should extract https scheme"() {
        const scheme = Helpers.extractScheme("https://blablupp.de");
        expect(scheme).to.eq("https");
    }

    @test "should extract scheme when a port is given"() {
        const scheme = Helpers.extractScheme("http://blablupp.de:8080");
        expect(scheme).to.eq("http");
    }

    @test "should extract combined scheme"() {
        const scheme = Helpers.extractScheme("coap+ws://blablupp.de");
        expect(scheme).to.eq("coap+ws");
    }

    @test "should correctly validate schema"() {
        const thing: ExposedThingInit = {
            title: "thingTest",
            properties: {
                myProp: {
                    type: "number",
                },
            },
        };

        const validated = Helpers.validateExposedThingInit(thing);

        expect(thing).to.exist;
        expect(validated.valid).to.be.true;
        expect(validated.errors).to.be.undefined;
    }

    @test "should reject ThingModel with extends on validation"() {
        const thing: ExposedThingInit = {
            title: "thingTest",
            links: [
                {
                    rel: "tm:extends",
                },
            ],
            properties: {
                myProp: {
                    "tm:ref": "http://example.com/thingTest.tm.jsonld#/properties/myProp",
                    type: "number",
                },
            },
        };

        const validated = Helpers.validateExposedThingInit(thing);

        expect(thing).to.exist;
        expect(validated.valid).to.be.false;
    }

    @test "should reject ThingModel with tm:refs on validation"() {
        const thing: ExposedThingInit = {
            title: "thingTest",
            properties: {
                myProp: {
                    "tm:ref": "http://example.com/thingTest.tm.jsonld#/properties/myProp",
                    type: "number",
                },
            },
        };

        let validated = Helpers.validateExposedThingInit(thing);
        expect(validated.valid).to.be.false;

        thing.properties = {};
        thing.actions = { myAction: { "tm:ref": "http://example.com/thingTest.tm.jsonld#/actions/myAction" } };
        validated = Helpers.validateExposedThingInit(thing);
        expect(validated.valid).to.be.false;

        thing.actions = {};
        thing.events = { myEvent: { "tm:ref": "http://example.com/thingTest.tm.jsonld#/actions/myAction" } };
        validated = Helpers.validateExposedThingInit(thing);
        expect(validated.valid).to.be.false;
    }
}
