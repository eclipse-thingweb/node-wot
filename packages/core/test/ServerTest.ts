/********************************************************************************
 * Copyright (c) 2018 - 2020 Contributors to the Eclipse Foundation
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
import { fail } from "assert";
// should must be called to augment all variables
should();

import * as TD from "@node-wot/td-tools";

import Servient from "../src/servient";
import { ProtocolServer } from "../src/protocol-interfaces"
import ExposedThing from "../src/exposed-thing";

// implement a testserver to mock a server
class TestProtocolServer implements ProtocolServer {

    public readonly scheme: string = "test";
    
    expose(thing: ExposedThing): Promise<void> {
        return new Promise<void>((resolve, reject) => {});
    }

    start(): Promise<void> { return new Promise<void>((resolve, reject) => { resolve(); }); }
    stop(): Promise<void> { return new Promise<void>((resolve, reject) => { resolve(); }); }
    getPort(): number { return -1 }
}

@suite("the server side of servient")
class WoTServerTest {

    static servient: Servient;
    static WoT: WoT.WoT;
    static server: TestProtocolServer;

    static before() {
        this.servient = new Servient();
        this.server = new TestProtocolServer();
        this.servient.addServer(this.server);
        this.servient.start().then(WoTruntime => { this.WoT = WoTruntime; });
        console.log("started test suite");
    }

    static after() {
        this.servient.shutdown();
        console.log("finished test suite");
    }

    @test async "should be able to add a Thing based on WoT.ThingFragment"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "myFragmentThing",
            support: "none",
            "test:custom": "test",
            properties: {
                myProp: { }
            }
        });

        expect(thing).to.exist;
        // round-trip
        expect(thing.getThingDescription()).to.have.property("title").that.equals("myFragmentThing");
        expect(thing.getThingDescription()).to.have.property("support").that.equals("none");
        expect(thing.getThingDescription()).to.have.property("test:custom").that.equals("test");
        // direct access
        expect(thing).to.have.property("title").that.equals("myFragmentThing");
        expect(thing).to.have.property("support").that.equals("none");
        expect(thing).to.have.property("test:custom").that.equals("test");
        expect(thing).to.have.property("properties");
        expect(thing).to.have.property("properties").to.have.property("myProp");
    }

    @test async "should be able to add a Thing based on WoT.ThingDescription"() {
        let desc = `{
            "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
            "@type": ["Thing"],
            "title": "myDescriptionThing",
            "support": "none",
            "test:custom": "test",
            "properties": {
                "myProp" : {
                }
            }
        }`;
        let thing = await WoTServerTest.WoT.produce(JSON.parse(desc));
        expect(thing).to.exist;
        // round-trip
        expect(thing.getThingDescription()).to.have.property("title").to.equal("myDescriptionThing");
        expect(thing.getThingDescription()).to.have.property("support").to.equal("none");
        expect(thing.getThingDescription()).to.have.property("test:custom").that.equals("test");
        // direct access
        expect(thing).to.have.property("title").that.equals("myDescriptionThing");
        expect(thing).to.have.property("support").that.equals("none");
        expect(thing).to.have.property("test:custom").that.equals("test");
        expect(thing).to.have.property("properties");
        expect(thing).to.have.property("properties").to.have.property("myProp");
    }

    @test async "should be able to add a property with value 1"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "ThingWith1",
            properties: {
                number: {
                    type: "number"
                }
            }
        });
        await thing.writeProperty("number", 1); // init

        expect(thing).to.have.property("properties").to.have.property("number");
        expect(thing).to.have.property("properties").to.have.property("number").to.have.property("readOnly").that.equals(false);
        expect(thing).to.have.property("properties").to.have.property("number").to.have.property("observable").that.equals(false);

        let value1 = await thing.readProperty("number");
        expect(value1).to.equal(1);

        let readUnknownPossible = false;
        try {
            await thing.readProperty("numberUnknwon")
            readUnknownPossible = true;
        } catch(e) {
            // as expected
        }
        if (readUnknownPossible) {
            fail("unknown property should throw error");
        }
    }

    @test async "should not be able to read property with writeOnly"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "ThingWithWriteOnly",
            properties: {
                numberWriteOnly: {
                    type: "number",
                    writeOnly: true
                }
            }
        });
        await thing.writeProperty("numberWriteOnly", 1);

        let readingPossible = false;
        try {
            await thing.readProperty("numberWriteOnly");
            readingPossible = true;
        } catch (e) {
            // as expected
        }
        if (readingPossible) {
            fail("reading property 'numberWriteOnly' should throw error")
        }
    }

    @test async "should not be able to write property with readOnly"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "ThingWithReadOnly",
            properties: {
                numberReadOnly: {
                    type: "number",
                    readOnly: true
                }
            }
        });
        thing.setPropertyReadHandler("numberReadOnly", () => {
            return new Promise((resolve, reject) => {
                resolve(213);
            });
        })
        let val = await thing.readProperty("numberReadOnly");
        expect(val === 213);
        
        let readingPossible = false;
        try {
            await thing.writeProperty("numberReadOnly", 1);
            readingPossible = true;
        } catch (e) {
            // as expected
        }
        if (readingPossible) {
            fail("writing property 'numberReadOnly' should throw error")
        }
    }

    @test async "should be able to add a thing with spaces in title and property "() {
        let thing = await WoTServerTest.WoT.produce({
            title: "The Machine",
            properties: {
                "my number": {
                    type: "number"
                }
            }
        });
        await thing.writeProperty("my number", 1);

        expect(thing).to.have.property("properties").to.have.property("my number");
        expect(thing).to.have.property("properties").to.have.property("my number").to.have.property("readOnly").that.equals(false);
        expect(thing).to.have.property("properties").to.have.property("my number").to.have.property("observable").that.equals(false);

        let value1 = await thing.readProperty("my number");
        expect(value1).to.equal(1);
    }


    @test async "should be able to add a property with default value XYZ"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "ThingWithXYZ",
            properties: {
                string: {
                    type: "string"
                }
            }
        });
        await thing.writeProperty("string", "XYZ"); // init
        
        expect(thing).to.have.property("properties").to.have.property("string");
        expect(thing).to.have.property("properties").to.have.property("string").to.have.property("readOnly").that.equals(false);
        expect(thing).to.have.property("properties").to.have.property("string").to.have.property("observable").that.equals(false);

        let expectUnknownProperty = false;
        try {
            expect(thing).to.have.property("properties").to.have.property("number");
            expectUnknownProperty = true;
            
        } catch(e) {
            // no property "number"
        }
        if (expectUnknownProperty) {
            fail("no property number");
        }

        let value1 = await thing.readProperty("string");
        expect(value1).to.equal("XYZ");
    }

    @test async "should be able to add a property without any default value"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "ThingWithNothing",
            properties: {
                null: {
                    type: "number"
                }
            }
        });
        
        expect(thing).to.have.property("properties").to.have.property("null");
        expect(thing).to.have.property("properties").to.have.property("null").to.have.property("readOnly").that.equals(false);
        expect(thing).to.have.property("properties").to.have.property("null").to.have.property("observable").that.equals(false);

        let value1 = await thing.readProperty("null");
        expect(value1).to.equal(null);
    }

    @test async "should be able to read and write Property locally"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "thing3",
            properties: {
                number: {
                    type: "number"
                }
            }
        });
        await thing.writeProperty("number", 10); // init

        let value0 = await thing.readProperty("number");
        expect(value0).to.equal(10);

        await thing.writeProperty("number", 5);
        let value1 = await thing.readProperty("number");
        expect(value1).to.equal(5);

    }

    
    @test async "should be able to read/readAll properties locally"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "thing3",
            properties: {
                number: {
                    type: "number"
                },
                string: {
                    type: "string"
                }
            }
        });
        await thing.writeProperty("number", 10); // init
        await thing.writeProperty("string", "xyz"); // init

        let value0 = await thing.readProperty("number");
        expect(value0).to.equal(10);
        value0 = await thing.readProperty("number");
        expect(value0).to.equal(10);

        await thing.writeProperty("number", 5);
        let value1 = await thing.readProperty("number");
        expect(value1).to.equal(5);
        value1 = await thing.readProperty("number");
        expect(value1).to.equal(5);

        // read all
        let valueAll = await thing.readAllProperties();
        expect(valueAll).to.have.property("number").that.equals(5);
        expect(valueAll).to.have.property("string").that.equals("xyz");

        // read subset
        let valueSome = await thing.readMultipleProperties(["string"]);
        expect(valueSome).to.have.property("string").that.equals("xyz");
    }

    @test async "should be able to read Property with read handler (incrementing with lambda)"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "otherthingIncRead",
            properties: {
                number: {
                    type: "number"
                }
            }
        });
        let initp: TD.ThingProperty = {
            type: "number"
        };
        let counter: number = 0;
        await thing.setPropertyReadHandler("number", () => {
                return new Promise((resolve, reject) => {
                    resolve(++counter);
                });
            }
        );

        expect(await thing.readProperty("number")).to.equal(1);
        expect(await thing.readProperty("number")).to.equal(2);
        expect(await thing.readProperty("number")).to.equal(3); 
    }

    @test async "should be able to read and write property"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "otherthingIncRead",
            properties: {
                number: {
                    type: "number"
                }
            }
        });

        await thing.writeProperty("number", 1)
        expect(await thing.readProperty("number")).to.equal(1);
        expect(await thing.readProperty("number")).to.equal(1);

        await thing.writeProperty("number", 3)
        expect(await thing.readProperty("number")).to.equal(3);
    }

    @test async "should be able to read Property with read handler (incrementing with function)"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "otherthingIncRead2",
            properties: {
                number: {
                    type: "number"
                }
            }
        });

        let counter: number = 0;
        await thing.setPropertyReadHandler(
            "number",
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

    @test async "should be able to read Property with read handler (incrementing with handler scope state)"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "otherthingIncRead3",
            properties: {
                number: {
                    type: "number"
                }
            }
        });

        await thing.setPropertyReadHandler(
            "number",
            function () {
                return new Promise((resolve, reject) => {
                    if (!this.counter) {
                        // init counter the first time
                        this.counter = 0;
                        console.log("local counter state initialized with 0");
                    } else {
                        expect(typeof this.counter).equals("number");
                        expect(this.counter).greaterThan(0);
                    }
                    resolve(++this.counter);
                });
            }
        );

        expect(await thing.readProperty("number")).to.equal(1);
        expect(await thing.readProperty("number")).to.equal(2);
        expect(await thing.readProperty("number")).to.equal(3);
    }

    @test async "should be able to write Property with write handler (summing)"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "otherthingReadWrite",
            properties: {
                number: {
                    type: "number"
                }
            }
        });
        await thing.writeProperty("number", 2); // init

        let ov = await thing.readProperty("number");

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
                    thing.readProperty("number").then(
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
        await thing.writeProperty("number", 1);  // 2 + 1 = 3
        expect(await thing.readProperty("number")).to.equal(3);

        await thing.writeProperty("number", 2); // 3 + 2 = 5
        expect(await thing.readProperty("number")).to.equal(5);

    }

    @test async "should be able to write Property from any write handler (doubling)"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "otherthingWrite",
            properties: {
                number: {
                    type: "number"
                },
                number2: {
                    type: "number"
                }
            }
        });

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
                    v = value;
                    thing.writeProperty("number2", value * 2);
                    resolve(value);
                });
            }
        );

        await thing.writeProperty("number", 12);
        expect(await thing.readProperty("number")).to.equal(12);
        expect(await thing.readProperty("number2")).to.equal(24);

        await thing.writeProperty("number", 13);
        expect(await thing.readProperty("number")).to.equal(13);
        expect(await thing.readProperty("number2")).to.equal(26);
    }

    @test async "should be able to add an action and invoke it locally"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "thing6",
            actions: {
                action1: {
                    input: { type: "number" },
                    output: { type: "number" }
                }
            }
        });

        await thing.setActionHandler("action1", (parameters: any) => {
            return new Promise((resolve, reject) => {
                parameters.should.be.a("number");
                parameters.should.equal(23);
                resolve(42);
            });
        });

        expect(thing).to.have.property("actions");
        expect(thing).to.have.property("actions").to.have.property("action1");

        expect(await thing.invokeAction("action1", 23)).to.equal(42);
    }

    @test async "should be able to add an action and invoke it locally (based on WoT.ThingFragment)"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "thing6c",
            actions: {
                action1: {
                    input: { type: "number" },
                    output: { type: "number" }
                }
            }
        });

        expect(thing).to.have.property("actions");
        expect(thing).to.have.property("actions").to.have.property("action1");

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

        expect(await thing.invokeAction("action1", 23)).to.equal(42);
    }

    @test async "should be able to add an action and invoke it locally (based on WoT.ThingDescription)"() {
        let thing = await WoTServerTest.WoT.produce(JSON.parse(`{
            "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
            "@type": ["Thing"],
            "title": "thing6b",
            "actions": {
                "action1" : {
                    "input": { "type": "number" },
                    "output": { "type": "number" }
                }
            }
        }`));

        expect(thing).to.have.property("actions");
        expect(thing).to.have.property("actions").to.have.property("action1");

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

        expect(await thing.invokeAction("action1", 23)).to.equal(42);
    }

    @test async "should not add (or modify) @language if present "() {
        // see issue https://github.com/eclipse/thingweb.node-wot/issues/111
        let thing = await WoTServerTest.WoT.produce(JSON.parse(`{
            "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld", {"iot": "http://example.org/iot"}, {"@language" : "xx"}],
            "@type": ["Thing"],
            "title": "thing6b"
        }`));

        expect(thing).to.have.property("@context").that.has.length(3);
        expect(thing).to.have.property("@context").that.does.include("https://w3c.github.io/wot/w3c-wot-td-context.jsonld");
        expect(thing).to.have.property("@context").to.deep.include({iot: "http://example.org/iot"});
        expect(thing).to.have.property("@context").to.deep.include({"@language": "xx"});
    }

    @test async "should reject reading property without uriVariables when they are mandatory"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "UriVariablesThing",
            properties: {
                uriProp: {
                    type: 'number',
                    uriVariables: {
                        id: {
                            type: 'string', 
                            enum: ['water', 'milk', 'chocolate', 'coffeeBeans']
                        }
                    }
                }
            }
        });

        thing.setPropertyReadHandler('uriProp', (options) => {
            return new Promise((resolve, reject) => {
                // Check if uriVariables are provided
                if (options && typeof options === 'object' && 'uriVariables' in options) {
                    const uriVariables: any = options['uriVariables'];
                    if ('id' in uriVariables) {
                        return resolve(100);
                    }
                }
                return reject('Please specify id variable as uriVariables.');
            });
        });

        let readingPossible = false;
        try {
            await thing.readProperty("uriProp");
            readingPossible = true;
        } catch (e) {
            // as expected
        }

        if (readingPossible) {
            fail("reading property 'uriProp' without uriVariables should throw error")
        }
    }

    // TODO add Event and subscribe locally (based on addEvent)
    // TODO add Event and subscribe locally (based on WoT.ThingFragment)
    // TODO add Event and subscribe locally (based on WoT.ThingDescription)
}
