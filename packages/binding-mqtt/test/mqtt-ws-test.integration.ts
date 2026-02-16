import { Servient } from "@node-wot/core";
import MqttClientFactory from "../src/mqtt-client-factory";
import MqttBrokerServer from "../src/mqtt-broker-server";
import * as WoT from "wot-typescript-definitions";

describe("MQTT over WebSocket Integration Test", () => {
    let servient: Servient;
    let wot: typeof WoT;

    beforeAll(async () => {
        servient = new Servient();

        // Register all MQTT schemes
        servient.addClientFactory(new MqttClientFactory("mqtt"));
        servient.addClientFactory(new MqttClientFactory("mqtts"));
        servient.addClientFactory(new MqttClientFactory("ws+mqtt"));
        servient.addClientFactory(new MqttClientFactory("wss+mqtt"));

        wot = await servient.start();
    });

    afterAll(async () => {
        await servient.shutdown();
    });

    it("should consume Thing via ws+mqtt composite scheme", async () => {
        const td = {
            title: "MQTTTestThing",
            securityDefinitions: { nosec_sc: { scheme: "nosec" } },
            security: ["nosec_sc"],
            properties: {
                status: {
                    type: "string",
                    forms: [
                        {
                            href: "ws://localhost:9001/test/status",
                            subprotocol: "mqtt",
                            op: ["readproperty"],
                        },
                    ],
                },
            },
        };

        const thing = await wot.consume(td as any);

        const output = await thing.readProperty("status");

        expect(output).toBeDefined();
    });
});
