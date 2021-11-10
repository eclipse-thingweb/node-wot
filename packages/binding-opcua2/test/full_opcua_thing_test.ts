// node-wot implementation of W3C WoT Servient

import { expect } from "chai";
import { ExposedThing, Servient } from "@node-wot/core";
import { OPCUAServer, DataType } from "node-opcua";

import { OPCUAClientFactory } from "../src";
import { startServer } from "./fixture/basic_opcua_server";
import { DataValueJSON } from "node-opcua-json";
const endpoint = "opc.tcp://localhost:7890";

// function schemaVariantMaker(dataType: DataType) {
//     const valueType = (() => {
//         switch (dataType) {
//             case DataType.Boolean:
//                 return "boolean";
//             case DataType.Byte:
//             case DataType.SByte:
//             case DataType.Float:
//             case DataType.Double:
//                 return "number";
//         }
//         return "object";
//     })();

//     const schema = {
//         type: "object",
//         properties: {
//             Type: {
//                 type: "number",
//                 minimum: dataType,
//                 maximum: dataType,
//             },
//             Value: {
//                 type: "object",
//             },
//         },
//     };
//     return schema;
// }

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
        temperature: {
            description: "the temperature in the room",
            observable: true,
            readOnly: true,
            unit: "°C",
            "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor/2:ParameterSet/1:Temperature" },
            forms: [
                {
                    type: "object",
                    href: "/", // endpoint,
                    op: ["readproperty", "writeproperty", "observeproperty"],
                },
                {
                    type: "number",
                    href: "/", // endpoint,
                    op: ["writeproperty"],
                },
            ],
        },
        temperatureSetPoint: {
            description: "the temperature set point",
            observable: true,
            readOnly: false,
            unit: "°C",
            forms: [
                {
                    type: "object",
                    href: "/",
                    op: ["readproperty", "observeproperty", "writeproperty"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor/2:ParameterSet/1:TemperatureSetPoint" },
                    contentType: "application/json+opcua;type=Value;dataType=Double",
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
    },
};

describe("Full OPCUA Thing Test", () => {
    let opcuaServer: OPCUAServer;
    let endpoint: string;
    before(async () => {
        opcuaServer = await startServer();
        endpoint = opcuaServer.getEndpointUrl();
        console.log("endpoint = ", endpoint);
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

        thing.setPropertyWriteHandler(
            "temperature",
            async (value: WoT.InteractionOutput, options?: WoT.InteractionOptions) => {
                temperature = (await value.value()) as number;
            }
        );

        const expThing = thing as ExposedThing;
        const propertyState = expThing.properties.temperature.getState();

        const temperatureCheck1 = await propertyState.readHandler();
        expect(temperatureCheck1).to.equal(10);
        /* 
        
        TODO: how to make this work ?

                await propertyState.writeHandler(100);
                const temperatureCheck2 = await propertyState.readHandler();
                expect(temperatureCheck2).to.equal(100);
        */
        await servient.shutdown();
    });

    it("Z2- should create a servient (consume) with OPCUA client factory - readProperty", async () => {
        const servient = new Servient();

        const opcuaClientFactory = new OPCUAClientFactory();

        servient.addClientFactory(opcuaClientFactory);

        const wot = await servient.start();

        const thing: WoT.ConsumedThing = await wot.consume(thingDescription);

        console.debug(thing.getThingDescription().properties);

        try {
            {
                // read temperature before
                const content = await thing.readProperty("temperatureSetPoint");
                const dataValueJSON = (await content.value()).valueOf() as DataValueJSON;
                console.log("Temperature After", dataValueJSON);
                expect(dataValueJSON.Value).to.eql({ Type: 11, Body: 27.0 });
            }

            await thing.writeProperty("temperatureSetPoint", { Value: { Type: 11, Body: 100 } });

            {
                // read temperature after
                const content = await thing.readProperty("temperatureSetPoint");
                const dataValueJSON = (await content.value()).valueOf() as DataValueJSON;
                console.log("Temperature After", dataValueJSON);
                expect(dataValueJSON.Value).to.eql({ Type: 11, Body: 100.0 });
            }
        } finally {
            await servient.shutdown();
        }
    });

    it("Z3 - should create a servient (consume) with OPCUA client factory - InvokeAction", async () => {
        const servient = new Servient();

        const opcuaClientFactory = new OPCUAClientFactory();

        servient.addClientFactory(opcuaClientFactory);

        const wot = await servient.start();

        const thing: WoT.ConsumedThing = await wot.consume(thingDescription);

        console.debug(thing.getThingDescription().properties);

        await thing.writeProperty("temperatureSetPoint", { Value: { Type: DataType.Double, Body: 27 } });

        try {
            // read temperature before
            const contentA = await (
                await thing.invokeAction("setTemperatureSetPoint", { TargetTemperature: 26 })
            ).value();
            const returnedValue = contentA.valueOf();
            console.log("temperature setpoint Before", returnedValue);
            expect(returnedValue).to.eql({ PreviousSetPoint: 27 });

            const contentVerif = await (await thing.readProperty("temperatureSetPoint")).value();
            console.log("temperature setpoint Before -verified ", contentVerif.valueOf());
            expect((contentVerif.valueOf() as DataValueJSON).Value).to.eql({ Body: 26.0, Type: 11 });
        } finally {
            await servient.shutdown();
        }
    });

    it("Z4 - should create a servient (consume) with OPCUA client factory - InvokeAction (GetSongLyrics)", async () => {
        const servient = new Servient();

        const opcuaClientFactory = new OPCUAClientFactory();

        servient.addClientFactory(opcuaClientFactory);

        const wot = await servient.start();

        const thing: WoT.ConsumedThing = await wot.consume(thingDescription);

        console.debug(thing.getThingDescription().properties);

        try {
            const content = await (
                await thing.invokeAction("GetSongLyrics", {
                    SongList: ["Jingle Bell", "Mary has a little lamb"],
                    Volume: 100,
                })
            ).value();
            const returnedValue = content.valueOf();
            // console.log("return value", JSON.stringify(returnedValue, null, " "));
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
