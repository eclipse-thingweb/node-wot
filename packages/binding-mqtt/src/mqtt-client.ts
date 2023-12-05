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

import { ProtocolClient, Content, DefaultContent, createLoggers, ContentSerdes } from "@node-wot/core";
import * as TD from "@node-wot/td-tools";
import * as mqtt from "mqtt";
import { MqttClientConfig, MqttForm, MqttQoS } from "./mqtt";
import * as url from "url";
import { Subscription } from "rxjs/Subscription";
import { Readable } from "stream";
import { IClientPublishOptions } from "mqtt";

const { debug, warn } = createLoggers("binding-mqtt", "mqtt-client");

declare interface MqttClientSecurityParameters {
    username: string;
    password: string;
}

export default class MqttClient implements ProtocolClient {
    private scheme: string;

    constructor(private config: MqttClientConfig = {}, secure = false) {
        this.scheme = "mqtt" + (secure ? "s" : "");
    }

    private client?: mqtt.MqttClient;

    public async subscribeResource(
        form: MqttForm,
        next: (value: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ): Promise<Subscription> {
        const contentType = form.contentType ?? ContentSerdes.DEFAULT;
        const requestUri = new url.URL(form.href);
        const brokerUri: string = `${this.scheme}://` + requestUri.host;
        // Keeping the path as the topic for compatibility reasons.
        // Current specification allows only form["mqv:filter"]
        const filter = requestUri.pathname.slice(1) ?? form["mqv:filter"];

        if (this.client === undefined) {
            this.client = await mqtt.connectAsync(brokerUri, this.config);
        }

        this.client.on("message", (receivedTopic: string, payload: Buffer) => {
            debug(`Received MQTT message (topic: ${receivedTopic}, data length: ${payload.length})`);
            if (filter.includes(receivedTopic)) {
                next(new Content(contentType, Readable.from(payload)));
            }
        });

        this.client.on("error", (err: Error) => {
            // Connection errors are fired as a result of mqtt.connectAsync
            // here we have to handle only parsing errors.
            if (error) error(err);
        });

        await this.client.subscribeAsync(filter);

        return new Subscription(() => {
            if (!this.client) {
                warn(
                    `MQTT Client is undefined. This means that the client either failed to connect or was never initialized.`
                );
                return;
            }
            this.client.unsubscribe(filter);
        });
    }

    public async readResource(form: MqttForm): Promise<Content> {
        throw new Error("Method not implemented.");
    }

    public async writeResource(form: MqttForm, content: Content): Promise<void> {
        const requestUri = new url.URL(form.href);
        const brokerUri = `${this.scheme}://${requestUri.host}`;
        const topic = requestUri.pathname.slice(1) ?? form["mqv:topic"];

        if (this.client === undefined) {
            this.client = await mqtt.connectAsync(brokerUri, this.config);
        }

        // if not input was provided, set up an own body otherwise take input as body
        const buffer = content === undefined ? Buffer.from("") : await content.toBuffer();
        await this.client.publishAsync(topic, buffer, {
            retain: form["mqv:retain"],
            qos: this.mapQoS(form["mqv:qos"]),
        });
    }

    public async invokeResource(form: MqttForm, content: Content): Promise<Content> {
        const requestUri = new url.URL(form.href);
        const topic = requestUri.pathname.slice(1);
        const brokerUri = `${this.scheme}://${requestUri.host}`;

        if (this.client === undefined) {
            this.client = await mqtt.connectAsync(brokerUri, this.config);
        }

        // if not input was provided, set up an own body otherwise take input as body
        const buffer = content === undefined ? Buffer.from("") : await content.toBuffer();
        await this.client.publishAsync(topic, buffer, {
            retain: form["mqv:retain"],
            qos: this.mapQoS(form["mqv:qos"]),
        });
        // there will be no response
        return new DefaultContent(Readable.from([]));
    }

    public async unlinkResource(form: TD.Form): Promise<void> {
        const requestUri = new url.URL(form.href);
        const topic = requestUri.pathname.slice(1);

        if (this.client != null && this.client.connected) {
            await this.client.unsubscribeAsync(topic);
            debug(`MqttClient unsubscribed from topic '${topic}'`);
        }
    }

    /**
     * @inheritdoc
     */
    public async requestThingDescription(uri: string): Promise<Content> {
        throw new Error("Method not implemented");
    }

    public async start(): Promise<void> {
        // do nothing
    }

    public async stop(): Promise<void> {
        if (this.client) return this.client.endAsync();
    }

    public setSecurity(metadata: Array<TD.SecurityScheme>, credentials?: MqttClientSecurityParameters): boolean {
        if (metadata === undefined || !Array.isArray(metadata) || metadata.length === 0) {
            warn(`MqttClient received empty security metadata`);
            return false;
        }
        const security: TD.SecurityScheme = metadata[0];

        if (security.scheme === "basic") {
            if (credentials === undefined) {
                // FIXME: This error message should be reworded and adapt to logging convention
                throw new Error("binding-mqtt: security wants to be basic but you have provided no credentials");
            } else {
                this.config.username = credentials.username;
                this.config.password = credentials.password;
            }
        }
        return true;
    }

    private mapQoS(qos: MqttQoS | undefined): Required<IClientPublishOptions>["qos"] {
        switch (qos) {
            case "0":
                return 0;
            case "1":
                return 1;
            case "2":
                return 2;
            case undefined:
                return 0;
            default:
                warn(`MqttClient received unsupported QoS level '${qos}'`);
                warn(`MqttClient falling back to QoS level '0'`);
                return 0;
        }
    }
}
