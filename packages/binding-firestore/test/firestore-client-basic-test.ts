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
import Servient, { Helpers, createLoggers } from "@node-wot/core";
import FirestoreClientFactory from "../src/firestore-client-factory";
import FirestoreCodec from "../src/codecs/firestore-codec";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import { launchTestThing } from "./test-thing";

import { ThingDescription } from "wot-typescript-definitions";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const firestoreConfig = require("./firestore-config.json");
const { error } = createLoggers("binding-firestore", "firestore-client-basic-test");

// chai.should()
chai.use(chaiAsPromised);
const assert = chai.assert;

let thing: WoT.ConsumedThing;

const wait = async (msec: number) => {
    await new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(null);
        }, msec);
    });
};

@suite("Firestore client basic test implementation")
class FirestoreClientBasicTest {
    static async before() {
        await launchTestThing();
        await wait(3500);
        if (!firebase.apps.length) {
            firebase.initializeApp(firestoreConfig.firebaseConfig);
            const isEmulating = true;
            if (isEmulating) {
                firebase.auth().useEmulator("http://127.0.0.1:9099");
                firebase.firestore().settings({
                    host: "127.0.0.1:8088",
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
        console.log("test1", wotHelper);
        try {
            console.log("test1.5", wotHelper);
            const tdStr = await wotHelper.fetch(`firestore://${firestoreConfig.hostName}/test-thing`);
            console.log("test2", tdStr);
            const td = JSON.parse(tdStr as string);
            console.log("test2.5", td);
            try {
                const WoT = await servient.start();
                console.log("test3");
                thing = await WoT.consume(td as ThingDescription);
                console.log("test4", thing);
            } catch (err) {
                error(`Script error: ${err}`);
            }
        } catch (err) {
            console.log(err);
            error(`Fetch error: ${err}`);
        }
    }

    static after() {
        // return promisify(HttpClientBasicTest.server.close)
    }

    @test async "[client] check initial property"() {
        console.log("start");
        const int = await (await thing.readProperty("integerProperty")).value();
        console.log("---------- int", int);
        assert.equal(int, 0);
        const str = await (await thing.readProperty("stringProperty")).value();
        console.log("---------- str", str);
        assert.equal(str, "");
        const obj = await (await thing.readProperty("objectProperty")).value();
        console.log("---------- obj", obj);
        assert.deepEqual(obj, { testNum: 0, testStr: "abc" });
    }

    @test async "[client] property read / write for integer"() {
        await thing.writeProperty("integerProperty", 333);
        await wait(1000);
        const int = await (await thing.readProperty("integerProperty")).value();
        console.log("---------- int", int);
        assert.equal(int, 333);
    }

    @test async "[client] property read / write for string"() {
        await thing.writeProperty("stringProperty", "test-string");
        await wait(1000);
        const str = await (await thing.readProperty("stringProperty")).value();
        console.log("---------- str", str);
        assert.equal(str, "test-string");
    }

    @test async "[client] property read / write for object"() {
        await thing.writeProperty("objectProperty", {
            testKey1: "testString",
            testKey2: 123,
        });
        await wait(1000);
        const obj = await (await thing.readProperty("objectProperty")).value();
        console.log("---------- obj", obj);
        assert.deepEqual(obj, { testKey1: "testString", testKey2: 123 });
    }

    @test async "[client] action without args and response"() {
        await thing.invokeAction("actionWithoutArgsResponse");
        console.log("---------- no response", true);
        assert.ok(true);
    }

    @test async "[client] action about number"() {
        const v = await thing.invokeAction("actionNum", 123);
        let num = await v?.value();
        console.log("---------- num", num);
        assert.equal(num, 123);
    }

    @test async "[client] action about string"() {
        const v = await thing.invokeAction("actionString", "string");
        const str = await v?.value();
        assert.equal(str, "string");
    }

    @test async "[client] action about object"() {
        const v = await thing.invokeAction("actionObject", {
            testkey3: 111,
            testkey4: "abc",
        });
        const obj = await v?.value();
        console.log("---------- obj", obj);
        assert.deepEqual(obj, { testkey3: 111, testkey4: "abc" });
    }

    @test async "[client] action string to object"() {
        const v = await thing.invokeAction("actionStringToObj", "teststr");
        const obj = await v?.value();
        console.log("---------- obj", obj);
        assert.deepEqual(obj, { test: "teststr" });
    }

    @test async "[client] action object to number"() {
        const v = await thing.invokeAction("actionObjToNum", {
            testkey5: 5,
            testkey6: "test6",
        });
        const num = await v?.value();
        console.log("---------- num", num);
        assert.equal(num, 1);
    }

    @test async "[client] subscribe and unsubscribe event with integer"() {
        let subscribeFlg = true;
        let errorMes = null;
        const sub = await thing.subscribeEvent("eventInteger", async (event) => {
            if (subscribeFlg) {
                const v = await event.value();
                console.log("---------- v", v);
                assert.equal(v, 200);
            } else {
                errorMes = "called but unsubscribed";
            }
        });
        await wait(500);
        await thing.invokeAction("actionEventInteger", 200);
        await wait(500);
        sub.stop();
        subscribeFlg = false;
        await thing.invokeAction("actionEventInteger", 18);
        await wait(500);
        assert.equal(errorMes, null);
    }

    @test async "[client] subscribe and unsubscribe event with string"() {
        let subscribeFlg = true;
        let errorMes = null;
        const sub = await thing.subscribeEvent("eventString", async (event) => {
            if (subscribeFlg) {
                const v = await event.value();
                console.log("---------- v", v);
                assert.equal(v, "string123");
            } else {
                errorMes = "called but unsubscribed";
            }
        });
        await wait(500);
        await thing.invokeAction("actionEventString", "string123");
        await wait(500);
        sub.stop();
        subscribeFlg = false;
        await thing.invokeAction("actionEventString", "string987");
        await wait(500);
        assert.equal(errorMes, null);
    }

    @test async "[client] subscribe and unsubscribe event with object"() {
        let subscribeFlg = true;
        let errorMes = null;
        let retVal = null;
        const sub = await thing.subscribeEvent("eventObject", async (event) => {
            if (subscribeFlg) {
                const v = await event.value();
                retVal = v;
            } else {
                errorMes = "called but unsubscribed";
            }
        });
        await wait(500);
        await thing.invokeAction("actionEventObject", {
            eventStr: "event1",
            eventNum: 123,
        });
        await wait(500);
        console.log("---------- retVal", retVal);
        assert.deepEqual(retVal, { eventStr: "event1", eventNum: 123 });
        sub.stop();
        subscribeFlg = false;
        await thing.invokeAction("actionEventObject", {
            eventStr: "event2",
            eventNum: 987,
        });
        await wait(500);
        assert.equal(errorMes, null);
    }

    @test async "[client] observe and unobserve property"() {
        let observeFlg = true;
        let errorMes = null;
        let retVal = null;
        const ob = await thing.observeProperty("stringProperty", async (str) => {
            if (observeFlg) {
                const v = await str.value();
                retVal = v;
            } else {
                errorMes = "called but unobserved";
            }
        });
        await wait(500);
        await thing.writeProperty("stringProperty", "test-string-888");
        await wait(500);
        console.log("---------- retVal", retVal);
        assert.strictEqual(retVal, "test-string-888");
        ob.stop();
        observeFlg = false;
        await thing.writeProperty("stringProperty", "test-string-889");
        await wait(500);
        assert.equal(errorMes, null);
    }
}
