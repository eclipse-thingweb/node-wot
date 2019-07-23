/********************************************************************************
 * Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
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

    @test "should be able to add a Thing based on WoT.ThingFragment"() {
        WoTServerTest.WoT.produce({
            title: "myFragmentThing",
            support: "none",
            "test:custom": "test",
            properties: {
                myProp: { }
            }
        })
        .then((thing) => {
            expect(thing).to.exist;
            // round-trip
            expect(JSON.parse(thing.getThingDescription()).title).to.equal("myFragmentThing");
            expect(JSON.parse(thing.getThingDescription()).support).to.equal("none");
            expect(JSON.parse(thing.getThingDescription())["test:custom"]).to.equal("test");
            // direct access
            expect(thing).to.have.property("title").that.equals("myFragmentThing");
            expect(thing).to.have.property("support").that.equals("none");
            expect(thing).to.have.property("test:custom").that.equals("test");
            expect(thing).to.have.property("properties");
            expect(thing.properties).to.have.property("myProp");
        });
    }

    @test "should be able to add a Thing based on WoT.ThingDescription"() {
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
        WoTServerTest.WoT.produce(desc)
            .then((thing) => {
                expect(thing).to.exist;
                // round-trip
                expect(JSON.parse(thing.getThingDescription()).title).to.equal("myDescriptionThing");
                expect(JSON.parse(thing.getThingDescription()).support).to.equal("none");
                expect(JSON.parse(thing.getThingDescription())["test:custom"]).to.equal("test");
                // direct access
                expect(thing).to.have.property("title").that.equals("myDescriptionThing");
                expect(thing).to.have.property("support").that.equals("none");
                expect(thing).to.have.property("test:custom").that.equals("test");
                expect(thing).to.have.property("properties");
                expect(thing.properties).to.have.property("myProp");
            });
    }

    @test async "should be able to add a property with default value 0"() {
        WoTServerTest.WoT.produce({ title: "ThingWith1" })
            .then((thing) => {
                let initp: WoT.PropertyFragment = {
                    type: "number"
                };
                thing.addProperty("number", initp, 1);
        
                expect(thing.properties).to.have.property("number");
                expect(thing.properties.number).to.have.property("readOnly").that.equals(false);
                expect(thing.properties.number).to.have.property("observable").that.equals(false);
        
                let value1 = thing.properties.number.read();
                expect(value1).to.equal(1);
            });
    }


    @test async "should be able to add a property with default value XYZ"() {
        WoTServerTest.WoT.produce({ title: "ThingWithXYZ" })
            .then((thing) => {
                let initp: WoT.PropertyFragment = {
                    type: "string"
                };
                thing.addProperty("string", initp, "XYZ");
                
                expect(thing.properties).to.have.property("string");
                expect(thing.properties.string).to.have.property("readOnly").that.equals(false);
                expect(thing.properties.string).to.have.property("observable").that.equals(false);
        
                let value1 = thing.properties.string.read();
                expect(value1).to.equal("XYZ");
            });
    }

    @test async "should be able to add a property without any default value"() {
        WoTServerTest.WoT.produce({ title: "ThingWithNothing" })
            .then((thing) => {
                let initp: WoT.PropertyFragment = {
                    type: "number"
                };
                thing.addProperty("null", initp);
                
                expect(thing.properties).to.have.property("null");
                expect(thing.properties.null).to.have.property("readOnly").that.equals(false);
                expect(thing.properties.null).to.have.property("observable").that.equals(false);
        
                let value1 = thing.properties.null.read();
                expect(value1).to.equal(null);
            });
    }

    @test async "should be able to read and write Property locally"() {
        WoTServerTest.WoT.produce({ title: "thing3" })
            .then((thing) => {
                let initp: WoT.PropertyFragment = {
                    type: "number"
                };
                thing.addProperty("number", initp, 10);
        
                let value0 = thing.properties.number.read();
                expect(value0).to.equal(10);
        
                thing.properties.number.write(5);
                let value1 = thing.properties.number.read();
                expect(value1).to.equal(5);
            });
    }

    
    @test async "should be able to read/readAll properties locally"() {
        WoTServerTest.WoT.produce({ title: "thing3" })
            .then((thing) => {
                let initNumber: WoT.PropertyFragment = {
                    type: "number"
                };
                thing.addProperty("number", initNumber, 10);
        
                let initString: WoT.PropertyFragment = {
                    type: "string"
                };
                thing.addProperty("string", initString, "xyz");
        
        
                let value0 = thing.properties.number.read();
                expect(value0).to.equal(10);
                value0 = thing.readProperty("number");
                expect(value0).to.equal(10);
        
        
                thing.properties.number.write(5);
                let value1 = thing.properties.number.read();
                expect(value1).to.equal(5);
                value1 = thing.readProperty("number");
                expect(value1).to.equal(5);
        
                // read all
                let valueAll = thing.readAllProperties();
                expect(valueAll).to.have.property("number").that.equals(5);
                expect(valueAll).to.have.property("string").that.equals("xyz");
        
                // read subset
                let valueSome = thing.readMultipleProperties(["string"]);
                expect(valueSome).to.have.property("string").that.equals("xyz");
            });
    }

    @test async "should be able to read Property with read handler (incrementing with lambda)"() {
        WoTServerTest.WoT.produce({ title: "otherthingIncRead" })
            .then((thing) => {
                let initp: WoT.PropertyFragment = {
                    type: "number"
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
        
                expect(thing.properties.number.read()).to.equal(1);
                expect(thing.properties.number.read()).to.equal(2);
                expect(thing.properties.number.read()).to.equal(3); 
            });
    }

    @test async "should be able to read Property with read handler (incrementing with lambda) new API"() {
        WoTServerTest.WoT.produce({ title: "otherthingIncRead" })
            .then((thing) => {
                let initp: WoT.PropertyFragment = {
                    type: "number"
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
        
                expect(thing.readProperty("number")).to.equal(1);
                expect(thing.readProperty("number")).to.equal(2);
                expect(thing.readProperty("number")).to.equal(3);
            });
    }

    @test async "should be able to read and write property / new API"() {
        WoTServerTest.WoT.produce({ title: "otherthingIncRead" })
            .then((thing) => {
                let initp: WoT.PropertyFragment = {
                    type: "number"
                };
                thing.addProperty("number", initp);
        
                thing.writeProperty("number", 1)
                expect(thing.readProperty("number")).to.equal(1);
                expect(thing.readProperty("number")).to.equal(1);
        
                thing.writeProperty("number", 3)
                expect(thing.readProperty("number")).to.equal(3);
            });
    }

    @test async "should be able to read Property with read handler (incrementing with function)"() {
        WoTServerTest.WoT.produce({ title: "otherthingIncRead2" })
            .then((thing) => {
                let initp: WoT.PropertyFragment = {
                    type: "number"
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
        
                expect(thing.properties.number.read()).to.equal(1);
                expect(thing.properties.number.read()).to.equal(2);
                expect(thing.properties.number.read()).to.equal(3);
            });
    }

    @test async "should be able to read Property with read handler (incrementing with handler scope state)"() {
        WoTServerTest.WoT.produce({ title: "otherthingIncRead3" })
            .then((thing) => {
                let initp: WoT.PropertyFragment = {
                    type: "number"
                };
                thing.addProperty("number", initp).setPropertyReadHandler(
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
        
                expect(thing.properties.number.read()).to.equal(1);
                expect(thing.properties.number.read()).to.equal(2);
                expect(thing.properties.number.read()).to.equal(3);
            });
    }

    @test async "should be able to write Property with write handler (summing)"() {
        WoTServerTest.WoT.produce({ title: "otherthingReadWrite" })
            .then((thing) => {
                let initp: WoT.PropertyFragment = {
                    type: "number"
                };
                thing.addProperty("number", initp, 2);
        
                let ov = thing.properties.number.read();
        
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
                            thing.properties.number.read().then(
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
                thing.properties.number.write(1);  // 2 + 1 = 3
                expect(thing.properties.number.read()).to.equal(3);
        
                thing.properties.number.write(2); // 3 + 2 = 5
                expect(thing.properties.number.read()).to.equal(5);
            });
    }

    @test async "should be able to write Property from any write handler (doubling)"() {
        WoTServerTest.WoT.produce({ title: "otherthingWrite" })
            .then((thing) => {
                let initp: WoT.PropertyFragment = {
                    type: "number"
                };
                thing.addProperty("number", initp);
                let initp2: WoT.PropertyFragment = {
                    type: "number"
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
                            v = value;
                            thing.properties.number2.write(value * 2);
                            resolve(value);
                        });
                    }
                );
        
                thing.properties.number.write(12);
                expect(thing.properties.number.read()).to.equal(12);
                expect(thing.properties.number2.read()).to.equal(24);
        
                thing.properties.number.write(13);
                expect(thing.properties.number.read()).to.equal(13);
                expect(thing.properties.number2.read()).to.equal(26);
            });
    }

    @test "should be able to add an action and invoke it locally (based on addAction())"() {
        WoTServerTest.WoT.produce({
            title: "thing6"
        })
            .then((thing) => {
                let inita: WoT.ActionFragment = {
                    input: { type: "number" },
                    output: { type: "number" }
                };
                thing.addAction(
                    "action1",
                    inita,
                    (parameters: any) => {
                        return new Promise((resolve, reject) => {
                            parameters.should.be.a("number");
                            parameters.should.equal(23);
                            resolve(42);
                        });
                    }
                );

                expect(thing).to.have.property("actions");
                expect(thing.actions).to.have.property("action1");

                return thing.actions.action1.invoke(23)
                    .then((result) => result.should.equal(42));
            });
    }

    @test "should be able to add an action and invoke it locally (based on WoT.ThingFragment)"() {
        WoTServerTest.WoT.produce({
            title: "thing6c",
            actions: {
                action1: {
                    input: { type: "number" },
                    output: { type: "number" }
                }
            }
        })
            .then((thing) => {
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
        
                return thing.actions.action1.invoke(23)
                    .then((result) => result.should.equal(42));
            });
    }

    @test "should be able to add an action and invoke it locally (based on WoT.ThingDescription)"() {
        WoTServerTest.WoT.produce(`{
            "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
            "@type": ["Thing"],
            "title": "thing6b",
            "actions": {
                "action1" : {
                    "input": { "type": "number" },
                    "output": { "type": "number" }
                }
            }
        }`)
            .then((thing) => {
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
        
                return thing.actions.action1.invoke(23)
                    .then((result) => result.should.equal(42));
            });
    }
    
    @test "should be able to add an action and invoke it locally (based on WoT.ThingDescription) next API"() {
        WoTServerTest.WoT.produce(`{
            "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
            "@type": ["Thing"],
            "name": "thing6b",
            "actions": {
                "action1" : {
                    "input": { "type": "number" },
                    "output": { "type": "number" }
                }
            }
        }`)
            .then((thing) => {
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
        
                return thing.invokeAction("action1", 23)
                    .then((result) => result.should.equal(42));
            });
    }

    @test "should not add (or modify) @language if present "() {
        // see issue https://github.com/eclipse/thingweb.node-wot/issues/111
        WoTServerTest.WoT.produce(`{
            "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld", {"iot": "http://example.org/iot"}, {"@language" : "xx"}],
            "@type": ["Thing"],
            "title": "thing6b"
        }`)
            .then((thing) => {
                expect(thing).to.have.property("@context").that.has.length(3);
                expect(thing["@context"][0]).to.equal("https://w3c.github.io/wot/w3c-wot-td-context.jsonld");
                expect(thing["@context"][1]).to.have.property("iot").that.equals("http://example.org/iot"); 
                expect(thing["@context"][2]).to.have.property("@language").that.equals("xx"); 
            });
    }

    // TODO add Event and subscribe locally (based on addEvent)
    // TODO add Event and subscribe locally (based on WoT.ThingFragment)
    // TODO add Event and subscribe locally (based on WoT.ThingDescription)
}
