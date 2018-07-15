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
import { expect, should } from "chai";
// should must be called to augment all variables
should();

import Servient from "../src/servient";
import { ProtocolServer, ResourceListener } from "../src/resource-listeners/protocol-interfaces"

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
        expect(thing).to.have.property("name").that.equals("myThing");
    }

    @test "should be able to add a Thing given a TD"() {
        let desc = `{
            "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
            "@type": ["Thing"],
            "name": "myThingX",
            "properties": {
                "myPropX" : {
                }
            }
        }`;

        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce(desc);
        expect(thing).to.exist;
        expect(thing).to.have.property("name", "myThingX");
        expect(thing).to.have.property("properties");
        expect(thing.properties).to.have.property("myPropX");
    }

    @test async "should be able to add a property with default value 0"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthing100" });
        let initp: WoT.PropertyFragment = {
            writable: true,
            observable: false,
            value: 0,
            type: undefined // DataType.number
        };
        thing.addProperty("number", initp);
        let value1 = await thing.properties["number"].get();
        expect(value1).to.equal(0);
    }


    @test async "should be able to add a property with default value XYZ"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthing101" });
        let initp: WoT.PropertyFragment = {
            writable: true,
            type: undefined, // DataType.string, //  `{ "type": "string" }`,
            value: "XYZ"
        };
        thing.addProperty("string", initp);
        let value1 = await thing.properties["string"].get();
        expect(value1).to.equal("XYZ");
    }

    @test async "should be able to add a property without any default value"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthing102" });
        let initp: WoT.PropertyFragment = {
            writable: true,
            type: undefined // DataType.number //  `{ "type": "number" }`
        };
        thing.addProperty("number", initp);
        let value1 = await thing.properties["number"].get();
        expect(value1).to.equal(null);
    }

    @test async "should be able to add a property, read it and write it locally"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthing" });
        let initp: WoT.PropertyFragment = {
            writable: true,
            type: undefined, // DataType.number // `{ "type": "number" }`,
            value: 10
        };
        thing.addProperty("number", initp);
        let value0 = await thing.properties["number"].get();
        expect(value0).to.equal(10);
        await thing.properties["number"].set(5);
        let value1 = await thing.properties["number"].get();
        expect(value1).to.equal(5);
    }


    @test async "should be able to add a property, read it by setting read increment handler (with lambda)"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingIncRead" });
        let initp: WoT.PropertyFragment = {
            writable: true,
            type: undefined // DataType.number //  `{ "type": "number" }`
        };
        let counter: number = 0;
        thing.addProperty("number", initp).setPropertyReadHandler(
            "number",
            () => {
                return new Promise((resolve, reject) => {
                    resolve(++counter);
                });
            }
        );

        expect(await thing.properties["number"].get()).to.equal(1);
        expect(await thing.properties["number"].get()).to.equal(2);
        expect(await thing.properties["number"].get()).to.equal(3);
    }

    @test async "should be able to add a property, read it by setting read increment handler (with function)"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingIncRead2" });
        let initp: WoT.PropertyFragment = {
            writable: true,
            type: undefined // DataType.number //  `{ "type": "number" }`
        };
        let counter: number = 0;
        thing.addProperty("number", initp).setPropertyReadHandler(
            "number",
            function () {
                return new Promise((resolve, reject) => {
                    resolve(++counter);
                });
            }
        );

        expect(await thing.properties["number"].get()).to.equal(1);
        expect(await thing.properties["number"].get()).to.equal(2);
        expect(await thing.properties["number"].get()).to.equal(3);
    }


    @test async "should be able to add a property, read it by setting read increment handler (with local counter state)"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingIncRead3" });
        let initp: WoT.PropertyFragment = {
            writable: true,
            type: undefined // DataType.number `{ "type": "number" }`
        };
        thing.addProperty("number", initp).setPropertyReadHandler(
            "number",
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

        expect(await thing.properties["number"].get()).to.equal(1);
        expect(await thing.properties["number"].get()).to.equal(2);
        expect(await thing.properties["number"].get()).to.equal(3);
    }

    @test async "should be able to add a property, read it by setting write handler double"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingWrite" });
        let initp: WoT.PropertyFragment = {
            writable: true,
            type: undefined // DataType.number `{ "type": "number" }`
        };
        thing.addProperty("number", initp);
        let initp2: WoT.PropertyFragment = {
            writable: true,
            type: undefined // DataType.number `{ "type": "number" }`
        };
        thing.addProperty("number2", initp2);

        let v : number = null;

        thing.setPropertyReadHandler(
            "number",
            () => {
                return new Promise((resolve, reject) => {
                    resolve(v);
                });
            }
        );
        thing.setPropertyWriteHandler(
            "number",
            (value: any) => {
                return new Promise((resolve, reject) => {
                    // thing.properties["number"].set(value);
                    v = value;
                    thing.properties["number2"].set(value * 2);
                    resolve(value);
                });
            }
        );

        await thing.properties["number"].set(12);
        expect(await thing.properties["number"].get()).to.equal(12);
        expect(await thing.properties["number2"].get()).to.equal(24);

        await thing.properties["number"].set(13);
        expect(await thing.properties["number"].get()).to.equal(13);
        expect(await thing.properties["number2"].get()).to.equal(26);
    }

    @test async "should be able to add a property, read it by setting write handler with reading old value"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "otherthingReadWrite" });
        let initp: WoT.PropertyFragment = {
            writable: true,
            type: undefined, // DataType.number `{ "type": "number" }`,
            value: 2
        };
        thing.addProperty("number", initp);

        let ov = thing.properties["number"].get();

        thing.setPropertyReadHandler(
            "number",
            () => {
                return new Promise((resolve, reject) => {
                    resolve(ov);
                });
            }
        );

        // set handler that writes newValue as oldValue+request
        thing.setPropertyWriteHandler(
            "number",
            (value: any) => {
                return new Promise((resolve, reject) => {
                    thing.properties["number"].get().then(
                        (oldValue) => {
                            ov = oldValue + value;
                            resolve(ov);
                        }
                    );
                });
            }
        );

        // Note: writePropety uses side-effect (sets new value plus old value)
        // Defintely not a good idea to do so (for testing purposes only!)
        await thing.properties["number"].set(1);  // 2 + 1 = 3
        expect(await thing.properties["number"].get()).to.equal(3);

        await thing.properties["number"].set(2); // 3 + 2 = 5
        expect(await thing.properties["number"].get()).to.equal(5);
    }

    @test async "should be able to add a property, write and read it locally"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({ name: "thing3" });
        let initp: WoT.PropertyFragment = {
            writable: true,
            type: undefined, // DataType.number `{ "type": "number" }`,
            value: 10
        };
        thing.addProperty("prop1", initp);

        await thing.properties["prop1"].set(5);
        expect(await thing.properties["prop1"].get()).to.equal(5);
    }

    @test "should be able to add an action and invoke it locally"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({
            name: "thing6"
        });
        let inita: WoT.ActionFragment = {
            input: undefined, // {type: DataType.number}, // `{ "type": "number" }`,
            output: undefined // {type: DataType.number}, //JSON.stringify({ "type": "number" })
        };
        thing.addAction("action1", inita).setActionHandler(
            "action1",
            (parameters: any) => {
                return new Promise((resolve, reject) => {
                    parameters.should.be.a("number");
                    parameters.should.equal(23);
                    resolve(42);
                });
            }
        );

        return thing.actions["action1"].run(23).then((result) => result.should.equal(42));
    }

    @test "should be able to add an action and invoke it locally (based on WoT.ThingTemplate)"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce({
            name: "thing6c"
        });
        let inita: WoT.ActionFragment = {
            input: undefined, // {type: DataType.number}, // `{ "type": "number" }`,
            output: undefined // {type: DataType.number}, // `{ "type": "number" }`
        };

        thing.addAction("action1", inita).setActionHandler(
            "action1",
            (parameters: any) => {
                return new Promise((resolve, reject) => {
                    parameters.should.be.a("number");
                    parameters.should.equal(23);
                    resolve(42);
                });
            }
        );

        return thing.actions["action1"].run(23).then((result) => result.should.equal(42));
    }

    @test "should be able to add an action and invoke it locally (based on WoT.ThingDescription)"() {
        let thing: WoT.ExposedThing = WoTServerTest.WoT.produce(`{
            "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
            "@type": ["Thing"],
            "name": "thing6b",
            "actions": {
                "action1" : {
                    "input": { "type": "number" },
                    "output": { "type": "number" }
                }
            }
        }`);
        
        expect(thing).to.have.property("actions");
        expect(thing.actions).to.have.property("action1");

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

        return thing.actions["action1"].run(23).then((result) => result.should.equal(42));
    }
}
