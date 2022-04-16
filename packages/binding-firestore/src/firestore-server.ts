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
 * WoT Firestore Server
 */
import * as os from "os";

import * as TD from "@node-wot/td-tools";
// import Wot from '@node-wot/browser-bundle'
import { FirestoreConfig } from "./firestore";
import FirestoreCodec from "./codecs/firestore-codec";
import {
    ProtocolServer,
    ExposedThing,
    ContentSerdes,
    Servient,
    Content,
    Helpers,
    ProtocolHelpers,
} from "@node-wot/core";

import "firebase/auth";
import "firebase/firestore";
import {
    initFirestore,
    writeDataToFirestore,
    readDataFromFirestore,
    subscribeToFirestore,
    removeDataFromFirestore,
    writeMetaDataToFirestore,
    removeMetaDataFromFirestore,
} from "./firestore-handler";
import { DataSchemaValue } from "wot-typescript-definitions";

export default class FirestoreServer implements ProtocolServer {
    public readonly scheme: "firestore";
    private readonly things: Map<string, ExposedThing> = new Map<string, ExposedThing>();
    private servient: Servient = null;
    private contentSerdes: ContentSerdes = ContentSerdes.get();

    private FIRESTORE_HREF_BASE = "firestore://";
    private DEFAULT_CONTENT_TYPE = "application/firestore";

    private firestore: any = null;
    private firestoreObservers: any = {};

    private static metaData = { hostName: "", things: <any>[] };

    private fbConfig: FirestoreConfig = null;

    // storing topics for destroy thing
    private topics: any = [];

    constructor(config: FirestoreConfig = {}) {
        this.contentSerdes.addCodec(new FirestoreCodec(), true);
        if (typeof config !== "object") {
            throw new Error(`FirestoreServer requires config object (got ${typeof config})`);
        }
        this.fbConfig = config;
    }

    public async start(servient: Servient): Promise<void> {
        console.info(`[info] WoT Firestore start`);
        const firestore = await initFirestore(this.fbConfig, null);
        console.info("[info] firebase auth success");
        this.firestore = firestore;
        // store servient to get credentials
        this.servient = servient;
    }

    public async stop(): Promise<void> {
        console.info(`[info] WoT Firestore stop`);
        for (const key in this.firestoreObservers) {
            console.debug("[debug] unsubscribe: ", key);
            this.firestoreObservers[key]();
        }
    }

    public getHostName(): string {
        return this.fbConfig.hostName || process.env.WoTHostName || os.hostname();
    }

    public getPort(): number {
        return -1;
    }

