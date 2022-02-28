/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
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
 * MQTT Broker Server
 */

import { IPublishPacket } from "mqtt";
import * as mqtt from "mqtt";
import * as url from "url";
import { AuthenticateError, Client, Server, Aedes } from "aedes";
import * as net from "net";
import * as tls from "tls";
import * as TD from "@node-wot/td-tools";
import { MqttBrokerServerConfig } from "./mqtt";
import { ProtocolServer, Servient, ExposedThing, ContentSerdes, ProtocolHelpers, Content } from "@node-wot/core";
import { InteractionOptions } from "wot-typescript-definitions";

export default class MqttBrokerServer implements ProtocolServer {
    readonly scheme: string = "mqtt";

    private port = -1;
    private address: string = undefined;

    private brokerURI: string = undefined;

    private readonly things: Map<string, ExposedThing> = new Map();

    private readonly config: MqttBrokerServerConfig;

    private broker: mqtt.MqttClient;

    private hostedServer: Aedes;
    private hostedBroker: net.Server;

    constructor(config: MqttBrokerServerConfig) {
        this.config = config ?? { uri: "mqtt://localhost:1883" };

        if (config.uri !== undefined) {
            // if there is a MQTT protocol indicator missing, add this
            if (config.uri.indexOf("://") === -1) {
                config.uri = this.scheme + "://" + config.uri;
            }
            this.brokerURI = config.uri;
        }
        if (config.selfHost) {
            this.hostedServer = Server({});
            let server;
            if (config.key) {
                server = tls.createServer({ key: config.key, cert: config.cert }, this.hostedServer.handle);
            } else {
                server = net.createServer(this.hostedServer.handle);
            }
            const parsed = new url.URL(this.brokerURI);
            const port = parseInt(parsed.port);
            this.port = port > 0 ? port : 1883;
            this.hostedBroker = server.listen(port);
            this.hostedServer.authenticate = this.selfHostAuthentication.bind(this);
        }
    }

    public async expose(thing: ExposedThing): Promise<void> {
        if (this.broker === undefined) {
            return;
        }

        let name = thing.title;

        if (this.things.has(name)) {
            const suffix = name.match(/.+_([0-9]+)$/);
            if (suffix !== null) {
                name = name.slice(0, -suffix[1].length) + (1 + parseInt(suffix[1]));
            } else {
                name = name + "_2";
            }
        }

        console.debug(
            "[binding-mqtt]",
            `MqttBrokerServer at ${this.brokerURI} exposes '${thing.title}' as unique '${name}/*'`
        );

        this.things.set(name, thing);

        for (const propertyName in thing.properties) {
            this.exposeProperty(name, propertyName, thing);
        }

        for (const actionName in thing.actions) {
            this.exposeAction(name, actionName, thing);
        }

        for (const eventName in thing.events) {
            this.exposeEvent(name, eventName, thing);
        }

        // connect incoming messages to Thing
        this.broker.on("message", this.handleMessage);

        this.broker.publish(name, JSON.stringify(thing.getThingDescription()), { retain: true });
    }

    private exposeProperty(name: string, propertyName: string, thing: ExposedThing) {
        const topic = encodeURIComponent(name) + "/properties/" + encodeURIComponent(propertyName);
        const property = thing.properties[propertyName];

        if (!property.writeOnly) {
            const href = this.brokerURI + "/" + topic;
            const form = new TD.Form(href, ContentSerdes.DEFAULT);
            form.op = ["readproperty", "observeproperty", "unobserveproperty"];
            property.forms.push(form);
            console.debug(
                "[binding-mqtt]",
                `MqttBrokerServer at ${this.brokerURI} assigns '${href}' to property '${propertyName}'`
            );

            const observeListener = async (data: Content) => {
                let content;
                try {
                    content = ContentSerdes.get().valueToContent(data, property.data);
                } catch (err) {
                    console.warn(
                        "[binding-mqtt]",
                        `MqttServer cannot process data for Property '${propertyName}': ${err.message}`
                    );
                    thing.handleUnobserveProperty(propertyName, observeListener, {
                        formIndex: property.forms.length - 1,
                    });
                    return;
                }
                console.debug(
                    "[binding-mqtt]",
                    `MqttBrokerServer at ${this.brokerURI} publishing to Property topic '${propertyName}' `
                );
                const buffer = await ProtocolHelpers.readStreamFully(content.body);
                this.broker.publish(topic, buffer);
            };
            thing.handleObserveProperty(propertyName, observeListener, { formIndex: property.forms.length - 1 });
        }
        if (!property.readOnly) {
            const href = this.brokerURI + "/" + topic + "/writeproperty";
            this.broker.subscribe(topic + "/writeproperty");
            const form = new TD.Form(href, ContentSerdes.DEFAULT);
            form.op = ["writeproperty"];
            thing.properties[propertyName].forms.push(form);
            console.debug(
                "[binding-mqtt]",
                `MqttBrokerServer at ${this.brokerURI} assigns '${href}' to property '${propertyName}'`
            );
        }
    }

