/* eslint-disable no-unused-expressions */
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
 * Basic test suite for helper functions
 * uncomment the @skip to see failing tests
 *
 * h0ru5: there is currently some problem with VSC failing to recognize experimentalDecorators option, it is present in both tsconfigs
 */

import { suite, test } from "@testdeck/mocha";
import { expect } from "chai";
import { ExposedThingInit } from "wot-typescript-definitions";

import Helpers from "../src/helpers";
import ThingModelHelpers from "../src/thing-model-helpers";
import { promises as fs } from 'fs';
import Servient from "../src/core";
import { HttpClientFactory } from '@node-wot/binding-http'
import { FileClientFactory } from '@node-wot/binding-file'

@suite("tests to verify the helpers")
class ThingModelHelperTest {

    private srv: Servient;
    async before() {
        this.srv = new Servient();
        this.srv.addClientFactory(new HttpClientFactory())
        this.srv.addClientFactory(new FileClientFactory());
        await this.srv.start();
    }

    @test "should correctly validate tm schema with ThingModel in @type"() {
        const thing: ExposedThingInit = {
            title: "thingTest",
            "@type": 'tm:ThingModel',
            properties: {
                myProp: {
                    type: "number",
                },
            },
        };

        const validated = ThingModelHelpers.validateExposedThingModelInit(thing);

        expect(thing).to.exist;
        expect(validated.valid).to.be.true;
        expect(validated.errors).to.be.undefined;
    }

    @test "should correctly validate tm schema with ThingModel in @type array "() {
        const thing: ExposedThingInit = {
            title: "thingTest",
            "@type": ['random:Type', 'tm:ThingModel'],
            properties: {
                myProp: {
                    type: "number",
                },
            },
        };

        const validated = ThingModelHelpers.validateExposedThingModelInit(thing);

        expect(thing).to.exist;
        expect(validated.valid).to.be.true;
        expect(validated.errors).to.be.undefined;
    }

    @test "should reject schema on validation because missing ThingModel definition"() {
        const thing: ExposedThingInit = {
            title: "thingTest",
            "@type": 'random:Type',
            links: [
                {
                    rel: "tm:extend",
                },
            ],
            properties: {
                myProp: {
                    "tm:ref": "http://example.com/thingTest.tm.jsonld#/properties/myProp",
                    type: "number",
                },
            },
        };

        const validated = ThingModelHelpers.validateExposedThingModelInit(thing);

        expect(thing).to.exist;
        expect(validated.valid).to.be.false;
    }

    @test "should correctly return the model version"() {
        let thing: ExposedThingInit = {
            title: "thingTest",
            "@type": ['random:Type', 'tm:ThingModel'],
            version: { model: '0.0.1'} // TODO: check is version is valid
        };

        let version = ThingModelHelpers.getModelVersion(thing);

        expect(version).to.be.equal('0.0.1');

        thing = {
            title: "thingTest",
            "@type": ['random:Type', 'tm:ThingModel'],
            version: {}
        };

        version = ThingModelHelpers.getModelVersion(thing);
        expect(version).to.be.null;

        thing = {
            title: "thingTest",
            "@type": ['random:Type', 'tm:ThingModel']
        };

        version = ThingModelHelpers.getModelVersion(thing);
        expect(version).to.be.null;

    }

     @test async "should correctly extend a thing model"() {
        const modelJSON = await fs.readFile('test/tmodels/SmartLampControlExtend.jsonld');
        const finalJSON = await fs.readFile('test/tmodels/SmartLampControlExtended.jsonld');
        const model = JSON.parse(modelJSON.toString()) as ExposedThingInit;
        const finalModel = JSON.parse(finalJSON.toString()) as ExposedThingInit;
        const validated = ThingModelHelpers.validateExposedThingModelInit(model);
        const thingModelHelpers = new ThingModelHelpers(this.srv);
        const extendedModel  = await thingModelHelpers.composeModel(model);
        console.log(extendedModel)
        expect(extendedModel).to.be.deep.equal(finalModel);

    }

    // @test "should correctly verify if it extends another model"() {
    //     let thing: ExposedThingInit = {
    //         title: "thingTest",
    //         "@type": ['random:Type', 'tm:ThingModel'],
    //         links:  [{
    //             "rel": "tm:extends",
    //             "href": "http://example.com/BasicOnOffTM",
    //             "type": "application/td+json"
    //          }]
    //     };

    //     let res = ThingModelHelpers.containsThinModelExtends(thing);

    //     expect(version).to.be.equal('0.0.1');

    //     thing = {
    //         title: "thingTest",
    //         "@type": ['random:Type', 'tm:ThingModel'],
    //         version: {}
    //     };

    //     version = ThingModelHelpers.getModelVersion(thing);
    //     expect(version).to.be.null;

    //     thing = {
    //         title: "thingTest",
    //         "@type": ['random:Type', 'tm:ThingModel']
    //     };

    //     version = ThingModelHelpers.getModelVersion(thing);
    //     expect(version).to.be.null;

    // }


    // @test "should extract https scheme"() {
    //     const scheme = Helpers.extractScheme("https://blablupp.de");
    //     expect(scheme).to.eq("https");
    // }

    // @test "should extract scheme when a port is given"() {
    //     const scheme = Helpers.extractScheme("http://blablupp.de:8080");
    //     expect(scheme).to.eq("http");
    // }

    // @test "should extract combined scheme"() {
    //     const scheme = Helpers.extractScheme("coap+ws://blablupp.de");
    //     expect(scheme).to.eq("coap+ws");
    // }

    // @test "should correctly validate schema"() {
    //     const thing: ExposedThingInit = {
    //         title: "thingTest",
    //         properties: {
    //             myProp: {
    //                 type: "number",
    //             },
    //         },
    //     };

    //     const validated = Helpers.validateExposedThingInit(thing);

    //     expect(thing).to.exist;
    //     expect(validated.valid).to.be.true;
    //     expect(validated.errors).to.be.undefined;
    // }

    // @test "should reject ThingModel schema on validation"() {
    //     const thing: ExposedThingInit = {
    //         title: "thingTest",
    //         links: [
    //             {
    //                 rel: "tm:extend",
    //             },
    //         ],
    //         properties: {
    //             myProp: {
    //                 "tm:ref": "http://example.com/thingTest.tm.jsonld#/properties/myProp",
    //                 type: "number",
    //             },
    //         },
    //     };

    //     const validated = Helpers.validateExposedThingInit(thing);

    //     expect(thing).to.exist;
    //     expect(validated.valid).to.be.false;
    // }
}
