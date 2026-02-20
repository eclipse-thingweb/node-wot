import { Servient } from "@node-wot/core";
import MqttClientFactory from "../src/mqtt-client-factory";
import * as WoT from "wot-typescript-definitions";
import assert from "assert";

import aedes from "aedes";
import * as http from "http";
import * as WebSocket from "ws";
import { createWebSocketStream } from "ws";

describe("MQTT over WebSocket Integration Test", () => {
    let servient: Servient;
    let wot: typeof WoT;

    let broker: ReturnType<typeof aedes>;
    let httpServer: http.Server;

    before(async () => {
        broker = aedes();

        httpServer = http.createServer();

        const wsServer = new WebSocket.Server({ server: httpServer });

        wsServer.on("connection", (ws) => {
            const stream = createWebSocketStream(ws);
            broker.handle(stream);
        });

        await new Promise<void>((resolve) => {
            httpServer.listen(9001, resolve);
        });

        servient = new Servient();

        servient.addClientFactory(new MqttClientFactory("mqtt"));
        servient.addClientFactory(new MqttClientFactory("mqtts"));
        servient.addClientFactory(new MqttClientFactory("ws+mqtt"));
        servient.addClientFactory(new MqttClientFactory("wss+mqtt"));

        wot = await servient.start();
    });

    after(async () => {
        await servient.shutdown();

        await new Promise<void>((resolve) => {
            httpServer.close(() => {
                broker.close();
                resolve();
            });
        });
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

        // Publish test message manually through broker
        await new Promise<void>((resolve, reject) => {
            broker.publish(
                {
                    cmd: "publish",
                    topic: "test/status",
                    payload: Buffer.from("online"),
                    qos: 0,
                    retain: false,
                    dup: false,
                },
                (err?: Error) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        const output = await thing.readProperty("status");

        assert.ok(output);
    });
});
