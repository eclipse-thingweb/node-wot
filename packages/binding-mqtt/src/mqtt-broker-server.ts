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
 * MQTT Broker Server
 */

import { IPublishPacket } from "mqtt";
import * as mqtt from "mqtt";
import * as url from "url";
import { AuthenticateError, Client, Server, Aedes } from "aedes";
import * as net from "net";
import * as tls from "tls";
import * as TD from "@node-wot/td-tools";
import { MqttBrokerServerConfig, MqttForm } from "./mqtt";
import {
    ProtocolServer,
    Servient,
    ExposedThing,
    ContentSerdes,
    ProtocolHelpers,
    Content,
    createLoggers,
} from "@node-wot/core";
import { InteractionOptions } from "wot-typescript-definitions";
import { ActionElement, PropertyElement } from "wot-thing-description-types";
import { Readable } from "stream";
import { mapQoS } from "./util";

const { info, debug, error, warn } = createLoggers("binding-mqtt", "mqtt-broker-server");

export default class MqttBrokerServer implements ProtocolServer {
    private static brokerIsInitialized(broker?: mqtt.MqttClient): asserts broker is mqtt.MqttClient {
        if (broker === undefined) {
            throw new Error(
                `Broker not initialized. You need to start the ${MqttBrokerServer.name} before you can expose things.`
            );
        }
    }

    readonly scheme: string = "mqtt";

    private readonly ACTION_SEGMENT_LENGTH = 3;
    private readonly PROPERTY_SEGMENT_LENGTH = 4;

    private readonly THING_NAME_SEGMENT_INDEX = 0;
    private readonly INTERACTION_TYPE_SEGMENT_INDEX = 1;
    private readonly INTERACTION_NAME_SEGMENT_INDEX = 2;
    private readonly INTERACTION_EXT_SEGMENT_INDEX = 3;

    private readonly defaults: MqttBrokerServerConfig = { uri: "mqtt://localhost:1883" };

    private port = -1;
    private address?: string = undefined;

    private brokerURI: string;

    private readonly things: Map<string, ExposedThing> = new Map();

    private readonly config: MqttBrokerServerConfig;

    private broker?: mqtt.MqttClient;

    private hostedServer?: Aedes;
    private hostedBroker?: net.Server;

    constructor(config: MqttBrokerServerConfig) {
        this.config = config ?? this.defaults;
        this.config.uri = this.config.uri ?? this.defaults.uri;

        // if there is a MQTT protocol indicator missing, add this
        if (config.uri.indexOf("://") === -1) {
            config.uri = this.scheme + "://" + config.uri;
        }

        this.brokerURI = config.uri;
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

        debug(`MqttBrokerServer at ${this.brokerURI} exposes '${thing.title}' as unique '${name}/*'`);

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
        this.broker.on("message", this.handleMessage.bind(this));

        this.broker.publish(name, JSON.stringify(thing.getThingDescription()), { retain: true });
    }

    private exposeProperty(name: string, propertyName: string, thing: ExposedThing) {
        MqttBrokerServer.brokerIsInitialized(this.broker);
        const topic = encodeURIComponent(name) + "/properties/" + encodeURIComponent(propertyName);
        const property = thing.properties[propertyName];

        const writeOnly: boolean = property.writeOnly ?? false;
        if (!writeOnly) {
            const href = this.brokerURI + "/" + topic;
            const form = new TD.Form(href, ContentSerdes.DEFAULT);
            form.op = ["readproperty", "observeproperty", "unobserveproperty"];
            property.forms.push(form);
            debug(`MqttBrokerServer at ${this.brokerURI} assigns '${href}' to property '${propertyName}'`);

            const observeListener = async (content: Content) => {
                debug(`MqttBrokerServer at ${this.brokerURI} publishing to Property topic '${propertyName}' `);
                const buffer = await content.toBuffer();

                if (this.broker === undefined) {
                    warn(`MqttBrokerServer at ${this.brokerURI} has no client to publish to. Probably it was closed.`);
                    return;
                }

                this.broker.publish(topic, buffer);
            };
            thing.handleObserveProperty(propertyName, observeListener, { formIndex: property.forms.length - 1 });
        }
        const readOnly: boolean = property.readOnly ?? false;
        if (!readOnly) {
            const href = this.brokerURI + "/" + topic + "/writeproperty";
            this.broker.subscribe(topic + "/writeproperty");
            const form = new TD.Form(href, ContentSerdes.DEFAULT);
            form.op = ["writeproperty"];
            thing.properties[propertyName].forms.push(form);
            debug(`MqttBrokerServer at ${this.brokerURI} assigns '${href}' to property '${propertyName}'`);
        }
    }

    private exposeAction(name: string, actionName: string, thing: ExposedThing) {
        MqttBrokerServer.brokerIsInitialized(this.broker);

        const topic = encodeURIComponent(name) + "/actions/" + encodeURIComponent(actionName);
        this.broker.subscribe(topic);

        const href = this.brokerURI + "/" + topic;
        const form = new TD.Form(href, ContentSerdes.DEFAULT);
        form.op = ["invokeaction"];
        thing.actions[actionName].forms.push(form);
        debug(`MqttBrokerServer at ${this.brokerURI} assigns '${href}' to Action '${actionName}'`);
    }

