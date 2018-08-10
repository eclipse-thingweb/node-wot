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
 * MQTT Broker Server based on http
 */

import { IPublishPacket } from 'mqtt';
import * as mqtt from 'mqtt';
import * as url from 'url';

import { ProtocolServer, ResourceListener, ContentSerdes } from "@node-wot/core";
import { EventResourceListener, ActionResourceListener } from "@node-wot/core";

export default class MqttBrokerServer implements ProtocolServer {

    readonly scheme: string = 'mqtt';

    private port: number = -1;
    private address: string = undefined;

    private user: string = undefined; // in the case usesername is required to connect the broker

    private psw: string = undefined; // in the case password is required to connect the broker

    private brokerURI: string = undefined;

    private readonly resources: { [key: string]: ResourceListener } = {};

    private broker: any;

    constructor(uri: string, user?: string, psw?: string) {
        if (uri !== undefined) {

            //if there is a MQTT protocol identicator missing, add this
            if (uri.indexOf("://") == -1) {
                uri = this.scheme + "://" + uri;
            }
            this.brokerURI = uri;
        }

        if (user !== undefined) {
            this.user = user;
        }
        if (psw !== undefined) {
            this.psw = psw;
        }
    }

    public addResource(path: string, res: ResourceListener): boolean {
        
        if (this.broker === undefined) return false;

        if (this.resources[path] !== undefined) {
            console.warn(`MqttBrokerServer at ${this.brokerURI} already has resource '${path}' - skipping`);
            return false;
        } else {
            console.log(`MqttBrokerServer at ${this.brokerURI} adding resource '${path}'`);
            this.resources[path] = res;

            if (res instanceof EventResourceListener) {

                let subscription = res.subscribe({
                    next: (content) => {
                        // send event data
                        console.log(`MqttBrokerServer at ${this.brokerURI} publishing to topic '${path}'`);
                        this.broker.publish(path, content.body)
                    }
                    //TODO: when to complete?
                    //complete: () => res.
                });

            }

            if (res instanceof ActionResourceListener) {

                // for Action: we going to subscribe this topic and check if there some new value provided on this topic
                this.broker.subscribe(path);

                this.broker.on("message", (receivedTopic: ByteString, payload: string, packet: IPublishPacket) => {
                    //console.log("Received MQTT message (topic, data): (" + receivedTopic + ", "+ payload + ")");
                    if (receivedTopic === path) {

                        // TODO mediaType handling here
                        res.onInvoke({ contentType: ContentSerdes.DEFAULT, body: Buffer.from(payload) })
                            .then(content => {
                                // Actions have a void return (no output)                            
                            })
                            .catch((err) => {
                                console.error(err);
                            });
                    }
                })
            }

            return true;
        }
    }

    public removeResource(path: string): boolean {
        console.log(`MqttBrokerServer at ${this.brokerURI} removing resource '${path}'`);
        return delete this.resources[path];
    }

    public start(): Promise<void> {
        return new Promise<void>((resolve, reject) => {

            if (this.brokerURI === undefined) {
                console.warn(`No broker defined for MQTT server binding - skipping`);
                resolve();
            }

            // try to connect to the broker without or with credentials
            if (this.psw == undefined) {
                console.info(`MqttBrokerServer trying to connect to broker at ${this.brokerURI}`);
                // TODO test if mqtt extracts port from passed URI (this.address)
                this.broker = mqtt.connect(this.brokerURI);
            } else {
                console.info(`MqttBrokerServer trying to connect to secured broker at ${this.brokerURI}`);
                // TODO test if mqtt extracts port from passed URI (this.address)
                this.broker = mqtt.connect({ host: this.brokerURI }, { username: this.user, password: this.psw });
            }

            this.broker.on("connect", () => {
                console.log(`MqttBrokerServer connected to broker at ${this.brokerURI}`);

                let parsed = url.parse(this.brokerURI);
                this.address = parsed.hostname;
                let port = parseInt(parsed.port);
                this.port = port>0 ? port : 1883;
                resolve();
            });
            this.broker.on("error", (error: Error) => {
                console.error(`MqttBrokerServer could not connect to broker at ${this.brokerURI}`);
                reject(error);
            });
        });
    }

    public stop(): Promise<void> {
        return new Promise<void>((resolve, reject) => {

            if (this.broker === undefined) resolve();

            this.broker.stop();
        });
    }

    public getPort(): number {
        return this.port;
    }

    public getAddress(): string {
        return this.address;
    }
}