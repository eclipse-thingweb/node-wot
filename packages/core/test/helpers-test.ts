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
import * as TDT from "wot-thing-description-types";

import Helpers from "../src/helpers";

import UriTemplate = require("uritemplate");

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

    @test "should merge global and local uriVariables"() {
        const thing: TDT.ThingDescription = {
            "@context": "https://www.w3.org/2022/wot/td/v1.1",
            title: "thingTest",
            securityDefinitions: {
                basic_sc: { scheme: "basic", in: "header" },
            },
            security: "basic_sc",
            uriVariables: {
                uvGlobal: { type: "integer" },
            },
            properties: {
                myProp: {
                    "tm:ref": "http://example.com/thingTest.tm.jsonld#/properties/myProp",
                    type: "number",
                    uriVariables: {
                        uvLocal: { type: "integer" },
                    },
                    forms: [{ href: "myProp" }],
                },
            },
        };

        if (thing.properties) {
            const ti: TDT.PropertyElement = thing.properties.myProp as TDT.PropertyElement;
            const options: WoT.InteractionOptions = {
                uriVariables: {
                    uvLocal: 123,
                },
            };

            const io: WoT.InteractionOptions = Helpers.parseInteractionOptions(thing, ti, options);

            expect(io).not.to.be.undefined;
            expect(io.uriVariables).not.to.be.undefined;

            const ut = UriTemplate.parse("blix{?uvLocal}");
            const updatedHref = ut.expand(io.uriVariables ?? {});
            expect(updatedHref).to.equal("blix?uvLocal=123");
        } else {
            expect.fail("not properly set-up");
        }
    }

    @test "should use global uriVariables even if there are no local uriVariables"() {
        const thing: TDT.ThingDescription = {
            "@context": "https://www.w3.org/2022/wot/td/v1.1",
            title: "thingTest",
            securityDefinitions: {
                basic_sc: { scheme: "basic", in: "header" },
            },
            security: "basic_sc",
            uriVariables: {
                uvGlobal: { type: "integer" },
            },
            properties: {
                myProp: {
                    "tm:ref": "http://example.com/thingTest.tm.jsonld#/properties/myProp",
                    type: "number",
                    forms: [{ href: "myProp" }],
                },
            },
        };

        if (thing.properties) {
            const ti: TDT.PropertyElement = thing.properties.myProp as TDT.PropertyElement;
            const options: WoT.InteractionOptions = {
                uriVariables: {
                    uvGlobal: 456,
                },
            };

            const io: WoT.InteractionOptions = Helpers.parseInteractionOptions(thing, ti, options);

            expect(io).not.to.be.undefined;

            const ut = UriTemplate.parse("bla{?uvGlobal}");
            const updatedHref = ut.expand(io.uriVariables ?? {});
            expect(updatedHref).to.equal("bla?uvGlobal=456");
        } else {
            expect.fail("not properly set-up");
        }
    }
}