    private exposeAction(name: string, actionName: string, thing: ExposedThing) {
        const topic = encodeURIComponent(name) + "/actions/" + encodeURIComponent(actionName);
        this.broker.subscribe(topic);

        const href = this.brokerURI + "/" + topic;
        const form = new TD.Form(href, ContentSerdes.DEFAULT);
        form.op = ["invokeaction"];
        thing.actions[actionName].forms.push(form);
        console.debug(
            "[binding-mqtt]",
            `MqttBrokerServer at ${this.brokerURI} assigns '${href}' to Action '${actionName}'`
        );
    }

    private exposeEvent(name: string, eventName: string, thing: ExposedThing) {
        const topic = encodeURIComponent(name) + "/events/" + encodeURIComponent(eventName);
        const event = thing.events[eventName];

        const href = this.brokerURI + "/" + topic;
        const form = new TD.Form(href, ContentSerdes.DEFAULT);
        form.op = ["subscribeevent", "unsubscribeevent"];
        event.forms.push(form);
        console.debug(
            "[binding-mqtt]",
            `MqttBrokerServer at ${this.brokerURI} assigns '${href}' to Event '${eventName}'`
        );

        const eventListener = async (content: Content) => {
            if (!content) {
                console.warn(
                    "[binding-mqtt]",
                    `MqttBrokerServer on port ${this.getPort()} cannot process data for Event ${eventName}`
                );
                thing.handleUnsubscribeEvent(eventName, eventListener, { formIndex: event.forms.length - 1 });
                return;
            }
            console.debug(
                "[binding-mqtt]",
                `MqttBrokerServer at ${this.brokerURI} publishing to Event topic '${eventName}' `
            );
            const buffer = await ProtocolHelpers.readStreamFully(content.body);
            this.broker.publish(topic, buffer);
        };
        thing.handleSubscribeEvent(eventName, eventListener, { formIndex: event.forms.length - 1 });
    }

    private handleMessage(receivedTopic: string, rawPayload: Buffer | string, packet: IPublishPacket): void {
        // route request
        const segments = receivedTopic.split("/");
        let payload: Buffer;
        if (rawPayload instanceof Buffer) {
            payload = rawPayload;
        } else if (typeof rawPayload === "string") {
            payload = Buffer.from(rawPayload);
        }

        if (segments.length === 4) {
            // connecting to the actions
            console.debug(
                "[binding-mqtt]",
                `MqttBrokerServer at ${this.brokerURI} received message for '${receivedTopic}'`
            );
            const thing = this.things.get(segments[1]);
            if (thing) {
                if (segments[2] === "actions") {
                    const action = thing.actions[segments[3]];
                    if (action) {
                        this.handleAction(action, packet, payload, segments, thing);
                        return;
                    }
                } // Action exists?
            } // Thing exists?
        } else if (segments.length === 5 && segments[4] === "writeproperty") {
            // connecting to the writeable properties
            const thing = this.things.get(segments[1]);
            if (thing) {
                if (segments[2] === "properties") {
                    const property = thing.properties[segments[3]];
                    if (property) {
                        this.handlePropertyWrite(property, packet, payload, segments, thing);
                    } // Property exists?
                }
            }
            return;
        }
        // topic not found
        console.warn(
            "[binding-mqtt]",
            `MqttBrokerServer at ${this.brokerURI} received message for invalid topic '${receivedTopic}'`
        );
    }

    private handleAction(
        action: TD.ThingAction,
        packet: IPublishPacket,
        payload: Buffer,
        segments: string[],
        thing: ExposedThing
    ) {
        /*
         * Currently, this branch will never be taken. The main reason for that is in the mqtt library we use:
         * https://github.com/mqttjs/MQTT.js/pull/1103
         * For further discussion see https://github.com/eclipse/thingweb.node-wot/pull/253
         */
        let value;
        if ("properties" in packet && "contentType" in packet.properties) {
            try {
                value = ContentSerdes.get().contentToValue(
                    { type: packet.properties.contentType, body: payload },
                    action.input
                );
            } catch (err) {
                console.warn(
                    `MqttBrokerServer at ${this.brokerURI} cannot process received message for '${segments[3]}': ${err.message}`
                );
            }
        } else {
            try {
                value = JSON.parse(payload.toString());
            } catch (err) {
                console.warn(
                    `MqttBrokerServer at ${this.brokerURI}, packet has no Content Type and does not parse as JSON, relaying raw (string) payload.`
                );
                value = payload.toString();
            }
        }
        const options: InteractionOptions & { formIndex: number } = {
            formIndex: ProtocolHelpers.findRequestMatchingFormIndex(
                action.forms,
                this.scheme,
                this.brokerURI,
                ContentSerdes.DEFAULT
            ),
        };

        thing
            .handleInvokeAction(segments[3], value, options)
            .then((output) => {
                if (output) {
                    console.warn(`MqttBrokerServer at ${this.brokerURI} cannot return output '${segments[3]}'`);
                }
            })
            .catch((err) => {
                console.error(
                    `MqttBrokerServer at ${this.brokerURI} got error on invoking '${segments[3]}': ${err.message}`
                );
            });
    }

