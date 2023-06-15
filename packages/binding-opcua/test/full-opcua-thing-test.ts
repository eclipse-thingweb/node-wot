/********************************************************************************
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
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

// node-wot implementation of W3C WoT Servient

import { expect } from "chai";
import { ExposedThing, Servient, createLoggers } from "@node-wot/core";
import { InteractionOptions } from "wot-typescript-definitions";

import { OPCUAServer } from "node-opcua";

import { OPCUAClientFactory } from "../src";
import { startServer } from "./fixture/basic-opcua-server";
const endpoint = "opc.tcp://localhost:7890";

const { debug } = createLoggers("binding-opcua", "full-opcua-thing-test");

const thingDescription: WoT.ThingDescription = {
    "@context": "https://www.w3.org/2019/wot/td/v1",
    "@type": ["Thing"],

    securityDefinitions: { nosec_sc: { scheme: "nosec" } },
    security: "nosec_sc",

    title: "servient",
    description: "node-wot CLI Servient",

    opcua: {
        namespace: ["http://opcfoundation.org/UA", "own", "http://opcfoundation.org/UA/DI/"],
        endpoint,
    },
    base: endpoint,
    properties: {
        // bare value like needed by WoT
        temperature: {
            description: "the temperature in the room",
            observable: true,
            readOnly: true,
            unit: "°C",
            "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor/2:ParameterSet/1:Temperature" },
            // Don't specifu type here as it could be multi form: type: [ "object", "number" ],
            forms: [
                // 0 -> standard Node WoT form => Raw value
                {
                    href: "/", // endpoint,
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor/2:ParameterSet/1:Temperature" },
                    contentType: "application/json",
                },
                {
                    href: "/", // endpoint,
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor/2:ParameterSet/1:Temperature" },
                    contentType: "application/opcua+json;type=Value;dataType=Double",
                },
                {
                    href: "/", // endpoint,
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor/2:ParameterSet/1:Temperature" },
                    contentType: "application/opcua+json;type=Variant",
                },
                {
                    href: "/", // endpoint,
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor/2:ParameterSet/1:Temperature" },
                    contentType: "application/opcua+json;type=DataValue",
                },
            ],
        },
        // Enriched value like provided by OPCUA
        $Variant$temperature: {
            description: "the temperature in the room",
            observable: true,
            readOnly: true,
            unit: "°C",
            "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor/2:ParameterSet/1:Temperature" },
            contentType: "application/json",
            type: "object",
            properties: {
                Type: {
                    type: "number",
                },
                Body: {
                    // could be any ! type: [ "object" , "number", "boolean" ],
                },
            },
            forms: [
                {
                    type: "object",
                    href: "/", // endpoint,
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor/2:ParameterSet/1:Temperature" },
                    contentType: "application/opcua+json;type=Variant",
                },
            ],
        },
        // --------------------------------------------------
        temperatureSetPoint: {
            description: "the temperature set point",
            observable: true,
            unit: "°C",
            // dont't
            forms: [
                {
                    href: "/",
                    op: ["readproperty", "observeproperty", "writeproperty"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor/2:ParameterSet/1:TemperatureSetPoint" },
                    contentType: "application/json",
                },
                {
                    href: "/",
                    op: ["readproperty", "observeproperty", "writeproperty"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor/2:ParameterSet/1:TemperatureSetPoint" },
                    contentType: "application/opcua+json;type=Value;dataType=Double",
                },
                {
                    href: "/",
                    op: ["readproperty", "observeproperty", "writeproperty"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor/2:ParameterSet/1:TemperatureSetPoint" },
                    contentType: "application/opcua+json;type=Variant",
                },
                {
                    href: "/",
                    op: ["readproperty", "observeproperty", "writeproperty"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor/2:ParameterSet/1:TemperatureSetPoint" },
                    contentType: "application/opcua+json;type=DataValue",
                },
            ],
        },
    },
    actions: {
        setTemperatureSetPoint: {
            forms: [
                {
                    type: "object",
                    href: "/",
                    op: ["invokeaction"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor" },
                    "opcua:method": { root: "i=84", path: "/Objects/1:MySensor/2:MethodSet/1:SetTemperatureSetPoint" },
                },
            ],
            description: "set the temperature set point",
            // see https://www.w3.org/TR/wot-thing-description11/#action-serialization-sample
            input: {
                type: "object",
                properties: {
                    TargetTemperature: {
                        title: "the new temperature set point",
                        type: "number",
                        // minimum: 0,
                        // maximum: 100,
                    },
                },
                required: ["TargetTemperature"],
            },
            output: {
                type: "object",
                properties: {
                    PreviousSetPoint: {
                        type: "number",
                        title: "the previous temperature set point",
                        // minimum: 0,
                        // maximum: 100,
                    },
                },
                required: ["PreviousSetPoint"],
            },
        },
        $OPCUA$setTemperatureSetPoint: {
            forms: [
                {
                    type: "object",
                    href: "/",
                    op: ["invokeaction"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor" },
                    "opcua:method": { root: "i=84", path: "/Objects/1:MySensor/2:MethodSet/1:SetTemperatureSetPoint" },
                    contentType: "application/opcua+json;type=Variant",
                },
            ],
            description: "set the temperature set point",
            // see https://www.w3.org/TR/wot-thing-description11/#action-serialization-sample
            input: {
                type: "object",
                properties: {
                    TargetTemperature: {
                        title: "the new temperature set point",
                        type: "object", // a variant of type double
                        // minimum: 0,
                        // maximum: 100,
                    },
                },
                required: ["TargetTemperature"],
            },
            output: {
                type: "object",
                properties: {
                    PreviousSetPoint: {
                        type: "object", // << Note here this is an object reprensenting a JSON OPCUA Variant
                        title: "the previous temperature set point",
                        // minimum: 0,
                        // maximum: 100,
                    },
                },
                required: ["PreviousSetPoint"],
            },
        },

        GetSongLyrics: {
            forms: [
                {
                    type: "object",
                    href: "/",
                    op: ["invokeaction"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor" },
                    "opcua:method": { root: "i=84", path: "/Objects/1:MySensor/2:MethodSet/1:GetSongLyrics" },
                },
            ],
            input: {
                type: "object",
                properties: {
                    SongList: {
                        title: "the songs to sing",
                        type: "array",
                        // minimum: 0,
                        // maximum: 100,
                    },
                    Volume: {
                        type: "number",
                        minimum: 0,
                        maximum: 255,
                    },
                },
                required: ["SongList", "Volume"],
            },
            output: {
                type: "object",
                properties: {
                    SoundAndLyrics: {
                        type: "array",
                        title: "an array of key value pair containing song as key and lyrics as value",
                        // minimum: 0,
                        // maximum: 100,
                    },
                },
                required: ["SoundAndLyrics"],
            },
        },
        $OPCUA$GetSongLyrics: {
            forms: [
                {
                    type: "object",
                    href: "/",
                    op: ["invokeaction"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor" },
                    "opcua:method": { root: "i=84", path: "/Objects/1:MySensor/2:MethodSet/1:GetSongLyrics" },
                    contentType: "application/opcua+json;type=Variant",
                },
            ],
            input: {
                type: "object",
                properties: {
                    SongList: {
                        title: "the songs to sing",
                        type: "array",
                        // minimum: 0,
                        // maximum: 100,
                    },
                    Volume: {
                        type: "number",
                        minimum: 0,
                        maximum: 255,
                    },
                },
                required: ["SongList", "Volume"],
            },
            output: {
                type: "object",
                properties: {
                    SoundAndLyrics: {
                        type: "array",
                        title: "an array of key value pair containing song as key and lyrics as value",
                        // minimum: 0,
                        // maximum: 100,
                    },
                },
                required: ["SoundAndLyrics"],
            },
        },
    },
};

describe("Full OPCUA Thing Test", () => {
    let opcuaServer: OPCUAServer;
    before(async () => {
        opcuaServer = await startServer();
    });
    after(async () => {
        await opcuaServer.shutdown();
    });

    it("Z1- should create a servient (produce) with OPCUA client factory", async () => {
        const servient = new Servient();

        const opcuaClientFactory = new OPCUAClientFactory();
        servient.addClientFactory(opcuaClientFactory);

        const wot = await servient.start();
        const thing = await wot.produce(thingDescription);

        thing.expose();

        let temperature = 10;
        thing.setPropertyReadHandler("temperature", async () => temperature);

        const expThing = thing as ExposedThing;
        const readHandler = expThing.__propertyHandlers.get("temperature").readHandler;
        expect(readHandler, "must have a readHandler");
        const temperatureCheck1 = await readHandler();
        expect(temperatureCheck1).to.equal(10);

        temperature = 100;

        const temperatureCheck2 = await readHandler();
        expect(temperatureCheck2).to.equal(100);

        await servient.shutdown();
    });

    async function makeThing() {
        const servient = new Servient();

        const opcuaClientFactory = new OPCUAClientFactory();

        servient.addClientFactory(opcuaClientFactory);

        const wot = await servient.start();

        const thing: WoT.ConsumedThing = await wot.consume(thingDescription);

        debug(`${thing.getThingDescription().properties}`);

        return { thing, servient };
    }
    async function doTest(thing: WoT.ConsumedThing, propertyName: string, localOptions: InteractionOptions) {
        debug("------------------------------------------------------");
        try {
            const content = await thing.readProperty(propertyName, localOptions);
            const json = await content.value();
            debug(json?.toString());
            return json;
        } catch (e) {
            debug(e.toString());
            return { err: e.message };
        }
    }
    it("Z2 - test $Variant$temperature", async () => {
        const { thing, servient } = await makeThing();
        try {
            const propertyName = "$Variant$temperature";
            const json0 = await doTest(thing, propertyName, {});
            expect(json0).to.eql({
                Type: 11,
                Body: 25,
            });
        } finally {
            await servient.shutdown();
        }
    });

    it("Z3 - test temperature with various formIndex", async () => {
        const { thing, servient } = await makeThing();
        const propertyName = "temperature";

        try {
            const json0 = await doTest(thing, propertyName, { formIndex: 0 });
            expect(json0).to.eql(25);

            const json1 = await doTest(thing, propertyName, { formIndex: 1 });
            expect(json1).to.eql(25);

            const json2 = await doTest(thing, propertyName, { formIndex: 2 });
            expect(json2).to.eql({ Type: 11, Body: 25 });

            expect(thingDescription.properties.temperature.forms[3].contentType).eql(
                "application/opcua+json;type=DataValue"
            );
            const json3 = await doTest(thing, propertyName, { formIndex: 3 });
            debug(json3?.toString());
            expect((json3 as Record<string, unknown>).Value).to.eql({ Type: 11, Body: 25 });
        } finally {
            await servient.shutdown();
        }
    });

    const readTemperature = async (thing: WoT.ConsumedThing): Promise<number> => {
        const content = await thing.readProperty("temperatureSetPoint");
        const value = await content.value();
        debug(`TemperatureSetPoint = ${value}`);
        return value as number;
    };

    it("Z4- should create a servient (consume) with OPCUA client factory - writeProperty - application/json ", async () => {
        const { thing, servient } = await makeThing();

        try {
            // read temperature before
            const temperatureBefore = await readTemperature(thing);
            expect(temperatureBefore).to.eql(27);

            // ---------------------------------------------- application/json
            expect(thingDescription.properties.temperatureSetPoint.forms[0].contentType).eql("application/json");
            await thing.writeProperty("temperatureSetPoint", 110);
            const temperatureAfter = await readTemperature(thing);
            expect(temperatureAfter).to.eql(110);
        } finally {
            await servient.shutdown();
        }
    });

    it("Z5- should create a servient (consume) with OPCUA client factory - writeProperty - application/opcua+json;type=DataValue", async () => {
        const { thing, servient } = await makeThing();
        try {
            // ---------------------------------------------- application/opcua+json;type=DataValue
            expect(thingDescription.properties.temperatureSetPoint.forms[3].contentType).eql(
                "application/opcua+json;type=DataValue"
            );
            await thing.writeProperty(
                "temperatureSetPoint",
                { Value: { Type: 11, Body: 100 }, StatusCode: 1, SourceTimestamp: new Date() },
                { formIndex: 3 }
            );
            const temperatureAfter2 = await readTemperature(thing);
            expect(temperatureAfter2).to.eql(100);
        } finally {
            await servient.shutdown();
        }
    });

    it("Z6- should create a servient (consume) with OPCUA client factory - writeProperty - application/opcua+json;type=Variant", async () => {
        const { thing, servient } = await makeThing();
        try {
            // ---------------------------------------------- application/opcua+json;type=Variant
            expect(thingDescription.properties.temperatureSetPoint.forms[2].contentType).eql(
                "application/opcua+json;type=Variant"
            );
            await thing.writeProperty("temperatureSetPoint", { Type: 11, Body: 90 }, { formIndex: 2 });

            const temperatureAfter3 = await readTemperature(thing);
            expect(temperatureAfter3).to.eql(90);
        } finally {
            await servient.shutdown();
        }
    });

    it("Z7 - should create a servient (consume) with OPCUA client factory - InvokeAction - simplest form", async () => {
        const { thing, servient } = await makeThing();

        await thing.writeProperty("temperatureSetPoint", 27);

        try {
            // read temperature before
            const contentA = await thing.invokeAction("setTemperatureSetPoint", { TargetTemperature: 26 });
            const returnedValue = await contentA.value();

            debug(`Temperature setpoint before ${returnedValue}`);
            expect(returnedValue).to.eql({ PreviousSetPoint: 27 });

            const contentVerif = await (await thing.readProperty("temperatureSetPoint")).value();
            debug(`Temperature setpoint before -verified ${contentVerif}`);
            expect(contentVerif).to.eql(26);
        } finally {
            await servient.shutdown();
        }
    });

    it("Z8 - should create a servient (consume) with OPCUA client factory - InvokeAction - application/opcua+json;type=Variant", async () => {
        const { thing, servient } = await makeThing();

        await thing.writeProperty("temperatureSetPoint", 27);

        try {
            // read temperature before
            const contentA = await thing.invokeAction("$OPCUA$setTemperatureSetPoint", {
                TargetTemperature: { Type: 11, Body: 26 },
            });
            const returnedValue = await contentA.value();

            debug(`Temperature setpoint before ${returnedValue}`);
            expect(returnedValue).to.eql({ PreviousSetPoint: { Type: 11, Body: 27 } });

            const contentVerif = await (await thing.readProperty("temperatureSetPoint")).value();
            debug(`Temperature setpoint before -verified ${contentVerif}`);
            expect(contentVerif).to.eql(26);
        } finally {
            await servient.shutdown();
        }
    });

    it("Z9 - should create a servient (consume) with OPCUA client factory - InvokeAction (GetSongLyrics) - simplest form", async () => {
        const { thing, servient } = await makeThing();

        try {
            const content = await (
                await thing.invokeAction("GetSongLyrics", {
                    SongList: ["Jingle Bell", "Mary has a little lamb"],
                    Volume: 100,
                })
            ).value();
            const returnedValue = content;
            debug(`Return value ${JSON.stringify(returnedValue, null, " ")}`);
            expect(returnedValue).to.eql({
                SoundAndLyrics: [
                    {
                        Key: {
                            Name: "Jingle Bell",
                        },
                        Value: "Lyrics for 'Jingle Bell' (Volume = 100)",
                    },
                    {
                        Key: {
                            Name: "Mary has a little lamb",
                        },
                        Value: "Lyrics for 'Mary has a little lamb' (Volume = 100)",
                    },
                ],
            });
        } finally {
            await servient.shutdown();
        }
    });

    xit("Z10 - should create a servient (consume) with OPCUA client factory - InvokeAction (GetSongLyrics) - application/opcua+json;type=Variant", async () => {
        const { thing, servient } = await makeThing();

        try {
            const content = await (
                await thing.invokeAction("$OPCUA$GetSongLyrics", {
                    SongList: ["Jingle Bell", "Mary has a little lamb"],
                    Volume: 100,
                })
            ).value();
            const returnedValue = content;
            debug(`Return value ${JSON.stringify(returnedValue, null, " ")}`);
            expect(returnedValue).to.eql({
                SoundAndLyrics: [
                    {
                        TypeId: {
                            Id: 14533,
                        },
                        Body: {
                            Key: {
                                Name: "Jingle Bell",
                            },
                            Value: {
                                Type: 12,
                                Body: "Lyrics for 'Jingle Bell' (Volume = 100)",
                            },
                        },
                    },
                    {
                        TypeId: {
                            Id: 14533,
                        },
                        Body: {
                            Key: {
                                Name: "Mary has a little lamb",
                            },
                            Value: {
                                Type: 12,
                                Body: "Lyrics for 'Mary has a little lamb' (Volume = 100)",
                            },
                        },
                    },
                ],
            });
        } finally {
            await servient.shutdown();
        }
    });
});
