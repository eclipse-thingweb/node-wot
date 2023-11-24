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

import { createInfoLogger, ProtocolHelpers, Servient } from "@node-wot/core";
import { expect, should } from "chai";
import MqttBrokerServer from "../src/mqtt-broker-server";
import MqttClientFactory from "../src/mqtt-client-factory";
import MqttsClientFactory from "../src/mqtts-client-factory";

const info = createInfoLogger("binding-mqtt", "mqtt-client-subscribe-test.integration");

// should must be called to augment all variables
should();

describe("MQTT client implementation", () => {
    let servient: Servient;
    let brokerServer: MqttBrokerServer;

    const brokerAddress = "localhost";
    const brokerPort = 1889;
    const brokerUri = `mqtt://${brokerAddress}:${brokerPort}`;

    beforeEach(() => {
        servient = new Servient();
    });

    afterEach(async () => {
        await servient.shutdown();
        await brokerServer.stop();
    });

    it("should expose via broker", (done: Mocha.Done) => {
        brokerServer = new MqttBrokerServer({ uri: brokerUri, selfHost: true });
        servient.addServer(brokerServer);

        servient.addClientFactory(new MqttClientFactory());

        servient.start().then((WoT) => {
            expect(brokerServer.getPort()).to.equal(brokerPort);
            expect(brokerServer.getAddress()).to.equal(brokerAddress);

            const eventNumber = Math.floor(Math.random() * 1000000);
            const eventName: string = "event" + eventNumber;
            const events: { [key: string]: Record<string, unknown> } = {};
            events[eventName] = { data: { type: "number" } };

            WoT.produce({
                title: "TestWoTMQTT",
                events,
            }).then((thing) => {
                thing.expose().then(() => {
                    info(`Exposed ${thing.getThingDescription().title}`);

                    WoT.consume(thing.getThingDescription()).then((client) => {
                        let check = 0;
                        let eventReceived = false;

                        client
                            .subscribeEvent(eventName, (x) => {
                                if (!eventReceived) {
                                    eventReceived = true;
                                } else {
                                    if (x.data == null) {
                                        done(new Error("No data received"));
                                        return;
                                    }
                                    ProtocolHelpers.readStreamFully(ProtocolHelpers.toNodeStream(x.data)).then(
                                        (received) => {
                                            expect(JSON.parse(received.toString())).to.equal(++check);
                                            if (check === 3) thing.destroy().then(() => done());
                                        }
                                    );
                                }
                            })
                            .then(() => {
                                for (let i = 0; i < 4; i++) {
                                    thing.emitEvent(eventName, i);
                                }
                            })
                            .catch((e) => {
                                expect(true).to.equal(false);
                            });
                    });
                });
            });
        });
    }).timeout(20000);

    it("should expose via broker using mqtts", (done: Mocha.Done) => {
        brokerServer = new MqttBrokerServer({
            uri: brokerUri,
            selfHost: true,
            key: undefined /** fs.readFileSync("your_key.pem") */,
        });
        servient.addServer(brokerServer);

        servient.addClientFactory(new MqttClientFactory());
        servient.addClientFactory(new MqttsClientFactory({ rejectUnauthorized: false }));

        servient.start().then((WoT) => {
            expect(brokerServer.getPort()).to.equal(brokerPort);
            expect(brokerServer.getAddress()).to.equal(brokerAddress);

            const eventNumber = Math.floor(Math.random() * 1000000);
            const eventName: string = "event" + eventNumber;
            const events: { [key: string]: Record<string, unknown> } = {};
            events[eventName] = { data: { type: "number" } };

            WoT.produce({
                title: "TestWoTMQTT",
                events,
            }).then((thing) => {
                thing.expose().then(() => {
                    info(`Exposed ${thing.getThingDescription().title}`);

                    WoT.consume(thing.getThingDescription()).then((client) => {
                        let check = 0;
                        let eventReceived = false;

                        client
                            .subscribeEvent(eventName, (x) => {
                                if (!eventReceived) {
                                    eventReceived = true;
                                } else {
                                    if (x.data == null) {
                                        done(new Error("No data received"));
                                        return;
                                    }
                                    ProtocolHelpers.readStreamFully(ProtocolHelpers.toNodeStream(x.data)).then(
                                        (received) => {
                                            expect(JSON.parse(received.toString())).to.equal(++check);
                                            if (check === 3) done();
                                        }
                                    );
                                }
                            })
                            .then(() => {
                                for (let i = 0; i < 4; i++) {
                                    thing.emitEvent(eventName, i);
                                }
                            })
                            .catch((e) => {
                                expect(true).to.equal(false);
                            });
                    });
                });
            });
        });
    }).timeout(20000);
});
