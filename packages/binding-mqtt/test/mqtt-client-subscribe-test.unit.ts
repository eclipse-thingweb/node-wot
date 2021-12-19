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

import { suite, test, timeout } from "@testdeck/mocha";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { MqttClient, MqttForm, MqttQoS } from "../src/mqtt";
import { expect } from "chai";

chai.use(chaiAsPromised);

// should must be called to augment all variables

@suite("MQTT implementation")
class MqttClientSubscribeTest {
    @test(timeout(5000)) "should publish and subscribe"(done: Mocha.Done) {
        const brokerAddress = "test.moquitto.org";
        const property = "test1";
        const brokerPort = 1883;
        const brokerUri = `mqtt://${brokerAddress}:${brokerPort}`;

        const mqttClient = new MqttClient();
        const form: MqttForm = {
            href: brokerUri + "/" + property,
            "mqtt:qos": MqttQoS.QoS0,
            "mqtt:retain": false,
        };
        mqttClient
            .subscribeResource(form, (value: Content) => {
                ProtocolHelpers.readStreamFully(value.body)
                    .then((data) => {
                        expect(data.toString()).to.be.equal("test");
                        done();
                    })
                    .catch((err) => done(err));
            })
            .then(() => mqttClient.invokeResource(form, { type: "", body: Readable.from(Buffer.from("test")) }))
            .then(() => mqttClient.stop());
    }

    @test(timeout(5000)) "should not authenticate with basic auth"(done: Mocha.Done) {
        const brokerAddress = "test.mosquitto.org";
        const property = "test1";
        const brokerPort = 1883;
        const brokerUri = `mqtt://${brokerAddress}:${brokerPort}`;

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
    }

    @test(timeout(5000)) "should authenticate with basic auth"(done: Mocha.Done) {
        const brokerAddress = "test.mosquitto.org";
        const property = "test1";
        const brokerPort = 1883;
        const brokerUri = `mqtt://${brokerAddress}:${brokerPort}`;

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
    }
}