    private exposeEvent(name: string, eventName: string, thing: ExposedThing) {
        const topic = encodeURIComponent(name) + "/events/" + encodeURIComponent(eventName);
        const event = thing.events[eventName];

        const href = this.brokerURI + "/" + topic;
        const form = new MqttForm(href, ContentSerdes.DEFAULT);
        form["mqv:qos"] = "2";
        form.op = ["subscribeevent", "unsubscribeevent"];
        event.forms.push(form);
        debug(`MqttBrokerServer at ${this.brokerURI} assigns '${href}' to Event '${eventName}'`);

        const eventListener = async (content: Content) => {
            if (this.broker === undefined) {
                warn(`MqttBrokerServer at ${this.brokerURI} has no client to publish to. Probably it was closed.`);
                return;
            }

            if (content == null) {
                warn(`MqttBrokerServer on port ${this.getPort()} cannot process data for Event ${eventName}`);
                thing.handleUnsubscribeEvent(eventName, eventListener, { formIndex: event.forms.length - 1 });
                return;
            }
            debug(`MqttBrokerServer at ${this.brokerURI} publishing to Event topic '${eventName}' `);
            const buffer = await content.toBuffer();
            this.broker.publish(topic, buffer, { retain: form["mqv:retain"], qos: mapQoS(form["mqv:qos"]) });
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
        } else {
            warn(`MqttBrokerServer on port ${this.getPort()} received unexpected payload type`);
            return;
        }

        if (segments.length === this.ACTION_SEGMENT_LENGTH) {
            // connecting to the actions
            debug(`MqttBrokerServer at ${this.brokerURI} received message for '${receivedTopic}'`);
            const thing = this.things.get(segments[this.THING_NAME_SEGMENT_INDEX]);
            if (thing != null) {
                if (segments[this.INTERACTION_TYPE_SEGMENT_INDEX] === "actions") {
                    const action = thing.actions[segments[this.INTERACTION_NAME_SEGMENT_INDEX]];
                    if (action != null) {
                        this.handleAction(action, packet, payload, segments, thing);
                        return;
                    }
                } // Action exists?
            } // Thing exists?
        } else if (
            segments.length === this.PROPERTY_SEGMENT_LENGTH &&
            segments[this.INTERACTION_EXT_SEGMENT_INDEX] === "writeproperty"
        ) {
            // connecting to the writeable properties
            const thing = this.things.get(segments[this.THING_NAME_SEGMENT_INDEX]);
            if (thing != null) {
                if (segments[this.INTERACTION_TYPE_SEGMENT_INDEX] === "properties") {
                    const property = thing.properties[segments[this.INTERACTION_NAME_SEGMENT_INDEX]];
                    if (property != null) {
                        this.handlePropertyWrite(property, packet, payload, segments, thing);
                    } // Property exists?
                }
            }
            return;
        }
        // topic not found
        warn(`MqttBrokerServer at ${this.brokerURI} received message for invalid topic '${receivedTopic}'`);
    }

    private handleAction(
        action: ActionElement,
        packet: IPublishPacket,
        payload: Buffer,
        segments: string[],
        thing: ExposedThing
    ) {
        /*
         * Currently, this branch will never be taken. The main reason for that is in the mqtt library we use:
         * https://github.com/mqttjs/MQTT.js/pull/1103
         * For further discussion see https://github.com/eclipse-thingweb/node-wot/pull/253
         */
        const contentType = packet?.properties?.contentType ?? ContentSerdes.DEFAULT;

        const options: InteractionOptions & { formIndex: number } = {
            formIndex: ProtocolHelpers.findRequestMatchingFormIndex(
                action.forms,
                this.scheme,
                this.brokerURI,
                contentType
            ),
        };

        const formContentType = action.forms[options.formIndex].contentType ?? ContentSerdes.DEFAULT;
        const inputContent = new Content(formContentType, Readable.from(payload));

        thing
            .handleInvokeAction(segments[this.INTERACTION_NAME_SEGMENT_INDEX], inputContent, options)
            .then((output: unknown) => {
                if (output != null) {
                    warn(
                        `MqttBrokerServer at ${this.brokerURI} cannot return output '${
                            segments[this.INTERACTION_NAME_SEGMENT_INDEX]
                        }'`
                    );
                }
            })
            .catch((err: Error) => {
                error(
                    `MqttBrokerServer at ${this.brokerURI} got error on invoking '${
                        segments[this.INTERACTION_NAME_SEGMENT_INDEX]
                    }': ${err.message}`
                );
            });
    }

