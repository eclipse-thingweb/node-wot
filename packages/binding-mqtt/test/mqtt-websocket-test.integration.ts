/********************************************************************************
 * Copyright (c) 2026 Contributors to the Eclipse Foundation
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
 * MQTT over WebSocket integration tests
 */

import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { MqttClient, MqttClientFactory } from "../src/mqtt";
import { expect, should } from "chai";
import { Aedes, Server } from "aedes";
import { createServer } from "http";
import * as ws from "ws";
import { Content, Form } from "@node-wot/core";
import { Readable } from "stream";
import Servient from "@node-wot/core/dist/servient";

chai.use(chaiAsPromised);
should();

describe("MQTT over WebSocket integration", () => {
    let aedes: Aedes;
    let httpServer: ReturnType<typeof createServer>;
    let wsServer: ws.Server;
    const brokerAddress = "localhost";
    const brokerPort = 8888;
    const wsUri = `ws://${brokerAddress}:${brokerPort}`;
    const compositeUri = `mqtt+ws://${brokerAddress}:${brokerPort}`;

    before((done) => {
        aedes = Server({});
        httpServer = createServer();
        wsServer = new ws.Server({ server: httpServer });

        wsServer.on("connection", (socket) => {
            aedes.handle(socket as never);
        });

        httpServer.listen(brokerPort, () => {
            done();
        });
    });

    after((done) => {
        wsServer.close(() => {
            httpServer.close(() => {
                aedes.close(() => {
                    done();
                });
            });
        });
    });

    describe("MqttClientFactory multi-scheme support", () => {
        it("should declare support for mqtt scheme via getSupportedProtocols()", () => {
            const factory = new MqttClientFactory();
            const protocols = factory.getSupportedProtocols();
            const schemes = protocols.map(([scheme]) => scheme);
            expect(schemes).to.include("mqtt");
        });

        it("should declare support for mqtts scheme via getSupportedProtocols()", () => {
            const factory = new MqttClientFactory();
            const protocols = factory.getSupportedProtocols();
            const schemes = protocols.map(([scheme]) => scheme);
            expect(schemes).to.include("mqtts");
        });

        it("should declare support for ws scheme with mqtt subprotocol via getSupportedProtocols()", () => {
            const factory = new MqttClientFactory();
            const protocols = factory.getSupportedProtocols();
            const hasWsMqtt = protocols.some(([scheme, sub]) => scheme === "ws" && sub === "mqtt");
            expect(hasWsMqtt).to.be.true;
        });

        it("should declare support for wss scheme with mqtt subprotocol via getSupportedProtocols()", () => {
            const factory = new MqttClientFactory();
            const protocols = factory.getSupportedProtocols();
            const hasWssMqtt = protocols.some(([scheme, sub]) => scheme === "wss" && sub === "mqtt");
            expect(hasWssMqtt).to.be.true;
        });
    });

    describe("MQTT client with ws:// URI", () => {
        it.skip("should connect and publish/subscribe using ws:// scheme", (done) => {
            const mqttClient = new MqttClient();
            const topic = "test/websocket";
            const form = new Form(`${wsUri}/${topic}`);
            form["mqv:qos"] = "1";
            form["mqv:retain"] = false;

            mqttClient
                .subscribeResource(form, async (value: Content) => {
                    try {
                        const data = await value.toBuffer();
                        expect(data.toString()).to.equal("websocket-test");
                        await mqttClient.stop();
                        done();
                    } catch (err) {
                        done(err);
                    }
                })
                .then(async () => {
                    await mqttClient.writeResource(
                        form,
                        new Content("text/plain", Readable.from(Buffer.from("websocket-test")))
                    );
                })
                .catch((err) => done(err));
        }).timeout(10000);
    });

    describe("MQTT client with mqtt+ws:// composite URI", () => {
        it.skip("should connect and publish/subscribe using mqtt+ws:// scheme", (done) => {
            const mqttClient = new MqttClient();
            const topic = "test/composite";
            const form = new Form(`${compositeUri}/${topic}`);
            form["mqv:qos"] = "1";
            form["mqv:retain"] = false;

            mqttClient
                .subscribeResource(form, async (value: Content) => {
                    try {
                        const data = await value.toBuffer();
                        expect(data.toString()).to.equal("composite-test");
                        await mqttClient.stop();
                        done();
                    } catch (err) {
                        done(err);
                    }
                })
                .then(async () => {
                    await mqttClient.writeResource(
                        form,
                        new Content("text/plain", Readable.from(Buffer.from("composite-test")))
                    );
                })
                .catch((err) => done(err));
        }).timeout(10000);
    });

    describe("Servient integration with subprotocol", () => {
        it("should route ws:// + subprotocol:mqtt to MqttClientFactory", () => {
            const servient = new Servient();
            const factory = new MqttClientFactory();
            servient.addClientFactory(factory);

            // Test that servient can get client for ws + mqtt subprotocol
            const client = servient.getClientFor("ws", "mqtt");
            expect(client).to.be.instanceOf(MqttClient);
        });

        it("should route wss:// + subprotocol:mqtt to MqttClientFactory", () => {
            const servient = new Servient();
            const factory = new MqttClientFactory();
            servient.addClientFactory(factory);

            // Test that servient can get client for wss + mqtt subprotocol
            const client = servient.getClientFor("wss", "mqtt");
            expect(client).to.be.instanceOf(MqttClient);
        });

        it("should handle mqtt:// scheme to MqttClientFactory", () => {
            const servient = new Servient();
            const factory = new MqttClientFactory();
            servient.addClientFactory(factory);

            // Test that servient can get client for plain mqtt scheme
            const client = servient.getClientFor("mqtt");
            expect(client).to.be.instanceOf(MqttClient);
        });
    });
});
