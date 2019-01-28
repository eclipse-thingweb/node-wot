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
//TODO When mqttjs from npm supports MQTT5, use the npm dependency instead.
import * as mqtt from "mqtt";
import { IPublishPacket, IClientPublishOptions, QoS, ISubscriptionMap, IClientOptions } from "mqtt";

import { Subscription } from "rxjs";

import { ProtocolClient, Content } from "@node-wot/core";
import { Form } from "@node-wot/td-tools";

import { MqttForm, MqttQoS, MqttClientOptions } from "./mqtt";

export default class MqttClient implements ProtocolClient {

    // Default values.
    private clientOptions: MqttClientOptions = {
        protocolVersion: 5,
        qos: 1,
        keepAlive: 60
    };
    private secure: boolean;

    constructor(options?: MqttClientOptions, secure: boolean = false) {
        Object.assign(this.clientOptions, options);
        this.secure = secure;
    }

    readResource(form: MqttForm): Promise<Content> {
        /**
         * Reading a resource in WoT-MQTT context means subscribing to the respective topic 
         * and retrieving the retained message.
         */
        return new Promise<Content>((resolve, reject) => {
            const topic = form["mqtt:topic"];
            const retain = form["mqtt:retain"];

            // Connect to MQTT Broker.
            const { client, clientId } = this.connectToBroker(form.href);

            // Subscribing to topic and waiting for retained message.
            client
                .on("connect", () => {
                    client.subscribe(topic, { qos: this.mapQoS(this.clientOptions.qos) }, (err: Error, _: any) => {
                        if (err) {
                            this.logError(`Error on read resource: Could not subscribe with QoS ${this.clientOptions.qos}: ${err.message}`, topic, form.href);
                            reject(err);
                        }
                    });
                })
                .on("message", (receivedTopic, payload, packet: IPublishPacket) => {
                    if (receivedTopic === topic && retain === packet.retain && !packet.dup) {
                        // Received one message successfully, now we can unsubscribe.
                        client.end();
                        resolve({ type: form.contentType, body: payload });
                    }
                })
                .on("error", err => {
                    this.logError(`Error on read resource: ${err.message}`, topic, form.href);
                    if (client) { client.end(); }
                    reject(err);
                });
        });
    }
    writeResource(form: MqttForm, content: Content): Promise<void> {
        /**
         * Writing a resource in WoT-MQTT context means publishing a retained message to the respective topic.
         */
        return new Promise<void>((resolve, reject) => {
            // Extract MQTT meta-data from form.
            const topic = form["mqtt:topic"];

            // Connect to MQTT Broker.
            const { client } = this.connectToBroker(form.href);

            // Publish the property as retained message.
            const options: IClientPublishOptions = { qos: this.mapQoS(this.clientOptions.qos), retain: true, dup: false };
            client
                .on("connect", () => {
                    client.publish(topic, content.body, options, (err, _) => {
                        if (err) {
                            this.logError(`Error on write resource: Could not publish on topic with QoS ${this.clientOptions.qos}: ${err.message}`, topic, form.href);
                            reject(err);
                        } else {
                            client.end();
                            resolve();
                        }
                    });
                })
                .on("error", err => {
                    this.logError(`Error on write resource: ${err.message}`, topic, form.href);
                    if (client) { client.end(); }
                    reject(err);
                });
        });
    }

    //TODO
    invokeResource(form: MqttForm, content: Content): Promise<Content> {
        /**
         * Invoking a resource in WoT-MQTT context means publishing a message with payload 
         * to the specified topic and listen on it for the result of the invokation.
         */
        return new Promise<Content>((resolve, reject) => {
            // Extract MQTT meta-data from form.
            const topic = form["mqtt:topic"];
            //TODO responseTopic

            const { client, clientId } = this.connectToBroker(form.href);
            const options: IClientPublishOptions = { qos: this.mapQoS(this.clientOptions.qos), retain: false, dup: false };
            client
                .on("connect", () => client.publish(topic, content.body, options))
                .on("message", (receivedTopic, payload, packet: IPublishPacket) => {
                    if (receivedTopic === topic && !packet.retain && !packet.dup) {
                        // Received response from broker.
                        //TODO correlation data.
                        client.end();
                        resolve({ type: form.contentType, body: payload });
                    }
                })
                .on("error", err => {
                    if (client) { client.end(); }
                    this.logError(`Error on invoke resource: ${err.message}`, topic, form.href);
                    reject(err);
                });
        });
    }

