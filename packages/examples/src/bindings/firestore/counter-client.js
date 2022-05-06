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

const { Servient, Helpers } = require("@node-wot/core");
const { FirestoreClientFactory, FirestoreCodec } = require("@node-wot/binding-firestore");
const firestoreConfig = require("./firestore-config.json");

// for firebase emulator settings
const initFirebaseEmu = async () => {
    const firebase = require("firebase/compat/app");
    firebase.initializeApp(firestoreConfig.firebaseConfig);
    firebase.auth().useEmulator("http://localhost:9099");
    // firebase.firestore().useEmulator('localhost', 8088)
    firebase.firestore().settings({
        host: "localhost:8088",
        ssl: false,
    });
};

const main = async () => {
    // if you don't want to use emulator, plese remove this line
    await initFirebaseEmu();

    const servient = new Servient();
    const clientFactory = new FirestoreClientFactory(firestoreConfig);
    servient.addClientFactory(clientFactory);
    const codec = new FirestoreCodec();
    servient.addMediaType(codec);

    const WoTHelpers = new Helpers(servient);
    const WoT = await servient.start();

    try {
        const td = await WoTHelpers.fetch(`firestore://${firestoreConfig.hostName}/counter`);
        try {
            const thing = await WoT.consume(td);
            console.info("=== TD ===");
            console.info(td);
            console.info("==========");
            // subscribe event
            const subEvent = await thing.subscribeEvent("change", async (event) => {
                let c = await event.value();
                console.info("count from event is ", c);
            });
            // read property #1
            const read1 = await thing.readProperty("count");
            console.log("count value is", await read1.value());
            // increment property #1 (without step)
            await thing.invokeAction("increment");
            const inc1 = await thing.readProperty("count");
            console.info("count value after increment #1 is", await inc1.value());
            // increment property #2 (with step)
            await thing.invokeAction("increment", undefined);
            const inc2 = await thing.readProperty("count");
            console.info("count value after increment #2 (with step 3) is", await inc2.value());
            // look for the first form for decrement with CoAP binding
            await thing.invokeAction("decrement", undefined);
            const dec1 = await thing.readProperty("count");
            console.info("count value after decrement is", await dec1.value());
        } catch (err) {
            console.error("Script error:", err);
        }
    } catch (err) {
        console.error("Fetch error:", err);
    }
};

main();
