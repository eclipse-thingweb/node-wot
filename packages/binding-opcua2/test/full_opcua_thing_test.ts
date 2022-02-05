// node-wot implementation of W3C WoT Servient

import { expect } from "chai";
import { ExposedThing, Servient } from "@node-wot/core";
import { OPCUAServer, DataValue } from "node-opcua";

import { OPCUAClientFactory } from "../src";
import { startServer } from "./fixture/basic_opcua_server";
const endpoint = "opc.tcp://localhost:7890";

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
                },
            ],
        },
    },
    actions: {},
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

    it("Z2- should create a servient (consume) with OPCUA client factory", async () => {
        const servient = new Servient();

        const opcuaClientFactory = new OPCUAClientFactory();

        servient.addClientFactory(opcuaClientFactory);

        const wot = await servient.start();

        const thing: WoT.ConsumedThing = await wot.consume(thingDescription);

        console.debug(thing.getThingDescription().properties);

        try {
            {
                // read temperature before
                const contentA = await (await thing.readProperty("temperatureSetPoint")).value();
                console.log("temperature setpoint Before", contentA.toString());
            }

            await thing.writeProperty("temperatureSetPoint", 100);

            {
                // read temperature after
                const content = await thing.readProperty("temperatureSetPoint");
                const content2 = (await content.value()) as DataValue;
                console.log("Temperature After", content2.toString());
            }
        } finally {
            console.log("Now shuting down");
            // create a ConsumedThing
            //  const consumedThing = new ExposedThing(thing);
            await servient.shutdown();
        }
    });
});
