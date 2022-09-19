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

const Servient = require("@node-wot/core").Servient;
const { FirestoreServer, FirestoreCodec } = require("@node-wot/binding-firestore");
const firestoreConfig = require("./firestore-config.json");

// for firebase emulator settings
const initFirebaseEmu = async () => {
    const firebase = require("firebase/compat/app");
    firebase.initializeApp(firestoreConfig.firebaseConfig);
    firebase.auth().useEmulator("http://127.0.0.1:9099");
    firebase.firestore().settings({
        host: "127.0.0.1:8088",
        ssl: false,
    });
    try {
        // add test user
        await firebase.auth().createUserWithEmailAndPassword(firestoreConfig.user.email, firestoreConfig.user.password);
    } catch (e) {
        // is not error
        console.log("user ia already created err: ", e);
    }
};

const main = async () => {
    // if you don't want to use emulator, plese remove this line
    await initFirebaseEmu();

    const servient = new Servient();
    servient.addServer(new FirestoreServer(firestoreConfig));
    const codec = new FirestoreCodec();
    servient.addMediaType(codec);

    const WoT = await servient.start();
    let count;
    let lastChange;
    const thing = await WoT.produce({
        title: "counter",
        titles: {
            en: "counter",
            de: "zähler",
            it: "Contatore",
        },
        description: "counter example Thing",
        descriptions: {
            en: "counter example Thing",
            de: "Zähler Beispiel Ding",
            it: "Contatore Esempio",
        },
        "@context": [
            "https://www.w3.org/2019/wot/td/v1",
            "https://www.w3.org/2022/wot/td/v1.1",
            { iot: "http://example.org/iot" },
        ],
        properties: {
            count: {
                type: "integer",
                description: "current counter value",
                descriptions: {
                    en: "current counter value",
                    de: "Derzeitiger Zähler Stand",
                    it: "valore attuale del contatore",
                },
                "iot:Custom": "example annotation",
                observable: true,
                readOnly: true,
            },
            lastChange: {
                type: "string",
                description: "last change of counter value",
                descriptions: {
                    en: "last change of counter value",
                    de: "Letzte Änderung",
                    it: "ultima modifica del valore",
                },
                observable: true,
                readOnly: true,
            },
        },
        actions: {
            increment: {
                description: "Incrementing counter value",
                descriptions: {
                    en: "Incrementing counter value",
                    de: "Zähler erhöhen",
                    it: "incrementare valore",
                },
            },
            decrement: {
                description: "Decrementing counter value",
                descriptions: {
                    en: "Decrementing counter value",
                    de: "Zähler verringern",
                    it: "decrementare valore",
                },
            },
            reset: {
                description: "Resetting counter value",
                descriptions: {
                    en: "Resetting counter value",
                    de: "Zähler resettieren",
                    it: "resettare valore",
                },
            },
        },
        events: {
            change: {
                description: "change event",
                descriptions: {
                    en: "change event",
                    de: "Änderungsnachricht",
                    it: "resettare valore",
                },
                data: {
                    type: "integer",
                },
            },
        },
    });
    try {
        console.log("Produced " + thing.getThingDescription().title);
        // init property values
        count = 0;
        lastChange = new Date().toISOString();
        // set property handlers (using async-await)
        thing.setPropertyReadHandler("count", async () => count);
        thing.setPropertyReadHandler("lastChange", async () => lastChange);
        // set action handlers (using async-await)
        thing.setActionHandler("increment", async (params, options) => {
            let step = 1;
            if (options && typeof options === "object" && "uriVariables" in options) {
                console.log("options = " + JSON.stringify(options));
                if ("step" in options.uriVariables) {
                    const uriVariables = options.uriVariables;
                    step = uriVariables.step;
                }
            }
            const newValue = count + step;
            console.log("Incrementing count from " + count + " to " + newValue + " (with step " + step + ")");
            count = newValue;
            lastChange = new Date().toISOString();
            thing.emitEvent("change", count);
            thing.emitPropertyChange("count");
            return undefined;
        });
        thing.setActionHandler("decrement", async (params, options) => {
            let step = 1;
            if (options && typeof options === "object" && "uriVariables" in options) {
                console.log("options = " + JSON.stringify(options));
                if ("step" in options.uriVariables) {
                    const uriVariables = options.uriVariables;
                    step = uriVariables.step;
                }
            }
            const newValue = count - step;
            console.log("Decrementing count from " + count + " to " + newValue + " (with step " + step + ")");
            count = newValue;
            lastChange = new Date().toISOString();
            thing.emitEvent("change", count);
            thing.emitPropertyChange("count");
            return undefined;
        });
        thing.setActionHandler("reset", async (params, options) => {
            console.log("Resetting count");
            count = 0;
            lastChange = new Date().toISOString();
            thing.emitEvent("change", count);
            thing.emitPropertyChange("count");
            return undefined;
        });
        // expose the thing
        thing.expose().then(() => {
            console.info(thing.getThingDescription().title + " ready");
        });
    } catch (e) {
        console.log(e);
    }
};

main();
