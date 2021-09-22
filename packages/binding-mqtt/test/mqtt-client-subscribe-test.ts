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
 * Protocol test suite to test protocol implementations
 */

import { suite, test, slow, timeout, skip, only } from "@testdeck/mocha";
import { expect, should, assert } from "chai";
// should must be called to augment all variables
should();

import { Servient, ExposedThing } from "@node-wot/core";

import MqttBrokerServer from "../src/mqtt-broker-server";
import MqttClientFactory from "../src/mqtt-client-factory";
import MqttsClientFactory from "../src/mqtts-client-factory";

@suite("MQTT implementation")
class MqttClientSubscribeTest {

    @test.skip(timeout(10000)) "should expose via broker"(done: Function) {

        try {
            let servient = new Servient();
            var brokerAddress = "test.mosquitto.org"
            var brokerPort = 1883
            var brokerUri = `mqtt://${brokerAddress}:${brokerPort}`

            let brokerServer = new MqttBrokerServer(brokerUri);
            servient.addServer(brokerServer);

            servient.addClientFactory(new MqttClientFactory());

            var counter = 0;

            servient.start().then((WoT) => {
                expect(brokerServer.getPort()).to.equal(brokerPort);
                expect(brokerServer.getAddress()).to.equal(brokerAddress);

                var eventNumber = Math.floor(Math.random() * 1000000);
                var eventName : string = "event" + eventNumber;
                var events : {[key: string] : any} = {};
                events[eventName] = { data: {type: "number"} };

                WoT.produce({
                    title: "TestWoTMQTT",
                    events: events,
                }).then((thing) => {
                    thing.expose().then(() => {
                        console.info(
                            "Exposed",
                            thing.getThingDescription().title
                        );

                        WoT.consume(thing.getThingDescription()).then(
                            (client) => {
                                let check = 0;
                                let sum = 0;
                                let eventReceived = false;

                                client
                                    .subscribeEvent(eventName, (x) => {
                                        if(!eventReceived) {
                                            counter = 0;
                                            eventReceived = true;
                                        } else {
                                            expect(x).to.equal(++check);
                                            if (check === 3) {
                                                done();
                                            }
                                        }
                                    })
                                    .then(() => {
                                        const job = setInterval(() => {
                                            ++counter;
                                            thing.emitEvent(eventName, counter);
                                            if (counter === 3) {
                                                clearInterval(job);
                                            }
                                        }, 1000);
                                    })
                                    .catch((e) => {
                                        expect(true).to.equal(false);
                                    });
                            }
                        );
                    });
                });
            });
        } catch (err) {
            console.error("ERROR", err);
        }
    }

    @test.skip(timeout(5000)) "should subscribe using mqtts"(done: Function) {

        try {
            let servient = new Servient();
            var brokerAddress = "test.mosquitto.org"
            var brokerPort = 8883
            var brokerUri = `mqtts://${brokerAddress}:${brokerPort}`

            let brokerServer = new MqttBrokerServer(brokerUri, undefined,undefined,undefined,undefined, false);
            servient.addServer(brokerServer);

            servient.addClientFactory(new MqttsClientFactory({rejectUnauthorized: false}));

            var counter = 0;

            servient.start().then((WoT) => {
                expect(brokerServer.getPort()).to.equal(brokerPort);
                expect(brokerServer.getAddress()).to.equal(brokerAddress);

                var eventNumber = Math.floor(Math.random() * 1000000);
                var eventName: string = "event" + eventNumber;
                var events: { [key: string]: any } = {};
                events[eventName] = { type: "number" };

                WoT.produce({
                    title: "TestWoTMQTT",
                    events: events,
                }).then((thing) => {
                    thing.expose().then(() => {
                        console.info(
                            "Exposed",
                            thing.getThingDescription().title
                        );

                        WoT.consume(thing.getThingDescription()).then(
                            (client) => {
                                let check = 0;
                                client
                                    .subscribeEvent(eventName, (x) => {
                                        expect(x).to.equal(++check);
                                        if (check === 3) {
                                            done();
                                        }
                                    })
                                    .then(() => { })
                                    .catch((e) => {
                                        expect(true).to.equal(false);
                                    });

                            }
                        );
                    });
                });
            });
        } catch (err) {
            console.error("ERROR", err);
        }
    }
}
