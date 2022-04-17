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

import Servient from "@node-wot/core";
import FirestoreServer from "../src/firestore-server";
import FirestoreCodec from "../src/codecs/firestore-codec";
import firebase from "firebase/compat/app";

import firestoreConfig from "./firestore-config.json";

export const launchTestThing = async (): Promise<WoT.ExposedThing | void> => {
    // setup for emulator
    try {
        // process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8088'
        firebase.initializeApp(firestoreConfig.firebaseConfig);
        const isEmulating = true;
        if (isEmulating) {
            firebase.auth().useEmulator("http://localhost:9099");
            // firebase.firestore().useEmulator('localhost', 8088)
            firebase.firestore().settings({
                host: "localhost:8088",
                ssl: false,
            });
            try {
                // add test user
                await firebase
                    .auth()
                    .createUserWithEmailAndPassword(firestoreConfig.user.email, firestoreConfig.user.password);
            } catch (e) {
                // is not error
                console.log("user ia already created err: ", e);
            }
        }
        // create server
        const server = new FirestoreServer(firestoreConfig);

        // create Servient add Firebase binding
        const servient = new Servient();
        servient.addServer(server);

        const codec = new FirestoreCodec();
        servient.addMediaType(codec);

        const WoT = await servient.start();

        // init property values
        let objectProperty: Record<string, unknown> = { testNum: 0, testStr: "abc" };
        let stringProperty = "";
        let integerProperty = 0;

        const thing = await WoT.produce({
            title: "test-thing",
            description: "thing for test",
            "@context": ["https://www.w3.org/2019/wot/td/v1", { iot: "http://example.org/iot" }],
            properties: {
                objectProperty: {
                    type: "object",
                    description: "object property",
                    observable: true,
                    readOnly: false,
                },
                stringProperty: {
                    type: "string",
                    description: "string property",
                    observable: true,
                    readOnly: false,
                },
                integerProperty: {
                    type: "integer",
                    description: "integer property",
                    observable: true,
                    readOnly: false,
                },
            },
            actions: {
                actionWithoutArgsResponse: {
                    input: {},
                    output: {},
                    description: "action without args and without response",
                },
                actionNum: {
                    input: {
                        type: "number",
                    },
                    output: {
                        type: "number",
                    },
                    description: "action about number",
                },
                actionString: {
                    input: {
                        type: "string",
                    },
                    output: {
                        type: "string",
                    },
                    description: "action about string",
                },
                actionObject: {
                    input: {
                        type: "object",
                    },
                    output: {
                        type: "object",
                    },
                    description: "action about object",
                },
                actionStringToObj: {
                    input: {
                        type: "string",
                    },
                    output: {
                        type: "object",
                    },
                    description: "action string to object",
                },
                actionObjToNum: {
                    input: {
                        type: "object",
                    },
                    output: {
                        type: "number",
                    },
                    description: "action object to number",
                },
                actionEventInteger: {
                    input: {
                        type: "integer",
                    },
                    output: {},
                    description: "action event integer",
                },
                actionEventString: {
                    input: { type: "string" },
                    output: {},
                    description: "action event integer",
                },
                actionEventObject: {
                    input: { type: "object" },
                    output: {},
                    description: "action event integer",
                },
            },
            events: {
                eventInteger: {
                    data: {
                        type: "integer",
                    },
                    description: "event with integer",
                },
                eventString: {
                    data: {
                        type: "string",
                    },
                    description: "event with string",
                },
                eventObject: {
                    data: {
                        type: "object",
                    },
                    description: "event with object",
                },
            },
        });
        // expose the thing
        await thing.expose();

        // console.log("Produced " + thing.getThingDescription().title);

        // set property handlers (using async-await)
        thing.setPropertyReadHandler("objectProperty", async () => {
            return objectProperty;
        });
        thing.setPropertyReadHandler("stringProperty", async () => {
            return stringProperty;
        });
        thing.setPropertyReadHandler("integerProperty", async () => {
            return integerProperty;
        });
        thing.setPropertyWriteHandler("objectProperty", async (value) => {
            const v = (await value.value()) as Record<string, unknown>;
            objectProperty = v;
        });
        thing.setPropertyWriteHandler("stringProperty", async (value) => {
            const v = (await value.value()) as string;
            stringProperty = v;
        });
        thing.setPropertyWriteHandler("integerProperty", async (value) => {
            const v = (await value.value()) as number;
            integerProperty = v;
        });

        // set action handlers
        thing.setActionHandler("actionWithoutArgsResponse", async (params) => {
            console.log("actionWithoutArgsResponse", params);
            return undefined;
        });
        thing.setActionHandler("actionNum", async (params) => {
            const v = await params.value();
            console.log("actionNum", v);
            return v;
        });
        thing.setActionHandler("actionString", async (params) => {
            const v = await params.value();
            console.log("actionString", v);
            return v;
        });
        thing.setActionHandler("actionObject", async (params) => {
            const v = await params.value();
            console.log("actionObject", v);
            return v;
        });
        thing.setActionHandler("actionStringToObj", async (params) => {
            const v = await params.value();
            console.log("actionStringToObj", v);
            return { test: v };
        });
        thing.setActionHandler("actionObjToNum", async (params) => {
            const v = await params.value();
            console.log("actionObjToNum", v);
            return 1;
        });
        thing.setActionHandler("actionStringToObj", async (params) => {
            const v = await params.value();
            console.log("actionStringToObj", v);
            return { test: v };
        });
        thing.setActionHandler("actionObjToNum", async (params) => {
            const v = await params.value();
            console.log("actionObjToNum", v);
            return 1;
        });
        // actions for event
        thing.setActionHandler("actionEventInteger", async (params) => {
            const v = await params.value();
            console.log("actionEventInteger", v);
            thing.emitEvent("eventInteger", v);
            return undefined;
        });
        thing.setActionHandler("actionEventString", async (params) => {
            const v = await params.value();
            console.log("actionEventString", v);
            thing.emitEvent("eventString", v);
            return undefined;
        });
        thing.setActionHandler("actionEventObject", async (params) => {
            const v = await params.value();
            console.log("actionEventObject", v);
            thing.emitEvent("eventObject", v);
            return undefined;
        });

        console.info(thing.getThingDescription().title + " ready");
        return thing;
    } catch (err) {
        console.log(err);
    }
};
