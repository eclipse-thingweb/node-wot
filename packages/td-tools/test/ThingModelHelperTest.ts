/* eslint-disable no-unused-expressions */
/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
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

import { suite, test } from "@testdeck/mocha";
import { expect } from "chai";
import { ThingModel } from "wot-thing-model-types";

import { ThingModelHelpers, CompositionOptions, modelComposeInput } from "../src/thing-model-helpers";
import { promises as fs } from "fs";
@suite("tests to verify the Thing Model Helper")
class ThingModelHelperTest {
    private thingModelHelpers = new ThingModelHelpers();

    @test "should correctly validate tm schema with ThingModel in @type"() {
        const model = {
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            title: "thingTest",
            "@type": "tm:ThingModel",
            properties: {
                myProp: {
                    type: "number",
                },
            },
        };

        const validated = ThingModelHelpers.validateThingModel(model as unknown as ThingModel);

        expect(model).to.exist;
        expect(validated.valid).to.be.true;
        expect(validated.errors).to.be.undefined;
    }

    @test "should correctly return the right links"() {
        const thing = {
            title: "thingTest",
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            "@type": "tm:ThingModel",
            links: [
                {
                    rel: "tm:submodel",
                    href: "./Ventilation.tm.jsonld",
                    type: "application/tm+json",
                    instanceName: "ventilation",
                },
                {
                    rel: "tm:submodel",
                    href: "./LED.tm.jsonld",
                    type: "application/tm+json",
                    instanceName: "led",
                },
            ],
        };

        // eslint-disable-next-line dot-notation
        const extLinks = ThingModelHelpers["getThingModelLinks"](thing, "tm:submodel");
        expect(extLinks).to.have.lengthOf(2);
    }

    @test "should correctly validate tm schema with ThingModel in @type array "() {
        const model = {
            title: "thingTest",
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            "@type": ["random:Type", "tm:ThingModel"],
            properties: {
                myProp: {
                    type: "number",
                },
            },
        };

        const validated = ThingModelHelpers.validateThingModel(model as unknown as ThingModel);

        expect(model).to.exist;
        expect(validated.valid).to.be.true;
        expect(validated.errors).to.be.undefined;
    }

