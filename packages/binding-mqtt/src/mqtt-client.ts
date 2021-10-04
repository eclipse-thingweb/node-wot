/********************************************************************************
 * Copyright (c) 2018 - 2021 Contributors to the Eclipse Foundation
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

import { ProtocolClient, Content, ContentSerdes } from "@node-wot/core";
import * as TD from "@node-wot/td-tools";
import { SecurityScheme } from "wot-thing-description-types";
import * as mqtt from "mqtt";
import { MqttClientConfig, MqttForm, MqttQoS } from "./mqtt";
import { IPublishPacket, QoS } from "mqtt";
import * as url from "url";
import { Subscription } from "rxjs/Subscription";
import { Readable } from "stream";

export default class MqttClient implements ProtocolClient {
    private user: string = undefined;

    private psw: string = undefined;
    private scheme: string;
    private rejectUnauthorized: boolean;

    constructor(private readonly config: MqttClientConfig = null, secure = false) {
        this.scheme = "mqtt" + (secure ? "s" : "");
    }

    private client: any = undefined;

    public subscribeResource(
        form: MqttForm,
        next: (value: any) => void,
        error?: (error: any) => void,
        complete?: () => void
    ): Promise<Subscription> {
        return new Promise<Subscription>((resolve, reject) => {
            // get MQTT-based metadata
            let contentType = form.contentType;
            let retain = form["mqtt:retain"]; // TODO: is this needed here?
            let qos = form["mqtt:qos"]; // TODO: is this needed here?
            let requestUri = url.parse(form["href"]);
            let topic = requestUri.pathname.slice(1);
            let brokerUri: String = "mqtt://" + requestUri.host;

            if (this.client == undefined) {
                this.client = mqtt.connect(brokerUri);
            }

            this.client.on("connect", () => {
                this.client.subscribe(topic);
                resolve(
                    new Subscription(() => {
                        this.client.unsubscribe(topic);
                    })
                );
            });
            this.client.on("message", (receivedTopic: string, payload: string, packet: IPublishPacket) => {
                console.debug(
                    "[binding-mqtt]",
                    "Received MQTT message (topic, data): (" + receivedTopic + ", " + payload + ")"
                );
                if (receivedTopic === topic) {
                    next({ type: contentType, body: Readable.from(payload) });
                }
            });
            this.client.on("error", (error: any) => {
                if (this.client) {
                    this.client.end();
                }
                this.client == undefined;
                // TODO: error handling
                error(error);
            });
        });
    }

    readResource = (form: MqttForm): Promise<Content> => {
        return new Promise<Content>((resolve, reject) => {
            throw new Error("Method not implemented.");
        });
    };

    writeResource = (form: MqttForm, content: Content): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
            throw new Error("Method not implemented.");
        });
    };

    invokeResource = (form: MqttForm, content: Content): Promise<Content> => {
        return new Promise<Content>((resolve, reject) => {
            let requestUri = url.parse(form["href"]);
            let topic = requestUri.pathname.slice(1);
            let brokerUri: String = `${this.scheme}://${requestUri.host}`;

            if (this.client == undefined) {
                this.client = mqtt.connect(brokerUri, this.config);
            }

            // if not input was provided, set up an own body otherwise take input as body
            if (content == undefined) {
                this.client.publish(topic, JSON.stringify(Buffer.from("")));
            } else {
                this.client.publish(topic, content.body);
            }
            // there will bo no response
            resolve({ type: ContentSerdes.DEFAULT, body: Readable.from([]) });
        });
    };

    unlinkResource = (form: TD.Form): Promise<void> => {
        let requestUri = url.parse(form["href"]);
        let topic = requestUri.pathname.slice(1);

        return new Promise<void>((resolve, reject) => {
            if (this.client && this.client.connected) {
                this.client.unsubscribe(topic);
                console.debug("[binding-mqtt]", `MqttClient unsubscribed from topic '${topic}'`);
            }
            resolve();
        });
    };

    start = (): boolean => {
        return true;
    };
    stop = (): boolean => {
        if (this.client) this.client.end();
        return true;
    };

    //setSecurity = (metadata: any, credentials?: any): boolean => {
    //TODO: Implement
    //  throw new Error('Method not implemented.');
    // }

    public setSecurity(metadata: Array<SecurityScheme>, credentials?: any): boolean {
        if (metadata === undefined || !Array.isArray(metadata) || metadata.length == 0) {
            console.warn("[binding-mqtt]", `MqttClient received empty security metadata`);
            return false;
        }
        let security: SecurityScheme = metadata[0];

        if (security.scheme === "basic") {
            //this.authorization = "Basic " + Buffer.from(credentials.username + ":" + credentials.password).toString('base64');
            //  this.user = mqtt.username;
        }
        return true;
    }

    private mapQoS = (qos: MqttQoS): QoS => {
        switch (qos) {
            case 2:
                return (qos = 2);
            case 1:
                return (qos = 1);
            case 0:
            default:
                return (qos = 0);
        }
    };

    private logError = (message: string): void => {
        console.error("[binding-mqtt]", `[MqttClient]${message}`);
    };
}