    unlinkResource(form: Form): Promise<void> {
        // Nothing to do.
        return new Promise(resolve => resolve());
    }

    subscribeResource(form: MqttForm, next: ((value: any) => void), error?: (error: any) => void, complete?: () => void): any {
        // Extract MQTT meta-data from form.
        let topic = form["mqtt:topic"];

        const { client, clientId } = this.connectToBroker(form.href);
        const subscriptionMap: ISubscriptionMap = {};
        subscriptionMap.topic = { qos: this.mapQoS(this.clientOptions.qos) };
        client
            .on("connect", () => client.subscribe(subscriptionMap))
            .on("message", (receivedTopic: string, payload: Buffer, packet: IPublishPacket) => {
                // Filter for the topic we want to listen to.
                if (receivedTopic != clientId && receivedTopic === topic && !packet.dup) {
                    // Retain flag is necessary to differentiate property messages (accept only if retain == true) from event messages (retain ignored).
                    if (typeof form["mqtt:retain"] !== "undefined" && typeof form["mqtt:retain"] !== null) {
                        if (form["mqtt:retain"] === packet.retain) {
                            next({ mediaType: form.contentType, body: payload });
                        }
                    } else {
                        next({ mediaType: form.contentType, body: payload });
                    }

                }
            })
            .on("error", err => {
                if (client) { client.end(); }
                this.logError(`Error on subscribe resource: ${err.message}`, topic, form.href);
                error(err);
            });

        return new Subscription(() => { client.end() });
    }

    start(): boolean {
        return true;
    }

    stop(): boolean {
        return true;
    }

    setSecurity(metadata: Array<WoT.Security>, credentials?: any): boolean {
        if (metadata === undefined || !Array.isArray(metadata) || metadata.length == 0) {
            console.warn(`[MqttClient] No security.`);
        }

        if (credentials === undefined) {
            throw new Error(`No credentials for Thing`);
        }

        let security: WoT.Security = metadata[0];

        /**
         * MQTTv3.1 provides only a username and password field for authentication purposes (sent in the CONNECT package).
         * However, the Standard does not define the semantics of them and the password field can be used 
         * to carry arbitrary payloads.
         * The interpretation of those fields is up to the MQTT applications.
         */
        switch (security.scheme) {
            case "basic":
                this.clientOptions.username = credentials.username;
                this.clientOptions.password = credentials.password;
                break;
            case "bearer":
                this.clientOptions.password = credentials.token;
                break;
            case 'nosec':
                break;
            default:
                this.logError(`Cannot set security scheme '${security.scheme}'`);
                throw new Error(`[MqttClient] Cannot set security scheme '${security.scheme}'`);
                console.dir(metadata);
                return false;
        }

        this.logInfo(`Using security scheme '${security.scheme}'`);
        return true;
    }

    private connectToBroker(brokerUrl: string) {
        let { protocol, hostname, port, pathname } = new URL(brokerUrl);
        protocol = protocol.replace(":", "");
        
        // Generate random client id with constant prefix.
        const clientId = "_node-wot_" + Math.trunc(Math.random() * 1000).toString();

        const clientOptions: IClientOptions = {};
        Object.assign(clientOptions, { protocol, port, pathname });
        // Does not include port.
        clientOptions.host = hostname;
        clientOptions.clientId = clientId;
        Object.assign(clientOptions, { "username": this.clientOptions.username, "password": this.clientOptions.password });

        // MQTTS
        if (this.secure) {
            const cert = this.clientOptions.cert;
            const key = this.clientOptions.key;
            Object.assign(clientOptions, { cert, key });
        }

        this.logInfo(`Connecting to broker '${brokerUrl}' with options '${JSON.stringify(clientOptions)}'.`);
        const client = mqtt.connect(undefined, clientOptions);
        return { client, clientId };
    }

    private mapQoS(qos: MqttQoS): QoS {
        // Mapping between our definition of MQTT QoS and the one from mqtt.js.
        switch (qos) {
            case 2:
                return qos = 2;
            case 1:
                return qos = 1;
            case 0:
            default:
                return qos = 0;
        }
    }

    private logInfo = (message: string): void => {
        console.log(`[MqttClient] ${message}`);
    }
    private logError = (message: string, topic: string = "", broker: string = ""): void => {
        topic = topic === "" ? "" : `|topic:'${topic}'`;
        broker = broker === "" ? "" : `|broker:'${broker}'`;
        console.error(`[MqttClient${topic}${broker}] ${message}`);
    }
}
