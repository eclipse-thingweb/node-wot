/********************************************************************************
 * Copyright (c) 2018 Contributors to the Eclipse Foundation
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
import Servient, { ProtocolServer, ExposedThing } from "@node-wot/core";
// should must be called to augment all variables
should();
import { default as MqttClient } from "../src/mqtt-client";
import { BrokerProxy, MqttMessage, MqttForm, MqttPublish, MqttSubscribe } from "../src/mqtt";
import BrokerProxyMock from "./broker-proxy-mock";

interface TestVector {
    op: Array<string>
    mqttVersion: number
    type?: string
    schema?: any
    payload: any
    form: MqttForm
}
class MqttServerMock implements ProtocolServer {
    scheme: string;
    private port: number;
    private address: string = undefined;
    private broker: BrokerProxy;
    private testVector: TestVector;

    constructor(port?: number, address?: string) {
        this.port = port;
        this.broker = new BrokerProxyMock({
            port: this.port,
            protocol: "mqtt",
            protocolVersion: 4
        });
        this.address = address;
    }

    expose(thing: ExposedThing): Promise<void> {
        throw new Error("Method not implemented.");
    }

    start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.broker.start().then(() => {
                this.broker.receive().subscribe((message: MqttPublish|MqttSubscribe) => this.checkRequest(message));
                resolve();
            });
        });
    }

    stop(): Promise<void> {
        return this.broker.stop();
    }

    getPort(): number {
        return this.port;
    }

    public setTestVector(vector: TestVector) {
        if (!vector.op) throw new Error("No vector op given");
        //TODO vector method?
        this.testVector = vector;
        this.broker.update({
            type: "publish",
            topic: this.testVector.form["mqtt:topic"],
            payload: this.testVector.payload,
            retain: this.testVector.form["mqtt:retain"]
        });
    }

    private checkRequest(message: MqttPublish | MqttSubscribe) {
        if (!this.testVector) throw new Error("No test vector given");

        //TODO
        console.log("---------------------------------------");
        console.log(JSON.stringify(message));

        expect(message.topic).to.equal(this.testVector.form["mqtt:topic"]);
        expect(message.type).to.equal(this.testVector.type);
        if (message.type === "publish") {
            message = <MqttPublish> message;
            expect(message.payload.equals(this.testVector.payload));
            expect(message.retain).to.equal(this.testVector.form["mqtt:retain"]);

            if (this.testVector.mqttVersion === 5) {
                expect(message.properties.contentType).to.equal(this.testVector.form.contentType);
            }
        }
    }
}

@suite("MQTT client implementation")
class MqttClientTest {

    @test async readResource() {
        let mqttServer = new MqttServerMock(11883);
        await mqttServer.start();
        expect(mqttServer.getPort()).to.equal(11883);

        let client = new MqttClient({
            host: "127.0.0.1",
            port: 11883,
            protocolVersion: 4
        }, false);

        let inputVector = {
            op: ["readproperty"],
            payload: Buffer.from("test"),
            mqttVersion: 4,
            type: "subscribe",
            form: {
                href: "mqtt://localhost:11883",
                contentType: "application/json",
                "mqtt:topic": "/resource",
                "mqtt:retain": true
            }
        }

        mqttServer.setTestVector(inputVector);
        await client.readResource(inputVector.form);
    }

    @test async writeResource() {
        let mqttServer = new MqttServerMock(12883);
        await mqttServer.start();
        expect(mqttServer.getPort()).to.equals(12883);

        let client = new MqttClient({
            host: "127.0.0.1",
            port: 12883,
            protocolVersion: 4
        }, false);

        let inputVector = {
            op: ["writeProperty"],
            payload: Buffer.from("test"),
            mqttVersion: 4,
            type: "publish",
            form: {
                href: "mqtt://localhost:12883",
                contentType: "application/json",
                "mqtt:topic": "/resource",
                "mqtt:retain": true
            }
        }

        mqttServer.setTestVector(inputVector);
        await client.writeResource(inputVector.form, { body: Buffer.from("test"), type: "application/json"});
    }

    @test async invokeAction() {
        let mqttServer = new MqttServerMock(13883);
        await mqttServer.start();
        expect(mqttServer.getPort()).to.equals(13883);

        let client = new MqttClient({
            host: "127.0.0.1",
            port: 13883,
            protocolVersion: 4
        }, false);

        let inputVector = {
            op: ["invokeResource"],
            payload: Buffer.from("actionTest"),
            mqttVersion: 4,
            type: "publish",
            form: {
                href: "mqtt://localhost:13883",
                contentType: "application/json",
                "mqtt:topic": "/resource",
                "mqtt:retain": false
            }
        }

        mqttServer.setTestVector(inputVector);
        client.invokeResource(inputVector.form, { body: Buffer.from("actionTest"), type: "application/json"});
    }

    @test async subscribeResource() {
        let mqttServer = new MqttServerMock(14883);
        await mqttServer.start();
        expect(mqttServer.getPort()).to.equals(14883);

        let client = new MqttClient({
            host: "127.0.0.1",
            port: 14883,
            protocolVersion: 4
        }, false);

        let inputVector = {
            op: ["subscribeResource"],
            payload: Buffer.from("test"),
            mqttVersion: 4,
            type: "publish",
            form: {
                href: "mqtt://localhost:14883",
                contentType: "application/json",
                "mqtt:topic": "/resource",
                "mqtt:retain": true
            }
        }

        mqttServer.setTestVector(inputVector);
        await client.subscribeResource(inputVector.form, val => {
            //TODO
            expect(true);
        });
    }
}