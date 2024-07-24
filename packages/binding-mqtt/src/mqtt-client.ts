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

import {
    ProtocolClient,
    Content,
    DefaultContent,
    createLoggers,
    ContentSerdes,
    Form,
    SecurityScheme,
} from "@node-wot/core";
import * as mqtt from "mqtt";
import { MqttClientConfig, MqttForm } from "./mqtt";
import * as url from "url";
import { Subscription } from "rxjs/Subscription";
import { Readable } from "stream";
import MQTTMessagePool from "./mqtt-message-pool";
import { mapQoS } from "./util";

const { debug, warn } = createLoggers("binding-mqtt", "mqtt-client");

declare interface MqttClientSecurityParameters {
    username: string;
    password: string;
}

export default class MqttClient implements ProtocolClient {
    private scheme: string;
    private pools: Map<string, MQTTMessagePool> = new Map();

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

        let pool = this.pools.get(brokerUri);

        if (pool == null) {
            pool = new MQTTMessagePool();
            this.pools.set(brokerUri, pool);
        }

        await pool.connect(brokerUri, this.config);

        await pool.subscribe(
            filter,
            (topic: string, message: Buffer) => {
                next(new Content(contentType, Readable.from(message)));
            },
            (e: Error) => {
                if (error) error(e);
            }
        );

        return new Subscription(() => {});
    }

    public async readResource(form: MqttForm): Promise<Content> {
        const contentType = form.contentType ?? ContentSerdes.DEFAULT;
        const requestUri = new url.URL(form.href);
        const brokerUri: string = `${this.scheme}://` + requestUri.host;
        // Keeping the path as the topic for compatibility reasons.
        // Current specification allows only form["mqv:filter"]
        const filter = requestUri.pathname.slice(1) ?? form["mqv:filter"];

        let pool = this.pools.get(brokerUri);

        if (pool == null) {
            pool = new MQTTMessagePool();
            this.pools.set(brokerUri, pool);
        }

        await pool.connect(brokerUri, this.config);

        const result = await new Promise<Content>((resolve, reject) => {
            pool!.subscribe(
                filter,
                (topic: string, message: Buffer) => {
                    resolve(new Content(contentType, Readable.from(message)));
                },
                (e: Error) => {
                    reject(e);
                }
            );
        });

        await pool.unsubscribe(filter);
        return result;
    }

    public async writeResource(form: MqttForm, content: Content): Promise<void> {
        const requestUri = new url.URL(form.href);
        const brokerUri = `${this.scheme}://${requestUri.host}`;
        const topic = requestUri.pathname.slice(1) ?? form["mqv:topic"];

        let pool = this.pools.get(brokerUri);

        if (pool == null) {
            pool = new MQTTMessagePool();
            this.pools.set(brokerUri, pool);
        }

        await pool.connect(brokerUri, this.config);

        // if not input was provided, set up an own body otherwise take input as body
        const buffer = content === undefined ? Buffer.from("") : await content.toBuffer();
        await pool.publish(topic, buffer, {
            retain: form["mqv:retain"],
            qos: mapQoS(form["mqv:qos"]),
        });
    }

    public async invokeResource(form: MqttForm, content: Content): Promise<Content> {
        const requestUri = new url.URL(form.href);
        const topic = requestUri.pathname.slice(1);
        const brokerUri = `${this.scheme}://${requestUri.host}`;

        let pool = this.pools.get(brokerUri);

        if (pool == null) {
            pool = new MQTTMessagePool();
            this.pools.set(brokerUri, pool);
        }

        await pool.connect(brokerUri, this.config);

        // if not input was provided, set up an own body otherwise take input as body
        const buffer = content === undefined ? Buffer.from("") : await content.toBuffer();
        await pool.publish(topic, buffer, {
            retain: form["mqv:retain"],
            qos: mapQoS(form["mqv:qos"]),
        });
        // there will be no response
        return new DefaultContent(Readable.from([]));
    }

    public async unlinkResource(form: Form): Promise<void> {
        const requestUri = new url.URL(form.href);
        const brokerUri: string = `${this.scheme}://` + requestUri.host;
        const topic = requestUri.pathname.slice(1);

        const pool = this.pools.get(brokerUri);
        if (pool != null) {
            await pool.unsubscribe(topic);
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
        for (const pool of this.pools.values()) {
            await pool.end();
        }
        if (this.client) return this.client.endAsync();
    }

    public setSecurity(metadata: Array<SecurityScheme>, credentials?: MqttClientSecurityParameters): boolean {
        if (metadata === undefined || !Array.isArray(metadata) || metadata.length === 0) {
            warn(`MqttClient received empty security metadata`);
            return false;
        }
        const security: SecurityScheme = metadata[0];

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
}