    public async expose(thing: ExposedThing): Promise<void> {
        if (this.firestore === undefined) {
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

        console.info(`[info] FirestoreServer exposes '${thing.title}' as unique '/${name}/*'`);
        this.things.set(name, thing);

        try {
            FirestoreServer.metaData.hostName = this.getHostName();
            if (!FirestoreServer.metaData.things.includes(name)) {
                FirestoreServer.metaData.things.push(name);
                console.debug("[debug] write metaData:", FirestoreServer.metaData);
            }
        } finally {
            await writeMetaDataToFirestore(this.firestore, this.getHostName(), FirestoreServer.metaData);
        }

        console.info("[info] setup properties");
        for (const propertyName in thing.properties) {
            const topic = this.getHostName() + "/" + name + "/properties/" + propertyName;
            const propertyWriteReqTopic = this.getHostName() + "/" + name + "/propertyWriteReq/" + propertyName;
            const propertyReadReqTopic = this.getHostName() + "/" + name + "/propertyReadReq/" + propertyName;
            const propertyReadResultTopic = this.getHostName() + "/" + name + "/propertyReadResults/" + propertyName;

            this.topics.push(topic);
            this.topics.push(propertyWriteReqTopic);
            this.topics.push(propertyReadReqTopic);
            this.topics.push(propertyReadResultTopic);

            let property = thing.properties[propertyName];
            console.info("  properties topic:", topic);

            if (!name) {
                name = "no_name";
            }

            const href = this.FIRESTORE_HREF_BASE + topic;
            const form = new TD.Form(href, this.DEFAULT_CONTENT_TYPE);
            if (thing.properties[propertyName].readOnly) {
                form.op = ["readproperty"];
            } else if (thing.properties[propertyName].writeOnly) {
                form.op = ["writeproperty"];
            } else {
                form.op = ["readproperty", "writeproperty"];
            }
            if (thing.properties[propertyName].observable) {
                form.op.push("observeproperty");
                form.op.push("unobserveproperty");
            }
            thing.properties[propertyName].forms.push(form);
            console.debug(
                `[debug] FirestoreServer at ${this.FIRESTORE_HREF_BASE} assigns '${href}' to property '${propertyName}'`
            );

            if (thing.properties[propertyName].observable) {
                console.debug(
                    "[binding-firestore]",
                    `FirestoreServer on port ${this.getPort()} assigns '${href}' to observable Property '${propertyName}'`
                );
                const options: WoT.InteractionOptions & { formIndex: number } = {
                    formIndex: ProtocolHelpers.findRequestMatchingFormIndex(
                        property.forms,
                        this.scheme,
                        this.FIRESTORE_HREF_BASE + topic,
                        this.DEFAULT_CONTENT_TYPE
                    ),
                };
                const propertyListener = async (content: Content) => {
                    // get property data
                    console.debug(
                        `[debug] FirestoreServer at ${this.getHostName()} publishing to property topic '${propertyName}' `
                    );
                    await writeDataToFirestore(this.firestore, topic, content).catch((err) => {
                        console.error(`[error] failed to write property(${propertyName}) for observer`, err);
                    });
                };
                thing.handleObserveProperty(propertyName, propertyListener, options);
            }
            if (thing.properties[propertyName].readOnly === false) {
                subscribeToFirestore(
                    this.firestore,
                    this.firestoreObservers,
                    propertyWriteReqTopic,
                    async (err, content: Content, reqId) => {
                        if (err) {
                            console.error(`[error] failed to receive property (${propertyName}): `, err);
                            return;
                        }
                        console.debug(
                            `[debug] FirestoreServer at ${this.getHostName()} received message for '${topic}'`
                        );
                        console.debug(`[debug] writing property(${propertyName}) content: `, content);
                        const options: WoT.InteractionOptions & { formIndex: number } = {
                            formIndex: ProtocolHelpers.findRequestMatchingFormIndex(
                                property.forms,
                                this.scheme,
                                this.FIRESTORE_HREF_BASE + topic,
                                this.DEFAULT_CONTENT_TYPE
                            ),
                        };
                        const uriVariables = Helpers.parseUrlParameters(
                            this.FIRESTORE_HREF_BASE + topic,
                            thing.uriVariables,
                            property.uriVariables
                        );
                        if (!this.isEmpty(uriVariables)) {
                            options.uriVariables = uriVariables;
                        }
                        await thing.handleWriteProperty(propertyName, content, options);
                    }
                );
            }
            subscribeToFirestore(
                this.firestore,
                this.firestoreObservers,
                propertyReadReqTopic,
                async (err, content: Content, reqId) => {
                    if (err) {
                        console.error(`[error] failed to receive read request (${propertyName}): `, err);
                        return;
                    }
                    console.debug(`[debug] FirestoreServer at ${this.getHostName()} received message for '${topic}'`);
                    const options: WoT.InteractionOptions & { formIndex: number } = {
                        formIndex: ProtocolHelpers.findRequestMatchingFormIndex(
                            property.forms,
                            this.scheme,
                            this.FIRESTORE_HREF_BASE + topic,
                            this.DEFAULT_CONTENT_TYPE
                        ),
                    };
                    const uriVariables = Helpers.parseUrlParameters(
                        this.FIRESTORE_HREF_BASE + topic,
                        thing.uriVariables,
                        property.uriVariables
                    );
                    if (!this.isEmpty(uriVariables)) {
                        options.uriVariables = uriVariables;
                    }

                    const retContent = await thing.handleReadProperty(propertyName, options);
                    try {
                        const contentType = ProtocolHelpers.getPropertyContentType(
                            thing.getThingDescription(),
                            propertyName,
                            "firestore"
                        );
                    } catch (err) {
                        console.warn(
                            `[warn] FirestoreServer cannot process data for Property '${propertyName}': ${err.message}`
                        );
                        return;
                    }
                    console.debug(`[debug] getting property(${propertyName}) data: `, retContent);
                    await writeDataToFirestore(this.firestore, propertyReadResultTopic, retContent, reqId);
                    if (thing.properties[propertyName].observable) {
                        //TODO: Currently, observeProperty is not supported, so it will be implemented after it is supported.
                        //await writeDataToFirestore(this.firestore, topic, retContent, reqId);
                    }
                }
            );
        }

        console.info("[info] setup actions");
        for (const actionName in thing.actions) {
            const topic = this.getHostName() + "/" + name + "/actions/" + actionName;
            // Create a topic for writing results.
            const actionResultTopic = this.getHostName() + "/" + name + "/actionResults/" + actionName;

            this.topics.push(topic);
            this.topics.push(actionResultTopic);

            subscribeToFirestore(
                this.firestore,
                this.firestoreObservers,
                topic,
                async (err, content: Content, reqId: string) => {
                    if (err) {
                        console.error(`[error] failed to receive action(${actionName}): `, err);
                        return;
                    }
                    console.debug(`[debug] FirestoreServer at ${this.getHostName()} received message for '${topic}'`);
                    if (thing) {
                        const action = thing.actions[actionName];
                        if (action) {
                            const options: WoT.InteractionOptions & { formIndex: number } = {
                                formIndex: ProtocolHelpers.findRequestMatchingFormIndex(
                                    action.forms,
                                    this.scheme,
                                    this.FIRESTORE_HREF_BASE + topic,
                                    this.DEFAULT_CONTENT_TYPE
                                ),
                            };
                            const uriVariables = Helpers.parseUrlParameters(
                                this.FIRESTORE_HREF_BASE + topic,
                                thing.uriVariables,
                                action.uriVariables
                            );
                            if (!this.isEmpty(uriVariables)) {
                                options.uriVariables = uriVariables;
                            }
                            let outContent: any = await thing
                                .handleInvokeAction(actionName, content, options)
                                .catch((err) => {
                                    console.error(
                                        `[error] FirestoreServer at ${this.getHostName()} got error on invoking '${actionName}': ${
                                            err.message
                                        }`
                                    );
                                });
                            // Firestore cannot return results
                            console.warn(
                                `[warn] FirestoreServer at ${this.getHostName()} cannot return output '${actionName}'`
                            );
                            await writeDataToFirestore(this.firestore, actionResultTopic, outContent, reqId).catch(
                                (err) => {
                                    console.error(err);
                                }
                            );
                            // topic found and message processed
                            return;
                        }
                    } // Thing exists?
                    console.warn(
                        `[warn] FirestoreServer at ${this.getHostName()} received message for invalid topic '${topic}'`
                    );
                }
            );

            const href = this.FIRESTORE_HREF_BASE + topic;
            const form = new TD.Form(href, this.DEFAULT_CONTENT_TYPE);
            form.op = ["invokeaction"];
            thing.actions[actionName].forms.push(form);
            console.debug(
                `[debug] FirestoreServer at ${this.FIRESTORE_HREF_BASE} assigns '${href}' to Action '${actionName}'`
            );
        }

        console.info("[info] setup events");
        for (const eventName in thing.events) {
            const topic = this.getHostName() + "/" + name + "/events/" + eventName;

            this.topics.push(topic);
            const event = thing.events[eventName];
            const options: WoT.InteractionOptions & { formIndex: number } = {
                formIndex: ProtocolHelpers.findRequestMatchingFormIndex(
                    event.forms,
                    this.scheme,
                    this.FIRESTORE_HREF_BASE + topic,
                    this.DEFAULT_CONTENT_TYPE
                ),
            };
            const uriVariables = Helpers.parseUrlParameters(
                this.FIRESTORE_HREF_BASE + topic,
                thing.uriVariables,
                event.uriVariables
            );
            if (!this.isEmpty(uriVariables)) {
                options.uriVariables = uriVariables;
            }
            const eventListener = async (value: Content) => {
                // get event data
                console.debug(
                    `[debug] FirestoreServer at ${this.getHostName()} publishing to Event topic '${eventName}' `
                );
                await writeDataToFirestore(this.firestore, topic, value).catch((err) => {
                    console.error(`[error] failed to write event(${eventName})`, err);
                });
            };
            const href = this.FIRESTORE_HREF_BASE + topic;
            const form = new TD.Form(href, ContentSerdes.DEFAULT);
            form.op = ["subscribeevent", "unsubscribeevent"];
            event.forms.push(form);
            // FIXME store subscription and clean up on stop
            thing.handleSubscribeEvent(eventName, eventListener, options);

            console.debug(`[debug] FirestoreServer at ${this.getHostName()} assigns '${href}' to Event '${eventName}'`);
        }

        // Registration of TD
        const tdContent: Content = ContentSerdes.get().valueToContent(
            JSON.stringify(thing.getThingDescription()),
            null,
            "application/td+json"
        );
        await writeDataToFirestore(this.firestore, `${this.getHostName()}/${name}`, tdContent);
        this.topics.push(`${this.getHostName()}/${name}`);
        console.log(`**************************************`);
        console.log(`***** exposed thing descriptioon *****`);
        console.log(JSON.stringify(thing.getThingDescription(), null, "  "));
        console.log(`**************************************`);
        console.log(`**************************************`);
    }

    public destroy(thingId: string): Promise<boolean> {
        console.debug("[binding-firestore]", `destroying thingId '${thingId}'`);
        return new Promise<boolean>((resolve, reject) => {
            // TODO Firestoreに登録した、このThingに関わるデータを削除？
            removeMetaDataFromFirestore(this.firestore, this.getHostName());
            this.topics.forEach(async (topic: string) => {
                await removeDataFromFirestore(this.firestore, topic);
            });
            resolve(true);
        });
    }
    private isEmpty(obj: Record<string, unknown>) {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) return false;
        }
        return true;
    }
}
