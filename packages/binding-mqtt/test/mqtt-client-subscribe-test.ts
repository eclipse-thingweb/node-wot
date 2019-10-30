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


import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import { expect, should, assert } from "chai";
// should must be called to augment all variables
should();

import { Servient, ExposedThing } from "@node-wot/core";

import MqttBrokerServer from "../dist/mqtt-broker-server";
import MqttClientFactory from "../dist/mqtt-client-factory";





@suite("MQTT implementation")
class MqttClientSubscribeTest {

    @test.skip "should expose via broker"(done: Function) {

        try {

            let servient = new Servient();

            let brokerServer = new MqttBrokerServer("mqtt://test.mosquitto.org:1883");
            servient.addServer(brokerServer);
            
            servient.addClientFactory(new MqttClientFactory());

            var counter = 0;

            servient.start().then( (WoT) => {

                expect(brokerServer.getPort()).to.equal(1883);
                expect(brokerServer.getAddress()).to.equal("test.mosquitto.org");

                WoT.produce({ title: "TestWoTMQTT" })
                    .then((thing) => {
                        if(thing instanceof ExposedThing) {
                            let exposedThing : ExposedThing = thing;
                            thing.addEvent("event1", { type: "number" });

                            thing.expose();
    
                            console.info("Exposed", thing.title);
    
                            WoT.consume(thing.getTD())
                                .then((client) => {
                                    let check = 0;
                                    client.subscribeEvent("event1",
                                        (x) => {
                                            expect(x).to.equal(++check);
                                            if (check === 3) done();
                                        }
                                    )
                                    .then(() => { })
                                    .catch((e) => { expect(true).to.equal(false); });
            
                                    var job = setInterval(() => {
                                        ++counter;
                                        thing.events.event1.emit(counter); // sends data to the topic /TestWoTMQTT/events/event1
            
                                        if (counter === 3) clearInterval(job);
                                    }, 100);
                                });
                        } else {
                            throw("no ExposedThing");
                        }
                    });
            });

        } catch (err) {
            console.error("ERROR", err);
        }
    }
}
