/********************************************************************************
 * Copyright (c) 2021 Contributors to the Eclipse Foundation
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
 * Protocol test suite to test protocol implementations
 */

import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { MqttClient, MqttForm } from "../src/mqtt";
import { expect, should } from "chai";
import { Aedes, Server } from "aedes";
import * as net from "net";
import { Content } from "@node-wot/core";
import { Readable } from "stream";

chai.use(chaiAsPromised);

// should must be called to augment all variables
should();

describe.skip("MQTT client implementation - unit", () => {
    // Note: fails with Error: Connection closed

    let aedes: Aedes;
    let hostedBroker: net.Server;
    const property = "test1";
    const brokerAddress = "localhost";
    const brokerPort = 1889;
    const brokerUri = `mqtt://${brokerAddress}:${brokerPort}`;

    before(() => {
        aedes = Server({});
    });

    after(() => {
        aedes.close();
    });

    describe("tests without authorization", () => {
        beforeEach(() => {
            hostedBroker = net.createServer(aedes.handle);
            hostedBroker.listen(brokerPort);
        });

        afterEach(() => {
            hostedBroker.close();
        });

        it("should publish and subscribe", (done: Mocha.Done) => {
            const mqttClient = new MqttClient();
            const form: MqttForm = {
                href: brokerUri + "/" + property,
                "mqv:qos": "2",
                "mqv:retain": false,
            };

            mqttClient
                .subscribeResource(form, async (value: Content) => {
                    try {
                        const data = await value.toBuffer();
                        expect(data.toString()).to.be.equal("test");
                        done();
                    } catch (err) {
                        done(err);
                    }
                })
                .then(async (sub) => {
                    await mqttClient.invokeResource(form, new Content("", Readable.from(Buffer.from("test"))));
                    await mqttClient.stop();
                })
                .catch((err) => done(err));
        }).timeout(10000);

        it("should subscribe unsubscribe and subscribe again", (done: Mocha.Done) => {
            const mqttClient = new MqttClient();
            const form: MqttForm = {
                href: brokerUri + "/" + property,
                "mqv:qos": "2",
                "mqv:retain": false,
            };

            mqttClient
                .subscribeResource(form, () => {
                    /** No-op */
                })
                .then(async (sub) => {
                    await mqttClient.unlinkResource(form);
                    await mqttClient.subscribeResource(form, async (value: Content) => {
                        try {
                            const data = await value.toBuffer();
                            expect(data.toString()).to.be.equal("test");
                            done();
                        } catch (err) {
                            done(err);
                        } finally {
                            // Note: stopping the client clears also all subscriptions
                            await mqttClient.stop();
                        }
                    });
                    await mqttClient.invokeResource(form, new Content("", Readable.from(Buffer.from("test"))));
                })
                .catch((err) => done(err));
        }).timeout(10000);
    });

    describe("tests with authorization", () => {
        beforeEach(() => {
            aedes.authenticate = function (_client, username: Readonly<string>, password: Readonly<Buffer>, done) {
                if (username !== undefined) {
                    done(null, username === "user" && password.equals(Buffer.from("pass")));
                    return;
                }
                done(null, true);
            };
            const server = net.createServer(aedes.handle);
            hostedBroker = server.listen(brokerPort);
        });

        afterEach(() => {
            hostedBroker.close();
        });

        it("should not authenticate with basic auth", (done: Mocha.Done) => {
            const mqttClient = new MqttClient();
            mqttClient.setSecurity([{ scheme: "basic" }], { username: "user", password: "wrongpass" });

            const form: MqttForm = {
                href: brokerUri + "/" + property,
                "mqv:qos": "1",
                "mqv:retain": false,
            };

            mqttClient
                .subscribeResource(form, () => {
                    /** */
                })
                .then(() => done(new Error("Should not authenticate")))
                .should.eventually.be.rejectedWith(Error, "Connection refused: Not authorized")
                .then(() => done());
        }).timeout(10000);

        it("should authenticate with basic auth", async () => {
            const mqttClient = new MqttClient();
            mqttClient.setSecurity([{ scheme: "basic" }], { username: "user", password: "pass" });

            const form: MqttForm = {
                href: brokerUri + "/" + property,
                "mqv:qos": "1",
                "mqv:retain": false,
            };

            await mqttClient.subscribeResource(form, () => {});
            await mqttClient.stop();
        }).timeout(10000);
    });
});
