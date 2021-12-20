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

import { ProtocolClient, Content, ContentSerdes, ProtocolHelpers } from "@node-wot/core";
import * as TD from "@node-wot/td-tools";
import * as mqtt from "mqtt";
import { MqttClientConfig, MqttForm, MqttQoS } from "./mqtt";
import { IPublishPacket, QoS } from "mqtt";
import * as url from "url";
import { Subscription } from "rxjs/Subscription";
import { Readable } from "stream";

declare interface MqttClientSecurityParameters {
    username: string;
    password: string
}

export default class MqttClient implements ProtocolClient {
    private scheme: string;

    constructor(private config: MqttClientConfig = {}, secure = false) {
        this.scheme = "mqtt" + (secure ? "s" : "");
    }

    private client: mqtt.MqttClient = undefined;

    public subscribeResource(
        form: MqttForm,
        next: (value: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ): Promise<Subscription> {
        return new Promise<Subscription>((resolve, reject) => {
            // get MQTT-based metadata
            const contentType = form.contentType;
            const requestUri = new url.URL(form.href);
            const topic = requestUri.pathname.slice(1);
            const brokerUri: string = `${this.scheme}://` + requestUri.host;

            if (this.client === undefined) {
                this.client = mqtt.connect(brokerUri, this.config);
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
            this.client.on("error", (err: Error) => {
                if (this.client) {
                    this.client.end();
                }
                this.client = undefined;
                // TODO: error handling
                if (error) error(err);

                reject(err);
            });
        });
    }

    public async readResource(form: MqttForm): Promise<Content> {
        throw new Error("Method not implemented.");
    }

    public async writeResource(form: MqttForm, content: Content): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public async invokeResource(form: MqttForm, content: Content): Promise<Content> {
        const requestUri = new url.URL(form.href);
        const topic = requestUri.pathname.slice(1);
        const brokerUri = `${this.scheme}://${requestUri.host}`;

        if (this.client === undefined) {
            this.client = mqtt.connect(brokerUri, this.config);
        }

        // if not input was provided, set up an own body otherwise take input as body
        if (content === undefined) {
            this.client.publish(topic, JSON.stringify(Buffer.from("")));
        } else {
            const buffer = await ProtocolHelpers.readStreamFully(content.body);
            this.client.publish(topic, buffer);
        }
        // there will bo no response
        return { type: ContentSerdes.DEFAULT, body: Readable.from([]) };
    }

    public async unlinkResource(form: TD.Form): Promise<void> {
        const requestUri = new url.URL(form.href);
        const topic = requestUri.pathname.slice(1);

        return new Promise<void>((resolve, reject) => {
            if (this.client && this.client.connected) {
                this.client.unsubscribe(topic);
                console.debug("[binding-mqtt]", `MqttClient unsubscribed from topic '${topic}'`);
            }
            resolve();
        });
    }

    public async start(): Promise<void> {
        // do nothing
    }

    public async stop(): Promise<void> {
        if (this.client) this.client.end();
    }

    public setSecurity(metadata: Array<TD.SecurityScheme>, credentials?: MqttClientSecurityParameters): boolean {
        if (metadata === undefined || !Array.isArray(metadata) || metadata.length === 0) {
            console.warn("[binding-mqtt]", `MqttClient received empty security metadata`);
            return false;
        }
        const security: TD.SecurityScheme = metadata[0];

        if (security.scheme === "basic") {
            this.config.username = credentials.username;
            this.config.password = credentials.password;
        }
        return true;
    }

    private mapQoS(qos: MqttQoS): QoS {
        switch (qos) {
            case 2:
                return (qos = 2);
            case 1:
                return (qos = 1);
            case 0:
            default:
                return (qos = 0);
        }
    }

    private logError(message: string): void {
        console.error("[binding-mqtt]", `[MqttClient]${message}`);
    }
}
