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
import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import Servient, { Helpers } from "@node-wot/core";
import FirestoreClientFactory from "../src/firestore-client-factory";
import FirestoreCodec from "../src/codecs/firestore-codec";
import firebase from "firebase/compat/app";
import { launchTestThing } from "./test-thing";

// process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8088'

import { ThingDescription } from "wot-typescript-definitions";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const firestoreConfig = require("./firestore-config.json");

// chai.should()
chai.use(chaiAsPromised);
const assert = chai.assert;

const wait = async (msec: number) => {
    await new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(null);
        }, msec);
    });
};

@suite("Firestore client basic test implementation")
class FirestoreClientBasicTest {
    private thing: WoT.ConsumedThing;

    static async before() {
        await launchTestThing();
        await wait(3500);
    }

    async before() {
        if (!firebase) {
            firebase.initializeApp(firestoreConfig.firebaseConfig);
            const isEmulating = true;
            if (isEmulating) {
                firebase.auth().useEmulator("http://localhost:9099");
                // firebase.firestore().useEmulator('localhost', 8088)
                firebase.firestore().settings({
                    host: "localhost:8088",
                    ssl: false,
                });
            }
        }

        const servient = new Servient();
        const clientFactory = new FirestoreClientFactory(firestoreConfig);
        servient.addClientFactory(clientFactory);

        const codec = new FirestoreCodec();
        servient.addMediaType(codec);

        const wotHelper = new Helpers(servient);
        try {
            const td = await wotHelper.fetch(`firestore://${firestoreConfig.hostName}/test-thing`);
            try {
                const WoT = await servient.start();
                this.thing = await WoT.consume(td as ThingDescription);
            } catch (err) {
                console.error("Script error:", err);
            }
        } catch (err) {
            console.error("Fetch error:", err);
        }
    }

    static after() {
        // return promisify(HttpClientBasicTest.server.close)
    }

    @test async "[client] check initial property"() {
        const int = await (await this.thing.readProperty("integerProperty")).value();
        assert.equal(int, 0);
        const str = await (await this.thing.readProperty("stringProperty")).value();
        assert.equal(str, "");
        const obj = await (await this.thing.readProperty("objectProperty")).value();
        assert.deepEqual(obj, { testNum: 0, testStr: "abc" });
    }

    @test async "[client] property read / write for integer"() {
        await this.thing.writeProperty("integerProperty", 333);
        await wait(1000);
        const int = await (await this.thing.readProperty("integerProperty")).value();
        assert.equal(int, 333);
    }

    @test async "[client] property read / write for string"() {
        await this.thing.writeProperty("stringProperty", "test-string");
        await wait(1000);
        const str = await (await this.thing.readProperty("stringProperty")).value();
        assert.equal(str, "test-string");
    }

    @test async "[client] property read / write for object"() {
        await this.thing.writeProperty("objectProperty", {
            testKey1: "testString",
            testKey2: 123,
        });
        await wait(1000);
        const obj = await (await this.thing.readProperty("objectProperty")).value();
        assert.deepEqual(obj, { testKey1: "testString", testKey2: 123 });
    }

    @test async "[client] action without args and response"() {
        await this.thing.invokeAction("actionWithoutArgsResponse");
        assert.ok(true);
    }

    @test async "[client] action about number"() {
        const v = await this.thing.invokeAction("actionNum", 123);
        const num = await v.value();
        assert.equal(num, 123);
    }

    @test async "[client] action about string"() {
        const str = await (await this.thing.invokeAction("actionString", "string")).value();
        assert.equal(str, "string");
    }

    @test async "[client] action about object"() {
        const obj = await (
            await this.thing.invokeAction("actionObject", {
                testkey3: 111,
                testkey4: "abc",
            })
        ).value();
        assert.deepEqual(obj, { testkey3: 111, testkey4: "abc" });
    }

    @test async "[client] action string to object"() {
        const obj = await (await this.thing.invokeAction("actionStringToObj", "teststr")).value();
        assert.deepEqual(obj, { test: "teststr" });
    }

    @test async "[client] action object to number"() {
        const num = await (
            await this.thing.invokeAction("actionObjToNum", {
                testkey5: 5,
                testkey6: "test6",
            })
        ).value();
        assert.equal(num, 1);
    }

    @test async "[client] subscribe and unsubscribe event with integer"() {
        let subscribeFlg = true;
        let errorMes = null;
        const sub = await this.thing.subscribeEvent("eventInteger", async (event) => {
            if (subscribeFlg) {
                const v = await event.value();
                assert.equal(v, 200);
            } else {
                errorMes = "called but unsubscribed";
            }
        });
        await wait(500);
        await this.thing.invokeAction("actionEventInteger", 200);
        await wait(500);
        sub.stop();
        subscribeFlg = false;
        await this.thing.invokeAction("actionEventInteger", 18);
        await wait(500);
        assert.equal(errorMes, null);
    }

    @test async "[client] subscribe and unsubscribe event with string"() {
        let subscribeFlg = true;
        let errorMes = null;
        const sub = await this.thing.subscribeEvent("eventString", async (event) => {
            if (subscribeFlg) {
                const v = await event.value();
                assert.equal(v, "string123");
            } else {
                errorMes = "called but unsubscribed";
            }
        });
        await wait(500);
        await this.thing.invokeAction("actionEventString", "string123");
        await wait(500);
        sub.stop();
        subscribeFlg = false;
        await this.thing.invokeAction("actionEventString", "string987");
        await wait(500);
        assert.equal(errorMes, null);
    }

    @test async "[client] subscribe and unsubscribe event with object"() {
        let subscribeFlg = true;
        let errorMes = null;
        const sub = await this.thing.subscribeEvent("eventObject", async (event) => {
            if (subscribeFlg) {
                const v = await event.value();
                assert.deepEqual(v, { eventStr: "event1", eventNum: 123 });
            } else {
                errorMes = "called but unsubscribed";
            }
        });
        await wait(500);
        await this.thing.invokeAction("actionEventObject", {
            eventStr: "event1",
            eventNum: 123,
        });
        await wait(500);
        sub.stop();
        subscribeFlg = false;
        await this.thing.invokeAction("actionEventObject", {
            eventStr: "event2",
            eventNum: 987,
        });
        await wait(500);
        assert.equal(errorMes, null);
    }

    @test.skip async "[client] observe and unobserve property *observeProperty is currently unavailable"() {
        let observeFlg = true;
        let errorMes = null;
        const ob = await this.thing.observeProperty("stringProperty", async (str) => {
            if (observeFlg) {
                const v = await str.value();
                assert.equal(v, "test-string-888");
            } else {
                errorMes = "called but unobserved";
            }
        });
        await wait(500);
        await this.thing.writeProperty("stringProperty", "test-string-888");
        await wait(500);
        ob.stop();
        observeFlg = false;
        await this.thing.writeProperty("stringProperty", "test-string-889");
        await wait(500);
        assert.equal(errorMes, null);
    }
}
