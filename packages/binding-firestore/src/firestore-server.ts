/********************************************************************************
 * Copyright (c) 2021 Contributors to the Eclipse Foundation
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
import { ProtocolServer, ExposedThing, ContentSerdes, Servient, Content } from "@node-wot/core";

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

    private fbConfig: any = null;

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
            const topic =
                this.getHostName() + "/" + encodeURIComponent(name) + "/properties/" + encodeURIComponent(propertyName);
            const propertyWriteReqTopic =
                this.getHostName() +
                "/" +
                encodeURIComponent(name) +
                "/propertyWriteReq/" +
                encodeURIComponent(propertyName);
            /*      const propertyReadReqTopic =
        this.getHostName() +
        '/' +
        encodeURIComponent(name) +
        '/propertyReadReq/' +
        encodeURIComponent(propertyName)
*/
            this.topics.push(topic);
            this.topics.push(propertyWriteReqTopic);

            const property = thing.properties[propertyName];
            console.info("  properties topic:", topic);

            thing.setPropertyWriteHandler(propertyName, async (data) => {
                console.debug(`[debug] property ${propertyName} changed in server:`, data);
                let content: Content;
                try {
                    content = ContentSerdes.get().valueToContent(data, <any>property, this.DEFAULT_CONTENT_TYPE);
                } catch (err) {
                    console.warn(
                        `[warn] FirestoreServer cannot process data for Property '${propertyName}': ${err.message}`
                    );
                    // stop to handle writing property
                    thing.setPropertyWriteHandler(propertyName, async (data) => {
                        // Do nothing
                    });
                    return;
                }
                console.debug(`[debug] write property ${propertyName}:`, content);

                if (content && content.body) {
                    await writeDataToFirestore(this.firestore, topic, content).catch((err) => {
                        console.error(`[error] failed to write property (${propertyName}): `, err);
                    });
                }
            });

            thing.setPropertyReadHandler(propertyName, async () => {
                const content = await readDataFromFirestore(this.firestore, topic);
                console.debug(`[debug] read property ${propertyName}:`, content);
                return content;
            });

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
            thing.properties[propertyName].forms.push(form);
            console.debug(
                `[debug] FirestoreServer at ${this.FIRESTORE_HREF_BASE} assigns '${href}' to property '${propertyName}'`
            );

            if (thing.properties[propertyName].observable) {
                const href = this.FIRESTORE_HREF_BASE + topic;
                const form = new TD.Form(href, this.DEFAULT_CONTENT_TYPE);
                form.op = ["observeproperty", "unobserveproperty"];
                thing.properties[propertyName].forms.push(form);
                console.debug(
                    "[binding-http]",
                    `HttpServer on port ${this.getPort()} assigns '${href}' to observable Property '${propertyName}'`
                );
            }
            /*      subscribeToFirestore(
        this.firestore,
        this.firestoreObservers,
        propertyReadReqTopic,
        async (err, content: Content) => {
          if (err) {
            console.error(
              `[error] failed to read property request (${propertyName}): `,
              err
            )
            return
          }
          console.debug(
            `[debug] FirestoreServer at ${this.getHostName()} received message for '${propertyReadReqTopic}'`
          )

          const value = await thing.readProperty(propertyName)
          console.debug(
            `[debug] getting property(${propertyName}) data: `,
            value
          )
        }
      )
*/
            if (thing.properties[propertyName].readOnly === false) {
                subscribeToFirestore(
                    this.firestore,
                    this.firestoreObservers,
                    propertyWriteReqTopic,
                    (err, content: Content) => {
                        if (err) {
                            console.error(`[error] failed to receive property (${propertyName}): `, err);
                            return;
                        }
                        console.debug(
                            `[debug] FirestoreServer at ${this.getHostName()} received message for '${topic}'`
                        );

                        content.type = this.DEFAULT_CONTENT_TYPE;
                        console.debug(`[debug] getting property(${propertyName}) data: `);
                        thing.writeProperty(propertyName, content);
                    }
                );
            }
        }

        console.info("[info] setup actions");
        for (const actionName in thing.actions) {
            const topic =
                this.getHostName() + "/" + encodeURIComponent(name) + "/actions/" + encodeURIComponent(actionName);
            // Create a topic for writing results.
            const actionResultTopic =
                this.getHostName() +
                "/" +
                encodeURIComponent(name) +
                "/actionResults/" +
                encodeURIComponent(actionName);

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
                            const output = await thing.invokeAction(actionName, content).catch((err) => {
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
                            // TODO: How do we find the type of output that is the result of Action?
                            const outContent: Content = ContentSerdes.get().valueToContent(
                                output as DataSchemaValue, // FIXME
                                action.output,
                                this.DEFAULT_CONTENT_TYPE
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
            const topic =
                this.getHostName() + "/" + encodeURIComponent(name) + "/events/" + encodeURIComponent(eventName);

            this.topics.push(topic);

            const event = thing.events[eventName];
            // FIXME store subscription and clean up on stop
            thing.subscribeEvent(
                eventName,
                // let subscription = event.subscribe(
                async (data) => {
                    let content: Content;
                    try {
                        content = ContentSerdes.get().valueToContent(data, event.data, this.DEFAULT_CONTENT_TYPE);
                    } catch (err) {
                        console.warn(
                            `[warn] FirestoreServer on ${this.getHostName()} cannot process data for Event '${eventName}: ${
                                err.message
                            }'`
                        );
                        thing.unsubscribeEvent(eventName);
                        return;
                    }
                    // send event data
                    console.debug(
                        `[debug] FirestoreServer at ${this.getHostName()} publishing to Event topic '${eventName}' `
                    );
                    await writeDataToFirestore(this.firestore, topic, content).catch((err) => {
                        console.error(`[error] failed to write event(${eventName})`, err);
                    });
                }
            );

            const href = this.FIRESTORE_HREF_BASE + topic;
            const form = new TD.Form(href, ContentSerdes.DEFAULT);
            form.op = ["subscribeevent", "unsubscribeevent"];
            event.forms.push(form);
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
}
