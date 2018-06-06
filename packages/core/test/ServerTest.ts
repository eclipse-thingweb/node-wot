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
 * Basic test suite to demonstrate test setup
 * uncomment the @skip to see failing tests
 * 
 * h0ru5: there is currently some problem with VSC failing to recognize experimentalDecorators option, it is present in both tsconfigs
 */

import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import { assert, expect, should } from "chai";
// should must be called to augment all variables
should();

import Servient from "../src/servient";
import * as listeners from "../src/resource-listeners/all-resource-listeners";
import { ProtocolServer, Content, ResourceListener } from "../src/resource-listeners/protocol-interfaces"
import ExposedThing from "../src/exposed-thing";

// implement a testserver to mock a server
class TestProtocolServer implements ProtocolServer {

    public readonly scheme: string = "test";
    private listeners: Map<string, ResourceListener> = new Map();

    getListenerFor(path: string): ResourceListener {
        return this.listeners.get(path);
    }

    addResource(path: string, res: ResourceListener): boolean {
        if (this.listeners.has(path)) return false;
        this.listeners.set(path, res);
    }

    removeResource(path: string): boolean {
        return true;
    }

    start(): Promise<void> { return new Promise<void>((resolve, reject) => { resolve(); }); }
    stop(): Promise<void> { return new Promise<void>((resolve, reject) => { resolve(); }); }
    getPort(): number { return -1 }
}

@suite("the server side of servient")
class WoTServerTest {

    static servient: Servient;
    static WoT: WoT.WoTFactory;
    static server: TestProtocolServer;

    static before() {
        this.servient = new Servient();
        this.server = new TestProtocolServer();
        this.servient.addServer(this.server);
        this.servient.start().then(WoTruntime => { this.WoT = WoTruntime; });
        console.log("before starting test suite");
    }

    static after() {
        console.log("after finishing test suite");
        this.servient.shutdown();
    }