    @test "should reject schema on validation because missing ThingModel definition"() {
        const model = {
            title: "thingTest",
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            "@type": "random:Type",
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

        const validated = ThingModelHelpers.validateThingModel(model as unknown as ThingModel);

        expect(model).to.exist;
        expect(validated.valid).to.be.false;
    }

    @test "should correctly return the model version"() {
        let thing: ThingModel = {
            title: "thingTest",
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            "@type": ["random:Type", "tm:ThingModel"],
            version: { model: "0.0.1" }, // TODO: check is version is valid
        };

        let version = ThingModelHelpers.getModelVersion(thing);

        expect(version).to.be.equal("0.0.1");

        thing = {
            title: "thingTest",
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            "@type": ["random:Type", "tm:ThingModel"],
            version: {},
        };

        version = ThingModelHelpers.getModelVersion(thing);
        expect(version).to.be.undefined;

        thing = {
            title: "thingTest",
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            "@type": ["random:Type", "tm:ThingModel"],
        };

        version = ThingModelHelpers.getModelVersion(thing);
        expect(version).to.be.undefined;
    }

    @test async "should correctly extend a thing model with properties"() {
        const modelJSON = await fs.readFile("test/thing-model/tmodels/SmartLampControlExtend.jsonld");
        const finalJSON = await fs.readFile("test/thing-model/tmodels/SmartLampControlExtended.jsonld");
        const model = JSON.parse(modelJSON.toString()) as ThingModel;
        const finalModel = JSON.parse(finalJSON.toString()) as ThingModel;

        // eslint-disable-next-line dot-notation
        const modelInput = await this.thingModelHelpers["fetchAffordances"](model);
        // eslint-disable-next-line dot-notation
        const [extendedModel] = await this.thingModelHelpers["composeModel"](model, modelInput);
        expect(extendedModel).to.be.deep.equal(finalModel);
    }

    @test async "should correctly extend a thing model with actions"() {
        const modelJSON = await fs.readFile("test/thing-model/tmodels/SmartLampControlExtend.jsonld");
        const model = JSON.parse(modelJSON.toString()) as ThingModel;
        const finalModel = {
            "@type": "tm:ThingModel",
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            title: "Smart Lamp Control with Dimming",
            links: [
                {
                    rel: "type",
                    href: "./SmartLampControlwithDimming.tm.jsonld",
                    type: "application/tm+json",
                },
            ],
            properties: {
                dim: {
                    title: "Dimming level",
                    type: "integer",
                    minimum: 0,
                    maximum: 100,
                },
            },
            actions: {
                toggle: { type: "boolean" },
            },
        };
        const modelInput: modelComposeInput = {
            extends: [
                {
                    "@type": "tm:ThingModel",
                    "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
                    actions: {
                        toggle: { type: "boolean" },
                    },
                },
            ],
        };
        // eslint-disable-next-line dot-notation
        const [extendedModel] = await this.thingModelHelpers["composeModel"](model, modelInput);
        expect(extendedModel).to.be.deep.equal(finalModel);
    }

    @test async "should correctly import a property in a thing model"() {
        const modelJSON = await fs.readFile("test/thing-model/tmodels/SmartLampControlImport.jsonld");
        const finalJSON = await fs.readFile("test/thing-model/tmodels/SmartLampControlImported.jsonld");
        const model = JSON.parse(modelJSON.toString()) as ThingModel;
        const finalModel = JSON.parse(finalJSON.toString()) as ThingModel;
        // const validated = ThingModelHelpers.validateExposedThingModelInit(model);
        // eslint-disable-next-line dot-notation
        const modelInput = await this.thingModelHelpers["fetchAffordances"](model);
        // eslint-disable-next-line dot-notation
        const [importedModel] = await this.thingModelHelpers["composeModel"](model, modelInput);
        expect(importedModel).to.be.deep.equal(finalModel);
    }

    @test async "should correctly import a property and remove a field of the property"() {
        const thingModel: ThingModel = {
            title: "thingTest",
            "@type": ["random:Type", "tm:ThingModel"],
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            properties: {
                timestamp1: {
                    "tm:ref": "file://./test/thing-model/tmodels/OnOff.jsonld#/properties/timestamp",
                    description: undefined,
                },
            },
        };

        const finalThingModel = {
            title: "thingTest",
            "@type": ["random:Type", "tm:ThingModel"],
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            properties: {
                timestamp1: {
                    type: "number",
                    minimum: 0,
                    maximum: 300,
                },
            },
            links: [
                {
                    rel: "type",
                    href: "./thingTest.tm.jsonld",
                    type: "application/tm+json",
                },
            ],
        };
        // eslint-disable-next-line dot-notation
        const modelInput = await this.thingModelHelpers["fetchAffordances"](thingModel);
        // eslint-disable-next-line dot-notation
        const [importedModel] = await this.thingModelHelpers["composeModel"](thingModel, modelInput);
        expect(importedModel).to.be.deep.equal(finalThingModel);
    }

    @test async "should correctly import an action and add a field to the action"() {
        const thingModel: ThingModel = {
            title: "thingTest",
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            "@type": ["random:Type", "tm:ThingModel"],
            actions: {
                toggle1: {
                    description: "This is a description",
                },
            },
        };
        const modelInput: modelComposeInput = {
            imports: [
                {
                    affordance: { type: "boolean" },
                    type: "actions",
                    name: "toggle1",
                },
            ],
        };

        const finalThingModel = {
            title: "thingTest",
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            "@type": ["random:Type", "tm:ThingModel"],
            actions: {
                toggle1: {
                    type: "boolean",
                    description: "This is a description",
                },
            },
            links: [
                {
                    rel: "type",
                    href: "./thingTest.tm.jsonld",
                    type: "application/tm+json",
                },
            ],
        };
        // eslint-disable-next-line dot-notation
        const [importedModel] = await this.thingModelHelpers["composeModel"](thingModel, modelInput);
        expect(importedModel).to.be.deep.equal(finalThingModel);
    }

    @test async "should correctly fill placeholders"() {
        const thing = {
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            "@type": "tm:ThingModel",
            title: "Thermostate No. {{THERMOSTATE_NUMBER}}",
            base: "mqtt://{{MQTT_BROKER_ADDRESS}}",
            properties: {
                temperature: {
                    description: "Shows the current temperature value",
                    type: "number",
                    minimum: "{{THERMOSTATE_NUMBER}}",
                    maximum: "{{THERMOSTATE_TEMPERATURE_MAXIMUM}}",
                    observable: "{{THERMOSTATE_TEMPERATURE_OBSERVABLE}}",
                },
            },
        } as unknown as ThingModel;
        const map = {
            THERMOSTATE_NUMBER: 4,
            MQTT_BROKER_ADDRESS: "192.168.178.72:1883",
            THERMOSTATE_TEMPERATURE_MAXIMUM: 47.7,
            THERMOSTATE_TEMPERATURE_OBSERVABLE: true,
        };
        const finalJSON = {
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            "@type": "Thing",
            title: "Thermostate No. 4",
            base: "mqtt://192.168.178.72:1883",
            links: [
                {
                    href: "./ThermostateNo.4.tm.jsonld",
                    rel: "type",
                    type: "application/tm+json",
                },
            ],
            properties: {
                temperature: {
                    description: "Shows the current temperature value",
                    type: "number",
                    minimum: 4,
                    maximum: 47.7,
                    observable: true,
                },
            },
        };
        const options: CompositionOptions = {
            map,
            selfComposition: false,
        };
        const [partialTd] = await this.thingModelHelpers.getPartialTDs(thing, options);
        expect(partialTd).to.be.deep.equal(finalJSON);
    }

    @test async "should correctly fill placeholders with composed types"() {
        const thing = {
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            "@type": "tm:ThingModel",
            arrayField: "{{ARRAY}}",
            title: "Thermostate No. 4",
            versionInfo: "{{VERSION_INFO}}",
        } as unknown as ThingModel;
        const map = {
            ARRAY: ["random", "random1", "random2"],
            VERSION_INFO: { instance: "xyz", model: "ABC" },
        };
        const finalJSON = {
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            "@type": "Thing",
            title: "Thermostate No. 4",
            arrayField: ["random", "random1", "random2"],
            versionInfo: { instance: "xyz", model: "ABC" },
            links: [
                {
                    href: "./ThermostateNo.4.tm.jsonld",
                    rel: "type",
                    type: "application/tm+json",
                },
            ],
        };
        const options: CompositionOptions = {
            map,
            selfComposition: false,
        };
        const [partialTd] = await this.thingModelHelpers.getPartialTDs(thing, options);
        expect(partialTd).to.be.deep.equal(finalJSON);
    }

    @test async "should correctly fill placeholders with composed types in strings"() {
        const thing = {
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            "@type": "tm:ThingModel",
            data: "data: {{ARRAY}}",
            title: "Thermostate No. 4",
            versionInfo: "version: {{VERSION_INFO}}",
        } as unknown as ThingModel;
        const map = {
            ARRAY: [1, 2, 3],
            VERSION_INFO: { instance: "xyz", model: "ABC" },
        };
        const finalJSON = {
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            "@type": "Thing",
            title: "Thermostate No. 4",
            data: "data: [1,2,3]",
            versionInfo: 'version: {"instance":"xyz","model":"ABC"}',
            links: [
                {
                    href: "./ThermostateNo.4.tm.jsonld",
                    rel: "type",
                    type: "application/tm+json",
                },
            ],
        };
        const options: CompositionOptions = {
            map,
            selfComposition: false,
        };
        const [partialTd] = await this.thingModelHelpers.getPartialTDs(thing, options);
        expect(partialTd).to.be.deep.equal(finalJSON);
    }

    @test async "should reject fill placeholders because of missing fields in map"() {
        const thing = {
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            "@type": "tm:ThingModel",
            title: "Thermostate No. {{THERMOSTATE_NUMBER}}",
            base: "mqtt://{{MQTT_BROKER_ADDRESS}}",
            properties: {
                temperature: {
                    description: "Shows the current temperature value",
                    type: "number",
                    minimum: "{{THERMOSTATE_NUMBER}}",
                    maximum: "{{THERMOSTATE_TEMPERATURE_MAXIMUM}}",
                    observable: "{{THERMOSTATE_TEMPERATURE_OBSERVABLE}}",
                },
            },
        } as unknown as ThingModel;
        const map = {
            // "THERMOSTATE_NUMBER": 4,
            MQTT_BROKER_ADDRESS: "192.168.178.72:1883",
            THERMOSTATE_TEMPERATURE_MAXIMUM: 47.7,
            THERMOSTATE_TEMPERATURE_OBSERVABLE: true,
        };
        const options: CompositionOptions = {
            map,
            selfComposition: false,
        };
        // eslint-disable-next-line dot-notation
        const validated = this.thingModelHelpers["checkPlaceholderMap"](thing, options.map);
        expect(validated.valid).to.be.false;
        expect(validated.errors).to.be.equal(`Missing required fields in map for model ${thing.title}`);
    }

    @test async "should respect tm:optional"() {
        const modelUri = "file://./test/thing-model/tmodels/TmOptional.tm.jsonld";
        const model = await this.thingModelHelpers.fetchModel(modelUri);

        const map = {
            RANDOM_ID_PATTERN: "1234",
        };
        const tdNoOptional = {
            "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
            "@type": "Thing",
            title: "Lamp Thing Model",
            id: "urn:example:1234",
            description: "Lamp Thing Model Description",
            properties: {
                status: {
                    description: "current status of the lamp (on|off)",
                    type: "string",
                    readOnly: true,
                },
            },
            actions: { toggle: { description: "Turn the lamp on or off" } },
            events: {},
            links: [
                {
                    rel: "type",
                    href: "./LampThingModel.tm.jsonld",
                    type: "application/tm+json",
                },
            ],
        };

        const tdOptional = {
            ...tdNoOptional,
            events: {
                overheating: {
                    description: "Lamp reaches a critical temperature (overheating)",
                    data: { type: "string" },
                },
            },
        };

        const options: CompositionOptions = {
            map,
            selfComposition: false,
        };

        const partialTDs = await this.thingModelHelpers.getPartialTDs(model, options);
        expect(partialTDs[0]).to.be.deep.equal(tdOptional);
        expect(partialTDs[1]).to.be.deep.equal(tdNoOptional);
    }
}
