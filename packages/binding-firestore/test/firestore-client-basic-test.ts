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
import FirestoreClient from "../src/firestore-client";
import Servient, { Helpers } from "@node-wot/core";
import FirestoreClientFactory from "../src/firestore-client-factory";
import FirestoreCodec from "../src/codecs/firestore-codec";
import firebase from "firebase";
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
    private client: FirestoreClient;
    private thing: any;
    private static serverThing: any;

    static async before() {
        this.serverThing = await launchTestThing();
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
        await wotHelper
            .fetch(`firestore://${firestoreConfig.hostName}/test-thing`)
            .then(async (td: ThingDescription) => {
                try {
                    servient.start().then((WoT) => {
                        WoT.consume(td).then(async (thing) => {
                            this.thing = thing;
                        });
                    });
                } catch (err) {
                    console.error("Script error:", err);
                }
            })
            .catch((err) => {
                console.error("Fetch error:", err);
            });
    }

    static after() {
        // return promisify(HttpClientBasicTest.server.close)
    }

    @test.skip async "[client] check initial property"() {
        const int = await (await this.thing.readProperty("integerProperty")).value();
        assert.equal(int, 0);
        const str = await (await this.thing.readProperty("stringProperty")).value();
        assert.equal(str, "");
        const obj = await (await this.thing.readProperty("objectProperty")).value();
        assert.deepEqual(obj, { testNum: 0, testStr: "abc" });
    }

    @test.skip async "[client] property read / write for integer"() {
        await this.thing.writeProperty("integerProperty", 333);
        await wait(1000);
        const int = await this.thing.readProperty("integerProperty");
        assert.equal(int, 333);
    }

    @test.skip async "[client] property read / write for string"() {
        await this.thing.writeProperty("stringProperty", "test-string");
        await wait(1000);
        const str = await this.thing.readProperty("stringProperty");
        assert.equal(str, "test-string");
    }

    @test.skip async "[client] property read / write for object"() {
        await this.thing.writeProperty("objectProperty", {
            testKey1: "testString",
            testKey2: 123,
        });
        await wait(1000);
        const obj = await this.thing.readProperty("objectProperty");
        assert.deepEqual(obj, { testKey1: "testString", testKey2: 123 });
    }

    @test.skip async "[client] action without args and response"() {
        await this.thing.invokeAction("actionWithoutArgsResponse");
        assert.ok(true);
    }

    @test.skip async "[client] action about number"() {
        const num = await this.thing.invokeAction("actionNum", 123);
        assert.equal(num, 123);
    }

    @test.skip async "[client] action about string"() {
        const str = await this.thing.invokeAction("actionString", "string");
        assert.equal(str, "string");
    }

    @test.skip async "[client] action about object"() {
        const obj = await this.thing.invokeAction("actionObject", {
            testkey3: 111,
            testkey4: "abc",
        });
        assert.deepEqual(obj, { testkey3: 111, testkey4: "abc" });
    }

    @test.skip async "[client] action string to object"() {
        const obj = await this.thing.invokeAction("actionStringToObj", "teststr");
        assert.deepEqual(obj, { test: "teststr" });
    }

    @test.skip async "[client] action object to number"() {
        const num = await this.thing.invokeAction("actionObjToNum", {
            testkey5: 5,
            testkey6: "test6",
        });
        assert.equal(num, 1);
    }

    @test.skip async "[client] subscribe and unsubscribe event with integer"() {
        let subscribeFlg = true;
        let errorMes = null;
        this.thing.subscribeEvent("eventInteger", (event: number) => {
            if (subscribeFlg) {
                assert.equal(event, 200);
            } else {
                errorMes = "called but unsubscribed";
            }
        });
        await wait(500);
        await this.thing.invokeAction("actionEventInteger", 200);
        await wait(500);
        await this.thing.unsubscribeEvent("eventInteger");
        subscribeFlg = false;
        await this.thing.invokeAction("actionEventInteger", 18);
        await wait(500);
        assert.equal(errorMes, null);
    }

    @test.skip async "[client] subscribe and unsubscribe event with string"() {
        let subscribeFlg = true;
        let errorMes = null;
        this.thing.subscribeEvent("eventString", (event: string) => {
            if (subscribeFlg) {
                assert.equal(event, "string123");
            } else {
                errorMes = "called but unsubscribed";
            }
        });
        await wait(500);
        await this.thing.invokeAction("actionEventString", "string123");
        await wait(500);
        await this.thing.unsubscribeEvent("eventString");
        subscribeFlg = false;
        await this.thing.invokeAction("actionEventString", "string987");
        await wait(500);
        assert.equal(errorMes, null);
    }

    @test.skip async "[client] subscribe and unsubscribe event with object"() {
        let subscribeFlg = true;
        let errorMes = null;
        this.thing.subscribeEvent("eventObject", (event: unknown) => {
            if (subscribeFlg) {
                assert.deepEqual(event, { eventStr: "event1", eventNum: 123 });
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
        await this.thing.unsubscribeEvent("eventObject");
        subscribeFlg = false;
        await this.thing.invokeAction("actionEventObject", {
            eventStr: "event2",
            eventNum: 987,
        });
        await wait(500);
        assert.equal(errorMes, null);
    }

    @test.skip async "[client] observe and unobserve property"() {
        let observeFlg = true;
        let errorMes = null;
        this.thing.observeProperty("stringProperty", (str: string) => {
            if (observeFlg) {
                assert.equal(str, "test-string-888");
            } else {
                errorMes = "called but unobserved";
            }
        });
        await wait(500);
        await this.thing.writeProperty("stringProperty", "test-string-888");
        await wait(500);
        await this.thing.unobserveProperty("stringProperty");
        observeFlg = false;
        await this.thing.writeProperty("stringProperty", "test-string-889");
        await wait(500);
        assert.equal(errorMes, null);
    }

    @test.skip async "[server] property read / write for integer"() {
        await FirestoreClientBasicTest.serverThing.writeProperty("integerProperty", 256);
        await wait(500);
        const int = await FirestoreClientBasicTest.serverThing.readProperty("integerProperty");
        assert.equal(int, 256);
    }

    /*  @test async '[server] property read / write for string'() {
    await this.thing.writeProperty('stringProperty', 'test-string')
    await wait(1000)
    const str = await this.thing.readProperty('stringProperty')
    assert.equal(str, 'test-string')
  }

  @test async '[server] property read / write for object'() {
    await this.thing.writeProperty('objectProperty', {
      testKey1: 'testString',
      testKey2: 123
    })
    await wait(1000)
    const obj = await this.thing.readProperty('objectProperty')
    assert.deepEqual(obj, { testKey1: 'testString', testKey2: 123 })
  } */
}