    @test "should be able to add a Thing given a template"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({
            name: "myThing"
        });
        expect(thing).to.exist;
        expect(JSON.parse(thing.getThingDescription()).name).equal("myThing");
        expect(thing).to.have.property("name", "myThing");
    }


    @test "should be able to add a Thing given a TD"() {
        let desc = `{
            "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
            "@type": ["Thing"],
            "name": "myThingX",
            "interaction": [
                {
                    "@type": ["Property"],
                    "name": "myPropX",
                    "schema": { "type": "number" }
                }
            ]
        }`;

        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce(desc);
        expect(thing).to.exist;
        expect(thing).to.have.property("name", "myThingX");
        expect(thing).to.have.property("interaction");
    }

    @test async "should be able to add a property with default value 0"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthing100" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`,
            value: 0
        };
        thing.addProperty(initp);
        let value1 = await thing.readProperty("number");
        expect(value1).to.equal(0);
    }


    @test async "should be able to add a property with default value XYZ"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthing101" });
        let initp: WoT.ThingProperty = {
            name: "string",
            writable: true,
            schema: `{ "type": "string" }`,
            value: "XYZ"
        };
        thing.addProperty(initp);
        let value1 = await thing.readProperty("string");
        expect(value1).to.equal("XYZ");
    }

    @test async "should be able to add a property without any default value"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthing102" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`
        };
        thing.addProperty(initp);
        let value1 = await thing.readProperty("number");
        expect(value1).to.equal(null);
    }

    @test async "should be able to add a property, read and write it locally"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthing" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`,
            value: 10
        };
        thing.addProperty(initp);
        let value0 = await thing.readProperty("number");
        expect(value0).to.equal(10);
        await thing.writeProperty("number", 5);
        let value1 = await thing.readProperty("number");
        expect(value1).to.equal(5);
    }


    @test async "should be able to set incrementing read handler (with lambda)"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingIncRead" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`
        };
        let counter: number = 0;
        thing.addProperty(initp).setPropertyReadHandler(
            initp.name,
            () => {
                return new Promise((resolve, reject) => {
                    resolve(++counter);
                });
            }
        );

        expect(await thing.readProperty("number")).to.equal(1);
        expect(await thing.readProperty("number")).to.equal(2);
        expect(await thing.readProperty("number")).to.equal(3);
    }

    @test async "should be able to set incrementing read handler (with function)"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingIncRead2" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`
        };
        let counter: number = 0;
        thing.addProperty(initp).setPropertyReadHandler(
            initp.name,
            function () {
                return new Promise((resolve, reject) => {
                    resolve(++counter);
                });
            }
        );

        expect(await thing.readProperty("number")).to.equal(1);
        expect(await thing.readProperty("number")).to.equal(2);
        expect(await thing.readProperty("number")).to.equal(3);
    }

    @test async "should be able to set incrementing read handler (with local counter state)"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingIncRead3" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`
        };
        thing.addProperty(initp).setPropertyReadHandler(
            initp.name,
            function () {
                return new Promise((resolve, reject) => {
                    // TODO: figure out a way to provide a common scope that can be used for consecutive handler calls
                    // let counter: number = 0; // fails to keep state!!
                    // var counter: number = 0; // fails to keep state also!!
                    // resolve(++counter);
                    if (!this.counter) {
                        // init counter the first time
                        this.counter = 0;
                    }
                    resolve(++this.counter);
                });
            }
        );

        expect(await thing.readProperty("number")).to.equal(1);
        expect(await thing.readProperty("number")).to.equal(2);
        expect(await thing.readProperty("number")).to.equal(3);
    }
    @test async "should be able to reject in read handler"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingReadReject" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`
        };
        thing.addProperty(initp).setPropertyReadHandler(
            initp.name,
            function () {
                return new Promise((resolve, reject) => {
                    reject(new Error("Reject read"));
                });
            }
        );

        try {
            await thing.readProperty("number");
            assert.fail("actual", "expected", "Resolved read");
        } catch (err) {
            expect(err.message).to.equal("Reject read");
        }
    }

    @test async "should be able to set modifying write handler (with pure function)"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingWrite" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`
        };
        thing.addProperty(initp);
        let initp2: WoT.ThingProperty = {
            name: "number2",
            writable: true,
            schema: `{ "type": "number" }`
        };
        thing.addProperty(initp2);
        thing.setPropertyWriteHandler(
            initp.name,
            (value: any) => {
                return new Promise((resolve, reject) => {
                    thing.writeProperty(initp2.name, value * 2);
                    resolve(value);
                });
            }
        );

        await thing.writeProperty("number", 12);
        expect(await thing.readProperty("number")).to.equal(12);
        expect(await thing.readProperty("number2")).to.equal(24);

        await thing.writeProperty("number", 13)
        expect(await thing.readProperty("number")).to.equal(13);
        expect(await thing.readProperty("number2")).to.equal(26);
    }

    @test async "should be able to set modifying write handler (with readProperty)"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingReadWrite" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`,
            value: 2
        };
        thing.addProperty(initp);
        // set handler that writes newValue as oldValue+request
        thing.setPropertyWriteHandler(
            initp.name,
            (value: any) => {
                return new Promise(async (resolve, reject) => {
                    let oldValue = await thing.readProperty(initp.name);
                    resolve(oldValue + value);
                });
            }
        );

        // Note: writePropety uses side-effect (sets new value plus old value)
        // Defintely not a good idea to do so (for testing purposes only!)
        await thing.writeProperty("number", 1);  // 2 + 1 = 3
        expect(await thing.readProperty("number")).to.equal(3);

        await thing.writeProperty("number", 2); // 3 + 2 = 5
        expect(await thing.readProperty("number")).to.equal(5);
    }

    @test async "should be able to reject in write handler"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingWriteReject" });
        let initp: WoT.ThingProperty = {
            name: "number",
            writable: true,
            schema: `{ "type": "number" }`
        };
        thing.addProperty(initp);
        thing.setPropertyWriteHandler(
            initp.name,
            (value: any) => {
                return new Promise((resolve, reject) => {
                    reject(new Error("Reject write"));
                });
            }
        );

        try {
            await thing.writeProperty("number", 12);
            assert.fail("actual", "expected", "Resolved write");
        } catch (err) {
            expect(err.message).to.equal("Reject write");
        }
    }

    @test "should be able to add an action and invoke it locally (based on WoT.ThingTemplate)"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({
            name: "thing6a"
        });

        let inita: WoT.ThingAction = {
            name: "action1",
            inputSchema: `{ "type": "number" }`,
            outputSchema: `{ "type": "number" }`
        };

        thing.addAction(inita).setActionHandler(
            inita.name,
            (parameters: any) => {
                return new Promise((resolve, reject) => {
                    parameters.should.be.a("number");
                    parameters.should.equal(23);
                    resolve(42);
                });
            }
        );

        return thing.invokeAction("action1", 23).then((result) => result.should.equal(42));
    }

    @test "should be able to add an action and invoke it locally (based on WoT.ThingDescription)"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce(`{
            "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
            "@type": ["Thing"],
            "name": "thing6b",
            "interaction": [
                {
                    "@type": ["Action"],
                    "name": "action1",
                    "inputSchema": { "type": "number" },
                    "outputSchema": { "type": "number" }
                }
            ]
        }`);

        expect(thing).to.have.property("interaction").that.has.lengthOf(1);

        thing.setActionHandler(
            "action1",
            (parameters: any) => {
                return new Promise((resolve, reject) => {
                    parameters.should.be.a("number");
                    parameters.should.equal(23);
                    resolve(42);
                });
            }
        );

        return thing.invokeAction("action1", 23).then((result) => result.should.equal(42));
    }

    @test async "should be able to reject in action handler"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingInvokeReject" });
        
        let inita: WoT.ThingAction = {
            name: "action1",
            inputSchema: `{ "type": "number" }`,
            outputSchema: `{ "type": "number" }`
        };

        thing.addAction(inita).setActionHandler(
            inita.name,
            (parameters: any) => {
                return new Promise((resolve, reject) => {
                    reject(new Error("Reject invoke"));
                });
            }
        );

        try {
            await thing.invokeAction("action1", 12);
            assert.fail("actual", "expected", "Resolved invoke");
        } catch (err) {
            expect(err.message).to.equal("Reject invoke");
        }
    }
}