    private handlePropertyWrite(
        property: PropertyElement,
        packet: IPublishPacket,
        payload: Buffer,
        segments: string[],
        thing: ExposedThing
    ) {
        const readOnly = property.readOnly ?? false;
        if (!readOnly) {
            const contentType = packet?.properties?.contentType ?? ContentSerdes.DEFAULT;

            const options: InteractionOptions & { formIndex: number } = {
                formIndex: ProtocolHelpers.findRequestMatchingFormIndex(
                    property.forms,
                    this.scheme,
                    this.brokerURI,
                    contentType
                ),
            };

            const formContentType = property.forms[options.formIndex].contentType ?? ContentSerdes.DEFAULT;
            const inputContent = new Content(formContentType, Readable.from(payload));

            try {
                thing.handleWriteProperty(segments[this.INTERACTION_NAME_SEGMENT_INDEX], inputContent, options);
            } catch (err) {
                error(
                    `MqttBrokerServer at ${this.brokerURI} got error on writing to property '${
                        segments[this.INTERACTION_NAME_SEGMENT_INDEX]
                    }': ${err}`
                );
            }
        } else {
            warn(
                `MqttBrokerServer at ${this.brokerURI} received message for readOnly property at '${segments.join(
                    "/"
                )}'`
            );
        } // property is writeable? Not necessary since it didn't actually subscribe to this topic
    }

    public async destroy(thingId: string): Promise<boolean> {
        debug(`MqttBrokerServer on port ${this.getPort()} destroying thingId '${thingId}'`);
        let removedThing: ExposedThing | undefined;

        for (const name of Array.from(this.things.keys())) {
            const expThing = this.things.get(name);
            if (expThing != null && expThing.id != null && expThing.id === thingId) {
                this.things.delete(name);
                removedThing = expThing;
            }
        }

        if (removedThing != null) {
            info(`MqttBrokerServer succesfully destroyed '${removedThing.title}'`);
        } else {
            info(`MqttBrokerServer failed to destroy thing with thingId '${thingId}'`);
        }
        return removedThing !== undefined;
    }

    public async start(servient: Servient): Promise<void> {
        if (this.brokerURI === undefined) {
            warn(`No broker defined for MQTT server binding - skipping`);
        } else {
            const selfHost = this.config.selfHost ?? false;
            if (selfHost) {
                await this.startBroker();
            }
            // try to connect to the broker without or with credentials
            if (this.config.psw === undefined) {
                debug(`MqttBrokerServer trying to connect to broker at ${this.brokerURI}`);
            } else if (this.config.clientId === undefined) {
                debug(`MqttBrokerServer trying to connect to secured broker at ${this.brokerURI}`);
            } else if (this.config.protocolVersion === undefined) {
                debug(
                    `MqttBrokerServer trying to connect to secured broker at ${this.brokerURI} with client ID ${this.config.clientId}`
                );
            } else {
                debug(
                    `MqttBrokerServer trying to connect to secured broker at ${this.brokerURI} with client ID ${this.config.clientId}`
                );
            }

            try {
                this.broker = await mqtt.connectAsync(this.brokerURI, this.config);
                info(`MqttBrokerServer connected to broker at ${this.brokerURI}`);

                const parsed = new url.URL(this.brokerURI);
                this.address = parsed.hostname;
                const port = parseInt(parsed.port);
                this.port = port > 0 ? port : 1883;
            } catch (err) {
                error(`MqttBrokerServer could not connect to broker at ${this.brokerURI}`);
                throw err;
            }
        }
    }

    public async stop(): Promise<void> {
        if (this.broker !== undefined) {
            this.broker.unsubscribe("*");
            this.broker.end(true);
        }

        if (this.hostedBroker !== undefined) {
            // When the broker is hosted, we need to close it.
            // Both this.hostedBroker and this.hostedServer are defined at the same time.
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await new Promise<void>((resolve) => this.hostedServer!.close(() => resolve()));
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await new Promise<void>((resolve) => this.hostedBroker!.close(() => resolve()));
        }
    }

    public getPort(): number {
        return this.port;
    }

    /**
     *
     * @returns the address of the broker or undefined if the Server is not started.
     */
    public getAddress(): string | undefined {
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
                    password.equals(Buffer.from(this.config.selfHostAuthentication[i].password ?? ""))
                ) {
                    done(null, true);
                    return;
                }
            }
            done(null, false);
            return;
        }
        done(null, true);
    }

    private async startBroker() {
        return new Promise<void>((resolve, reject) => {
            this.hostedServer = Server({});
            let server: tls.Server | net.Server;
            if (this.config.key) {
                server = tls.createServer({ key: this.config.key, cert: this.config.cert }, this.hostedServer.handle);
            } else {
                server = net.createServer(this.hostedServer.handle);
            }
            const parsed = new url.URL(this.brokerURI);
            const port = parseInt(parsed.port);

            this.port = port > 0 ? port : 1883;
            this.hostedServer.authenticate = this.selfHostAuthentication.bind(this);

            const errorListener = (err: Error) => {
                error(`error listening for ${this.brokerURI}, ${err}`);
                reject(err);
            };
            server.once("error", errorListener);

            debug(`MqttBrokerServer creating server for ${this.brokerURI}`);
            this.hostedBroker = server.listen(port, parsed.hostname, () => {
                debug(`MqttBrokerServer listening ${this.brokerURI}`);
                // clean up listener if not called
                server.removeListener("error", errorListener);
                resolve();
            });
        });
    }
}
