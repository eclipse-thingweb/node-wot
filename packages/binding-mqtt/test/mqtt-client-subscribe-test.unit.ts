import { ProtocolHelpers, Content } from "@node-wot/core";
import { Readable } from "stream";
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

import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { MqttBrokerServer, MqttClient, MqttForm, MqttQoS } from "../src/mqtt";
import { expect } from "chai";

chai.use(chaiAsPromised);

// should must be called to augment all variables

describe("MQTT implementation", () => {
    let brokerServer: MqttBrokerServer;
    let brokerUri: string;
    const property = "test1";
    const brokerAddress = "localhost";
    const brokerPort = 1889;

    describe("tests without authorization", () => {
        beforeEach(async () => {
            brokerUri = `mqtt://${brokerAddress}:${brokerPort}`;
            brokerServer = new MqttBrokerServer({ uri: brokerUri, selfHost: true });
            await brokerServer.start(null);
        });

        afterEach(async () => {
            await brokerServer.stop();
        });

        it("should publish and subscribe", (done: Mocha.Done) => {
            const mqttClient = new MqttClient();
            const form: MqttForm = {
                href: brokerUri + "/" + property,
                "mqtt:qos": MqttQoS.QoS0,
                "mqtt:retain": false,
            };

            mqttClient
                .subscribeResource(form, async (value: Content) => {
                    try {
                        const data = await ProtocolHelpers.readStreamFully(value.body);
                        expect(data.toString()).to.be.equal("test");
                        done();
                    } catch (err) {
                        done(err);
                    }
                })
                .then(() => mqttClient.invokeResource(form, { type: "", body: Readable.from(Buffer.from("test")) }))
                .then(() => mqttClient.stop())
                .then(() => brokerServer.stop())
                .catch((err) => done(err));
        });
    });

    describe("tests with authorization", () => {
        beforeEach(async () => {
            brokerUri = `mqtt://${brokerAddress}:${brokerPort}`;
            brokerServer = new MqttBrokerServer({
                uri: brokerUri,
                selfHost: true,
                selfHostAuthentication: [{ username: "user", password: "pass" }],
            });
            await brokerServer.start(null);
        });

        afterEach(async () => {
            await brokerServer.stop();
        });

        it("should not authenticate with basic auth", (done: Mocha.Done) => {
            const mqttClient = new MqttClient();
            mqttClient.setSecurity([{ scheme: "basic" }], { username: "user", password: "wrongpass" });

            const form: MqttForm = {
                href: brokerUri + "/" + property,
                "mqtt:qos": MqttQoS.QoS1,
                "mqtt:retain": false,
            };

            mqttClient
                .subscribeResource(form, () => {
                    /** */
                })
                .then(() => done(new Error("Should not authenticate")))
                .should.eventually.be.rejectedWith(Error, "Connection refused: Not authorized")
                .then(() => done());
        });

        it("should authenticate with basic auth", (done: Mocha.Done) => {
            const mqttClient = new MqttClient();
            mqttClient.setSecurity([{ scheme: "basic" }], { username: "user", password: "pass" });

            const form: MqttForm = {
                href: brokerUri + "/" + property,
                "mqtt:qos": MqttQoS.QoS1,
                "mqtt:retain": false,
            };

            mqttClient
                .subscribeResource(form, () => {
                    /** */
                })
                .then(() => done());
        });
    });
});