    private handlePropertyWrite(
        property: TD.ThingProperty,
        packet: IPublishPacket,
        payload: Buffer,
        segments: string[],
        thing: ExposedThing
    ) {
        if (!property.readOnly) {
            let contentType = ContentSerdes.DEFAULT;
            if ("contentType" in packet.properties) {
                contentType = packet.properties.contentType;
            }

            const options: InteractionOptions & { formIndex: number } = {
                formIndex: ProtocolHelpers.findRequestMatchingFormIndex(
                    property.forms,
                    this.scheme,
                    this.brokerURI,
                    contentType
                ),
            };

            try {
                thing.handleWriteProperty(segments[3], JSON.parse(payload.toString()), options);
            } catch (err) {
                console.error(
                    "[binding-mqtt]",
                    `MqttBrokerServer at ${this.brokerURI} got error on writing to property '${segments[3]}': ${err.message}`
                );
            }
        } else {
            console.warn(
                "[binding-mqtt]",
                `MqttBrokerServer at ${this.brokerURI} received message for readOnly property at '${segments.join(
                    "/"
                )}'`
            );
        } // property is writeable? Not necessary since it didn't actually subscribe to this topic
    }

    public async destroy(thingId: string): Promise<boolean> {
        console.debug("[binding-mqtt]", `MqttBrokerServer on port ${this.getPort()} destroying thingId '${thingId}'`);
        let removedThing: ExposedThing;
        for (const name of Array.from(this.things.keys())) {
            const expThing = this.things.get(name);
            if (expThing != null && expThing.id != null && expThing.id === thingId) {
                this.things.delete(name);
                removedThing = expThing;
            }
        }
        if (removedThing) {
            console.info("[binding-mqtt]", `MqttBrokerServer succesfully destroyed '${removedThing.title}'`);
        } else {
            console.info("[binding-mqtt]", `MqttBrokerServer failed to destroy thing with thingId '${thingId}'`);
        }
        return removedThing !== undefined;
    }

    public start(servient: Servient): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.brokerURI === undefined) {
                console.warn("[binding-mqtt]", `No broker defined for MQTT server binding - skipping`);
                resolve();
            } else {
                // try to connect to the broker without or with credentials
                if (this.config.psw === undefined) {
                    console.debug(
                        "[binding-mqtt]",
                        `MqttBrokerServer trying to connect to broker at ${this.brokerURI}`
                    );
                } else if (this.config.clientId === undefined) {
                    console.debug(
                        "[binding-mqtt]",
                        `MqttBrokerServer trying to connect to secured broker at ${this.brokerURI}`
                    );
                } else if (this.config.protocolVersion === undefined) {
                    console.debug(
                        "[binding-mqtt]",
                        `MqttBrokerServer trying to connect to secured broker at ${this.brokerURI} with client ID ${this.config.clientId}`
                    );
                } else {
                    console.debug(
                        "[binding-mqtt]",
                        `MqttBrokerServer trying to connect to secured broker at ${this.brokerURI} with client ID ${this.config.clientId}`
                    );
                }

                this.broker = mqtt.connect(this.brokerURI, this.config);

                this.broker.on("connect", () => {
                    console.info("[binding-mqtt]", `MqttBrokerServer connected to broker at ${this.brokerURI}`);

                    const parsed = new url.URL(this.brokerURI);
                    this.address = parsed.hostname;
                    const port = parseInt(parsed.port);
                    this.port = port > 0 ? port : 1883;
                    resolve();
                });
                this.broker.on("error", (error: Error) => {
                    console.error(
                        "[binding-mqtt]",
                        `MqttBrokerServer could not connect to broker at ${this.brokerURI}`
                    );
                    reject(error);
                });
            }
        });
    }

    public async stop(): Promise<void> {
        if (this.broker !== undefined) {
            this.broker.unsubscribe("*");
            this.broker.end(true);
        }

        if (this.hostedBroker !== undefined) {
            await new Promise<void>((resolve) => this.hostedServer.close(() => resolve()));
            await new Promise<void>((resolve) => this.hostedBroker.close(() => resolve()));
        }
    }

    public getPort(): number {
        return this.port;
    }

    public getAddress(): string {
        return this.address;
    }

    private selfHostAuthentication(
        _client: Client,
        username: Readonly<string>,
        password: Readonly<Buffer>,
        done: (error: AuthenticateError | null, success: boolean | null) => void
    ) {
        if (this.config.selfHostAuthentication && username !== undefined) {
            for (let i = 0; i < this.config.selfHostAuthentication.length; i++) {
                if (
                    username === this.config.selfHostAuthentication[i].username &&
                    password.equals(Buffer.from(this.config.selfHostAuthentication[i].password))
                ) {
                    done(undefined, true);
                    return;
                }
            }
            done(undefined, false);
            return;
        }
        done(undefined, true);
    }
}
