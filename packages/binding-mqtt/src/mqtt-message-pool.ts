/********************************************************************************
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
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
import { createLoggers } from "@node-wot/core";
import { MqttClientConfig } from "./mqtt";
import * as mqtt from "mqtt";

const { debug, warn } = createLoggers("binding-mqtt", "mqtt-message-pool");

export default class MQTTMessagePool {
    client?: mqtt.MqttClient;
    subscribers: Map<string, (topic: string, message: Buffer) => void> = new Map();
    errors: Map<string, (error: Error) => void> = new Map();

    public async connect(brokerURI: string, config: MqttClientConfig): Promise<void> {
        if (this.client === undefined) {
            this.client = await mqtt.connectAsync(brokerURI, config);
            this.client.on("message", (receivedTopic: string, payload: Buffer) => {
                debug(
                    `Received MQTT message from ${brokerURI} (topic: ${receivedTopic}, data length: ${payload.length})`
                );
                this.subscribers.get(receivedTopic)?.(receivedTopic, payload);
            });
            // Connection errors should be deal by the connectAsync
            // here we handle "runtime" parsing errors, but we can't do much
            // therefore we broadcast the error to all subscribers
            this.client.on("error", (error: Error) => {
                warn(`MQTT client error: ${error.message}`);
                this.errors.forEach((errorCallback) => {
                    errorCallback(error);
                });
            });
        }
    }

    public async subscribe(
        filter: string | string[],
        callback: (topic: string, message: Buffer) => void,
        error: (error: Error) => void
    ): Promise<void> {
        if (this.client == null) {
            throw new Error("MQTT client is not connected");
        }

        const filters = Array.isArray(filter) ? filter : [filter];
        filters.forEach((f) => {
            if (this.subscribers.has(f)) {
                warn(`Already subscribed to ${f}; we are not supporting multiple subscribers to the same topic`);
                warn(`The subscription will be ignored`);
                return;
            }

            this.subscribers.set(f, callback);
            this.errors.set(f, error);
        });

        await this.client.subscribeAsync(filters);
    }

    public async unsubscribe(filter: string | string[]): Promise<void> {
        if (this.client == null) {
            throw new Error("MQTT client is not connected");
        }

        const filters = Array.isArray(filter) ? filter : [filter];
        filters.forEach((f) => {
            this.subscribers.delete(f);
            this.errors.delete(f);
        });

        await this.client.unsubscribeAsync(filters);
    }

    public async publish(topic: string, message: Buffer, options?: mqtt.IClientPublishOptions): Promise<void> {
        if (this.client == null) {
            throw new Error("MQTT client is not connected");
        }

        debug(`Publishing MQTT message to ${topic} (data length: ${message.length})`);
        await this.client.publishAsync(topic, message, options);
    }

    public async end(): Promise<void> {
        for (const filter of this.subscribers.keys()) {
            this.unsubscribe(filter);
        }
        return this.client?.endAsync();
    }
}
