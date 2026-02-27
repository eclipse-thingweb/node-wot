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

import { suite, test } from "@testdeck/mocha";
import { expect, should, use as chaiUse, spy } from "chai";
import spies from "chai-spies";
import Servient from "../src/servient";
import { Content } from "../src/content";
import { ProtocolServer } from "../src/protocol-interfaces";
import ExposedThing from "../src/exposed-thing";
import { Readable } from "stream";
import { InteractionInput, InteractionOptions, InteractionOutput } from "wot-typescript-definitions";
import chaiAsPromised from "chai-as-promised";
import { createLoggers, WoT as NodeWoTRuntime } from "../src/core";

const { debug } = createLoggers("core", "ServerTest");

chaiUse(chaiAsPromised);
// should must be called to augment all variables
should();
chaiUse(spies);

// implement a testserver to mock a server
class TestProtocolServer implements ProtocolServer {
    public readonly scheme: string = "test";

    async expose(thing: ExposedThing): Promise<void> {}

    async destroy(thingId: string): Promise<boolean> {
        return true;
    }

    async start(): Promise<void> {}

    async stop(): Promise<void> {}

    getPort(): number {
        return -1;
    }
}

@suite("the server side of servient")
class WoTServerTest {
    static servient: Servient;
    static WoT: typeof WoT;
    static server: TestProtocolServer;

    static before() {
        this.servient = new Servient();
        this.server = new TestProtocolServer();
        this.servient.addServer(this.server);
        this.servient.start().then((WoTruntime) => {
            this.WoT = WoTruntime;
        });
        debug("started test suite");
    }

    static async after(): Promise<void> {
        await this.servient.shutdown();
        debug("finished test suite");
    }

    @test async "should be able to add a Thing based on WoT.ThingFragment"() {
        const thing = await WoTServerTest.WoT.produce({
            title: "myFragmentThing",
            support: "none",
            "test:custom": "test",
            properties: {
                myProp: {},
            },
        });

        expect(thing).to.exist;
        // round-trip
        expect(thing.getThingDescription()).to.have.property("title").that.equals("myFragmentThing");
        expect(thing.getThingDescription()).to.have.property("support").that.equals("none");
        expect(thing.getThingDescription()).to.have.property("test:custom").that.equals("test");
        // should not share internals
        expect(thing.getThingDescription()).to.not.have.property("#propertyHandlers");
        expect(thing.getThingDescription()).to.not.have.property("#actionHandlers");
        expect(thing.getThingDescription()).to.not.have.property("#eventHandlers");
        expect(thing.getThingDescription()).to.not.have.property("#propertyListeners");
        expect(thing.getThingDescription()).to.not.have.property("#eventListeners");
        // direct access
        expect(thing).to.have.property("title").that.equals("myFragmentThing");
        expect(thing).to.have.property("support").that.equals("none");
        expect(thing).to.have.property("test:custom").that.equals("test");
        expect(thing).to.have.property("properties");
        expect(thing).to.have.property("properties").to.have.property("myProp");
    }

    // TODO: Review server side tests since ExposedThing does not implement ConsumedThing anymore
    /*
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

    @test async "should be able to destroy a Thing based on a thingId"() {
        let desc = `{
            "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
            "@type": ["Thing"],
            "title": "myDestroyThing",
            "id": "1234567",
            "properties": {
                "myProp" : {
                }
            }
        }`;
        let thing = await WoTServerTest.WoT.produce(JSON.parse(desc));
        expect(thing).to.exist;
        // test TD
        expect(thing.getThingDescription()).to.have.property("title").to.equal("myDestroyThing");
        expect(thing.getThingDescription()).to.have.property("id").to.equal("1234567");
        // test presence (and destroy)
        expect(WoTServerTest.servient.getThing("1234567")).to.not.be.null;
        await thing.destroy(); // destroy -> remove
        expect(WoTServerTest.servient.getThing("1234567")).to.be.null;
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
        let number: WoT.DataSchemaValue = 1; // init
        thing.setPropertyWriteHandler("number", async (io: WoT.InteractionOutput) => {
            number = await io.value();
        });
        thing.setPropertyReadHandler("number", () => {
            return new Promise((resolve, reject) => {
                resolve(number);
            });
        });

        expect(thing).to.have.property("properties").to.have.property("number");
        expect(thing).to.have.property("properties").to.have.property("number").to.have.property("readOnly").that.equals(false);
        expect(thing).to.have.property("properties").to.have.property("number").to.have.property("observable").that.equals(false);

        let readUnknownPossible = false;
        try {
            thing.setPropertyReadHandler("numberUnknown", () => {
                return new Promise((resolve, reject) => {
                    resolve(number);
                });
            });
            readUnknownPossible = true;
        } catch(e) {
            // as expected
        }
        if (readUnknownPossible) {
            fail("unknown property should throw error");
        }
    }

    // skipped so far, see https://github.com/eclipse-thingweb/node-wot/issues/333#issuecomment-724583234
    /* @test.skip async "should not be able to read property with writeOnly"() {
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
    } */

    // skipped so far, see https://github.com/eclipse-thingweb/node-wot/issues/333#issuecomment-724583234
    /* @test.skip async "should not be able to write property with readOnly"() {
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
        let val = await (await thing.readProperty("numberReadOnly")).value();
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
    } */

    @test async "should be able to add a thing with spaces in title and property "() {
        const thing = await WoTServerTest.WoT.produce({
            title: "The Machine",
            properties: {
                "my number": {
                    type: "number",
                },
            },
        });
        const number: WoT.DataSchemaValue = 1; // init

        const readHandler = async () => {
            return number;
        };

        thing.setPropertyReadHandler("my number", readHandler);

        expect(thing).to.have.property("properties").to.have.property("my number");

        // Check internals, how to to check handlers properly with *some* type-safety
        const ff = await readHandler?.();
        expect(ff).to.equal(1);
    }

    // see https://github.com/eclipse-thingweb/node-wot/issues/426
    /* @test async "should remove tmModel type"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "The Machine",
            "@type" : "tm:ThingModel",
            properties: {
                "number": {
                    type: "number"
                }
            }
        });
        expect(thing).to.not.have.property("@type");
    } */

    // see https://github.com/eclipse-thingweb/node-wot/issues/426
    /* @test async "should not remove any other type than tmModel"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "The Sensor",
            "@type": "saref:TemperatureSensor",
            properties: {
                "number": {
                    type: "number"
                }
            }
        });
        expect(thing).to.have.property("@type").that.equals("saref:TemperatureSensor");
    } */

    // see https://github.com/eclipse-thingweb/node-wot/issues/426
    /* @test async "should not remove any other type than tmModel in array"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "The Sensor",
            "@type": ["saref:TemperatureSensor", "tm:ThingModel"],
            properties: {
                "number": {
                    type: "number"
                }
            }
        });
        expect(thing).to.have.property("@type").that.contains("saref:TemperatureSensor");
        expect(thing).to.have.property("@type").that.not.contains("tm:ThingModel");
    } */

    // TODO: Review server side tests since ExposedThing does not implement ConsumedThing anymore
    // TBD: Are the following tests still useful/sensible?
    /*
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
                        debug("local counter state initialized with 0");
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
        // see issue https://github.com/eclipse-thingweb/node-wot/issues/111
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

    @test async "should reject if property read handler fails"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "Thing",
            properties: {
                uriProp: {
                    type: 'number'
                }
            }
        });

        thing.setPropertyReadHandler('uriProp', (options) => {
            return new Promise((resolve, reject) => {
                // Note: test reject
                return reject('Fail expected');
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
            fail("reading property 'uriProp' should throw error")
        }
    }

    @test async "should reject if property write handler fails"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "Thing",
            properties: {
                uriProp: {
                    type: 'number'
                }
            }
        });

        thing.setPropertyWriteHandler('uriProp', (options) => {
            return new Promise((resolve, reject) => {
                // Note: test reject
                return reject('Fail expected');
            });
        });

        let writingPossible = false;
        try {
            await thing.writeProperty("uriProp", 123);
            writingPossible = true;
        } catch (e) {
            // as expected
        }

        if (writingPossible) {
            fail("writing property 'uriProp' should throw error")
        }
    }

    @test async "should reject if action handler fails"() {
        let thing = await WoTServerTest.WoT.produce({
            title: "Thing",
            actions: {
                toggle: {}
            }
        });

        thing.setActionHandler('toggle', (options) => {
            return new Promise((resolve, reject) => {
                // Note: test reject
                return reject('Fail expected');
            });
        });

        let actionPossible = false;
        try {
            await thing.invokeAction("toggle");
            actionPossible = true;
        } catch (e) {
            // as expected
        }

        if (actionPossible) {
            fail("invoking action 'toggle' should throw error")
        }
    }
    */
    // TODO add Event and subscribe locally (based on addEvent)
    // TODO add Event and subscribe locally (based on WoT.ThingFragment)
    // TODO add Event and subscribe locally (based on WoT.ThingDescription)
    @test async "should call read handler"() {
        const thing = await WoTServerTest.WoT.produce({
            title: "The Machine",
            properties: {
                test: {
                    type: "string",
                    forms: [
                        {
                            href: "http://example.org/test",
                            op: ["readproperty"],
                        },
                    ],
                },
            },
        });
        const callback = spy(async () => {
            return true;
        });
        thing.setPropertyReadHandler("test", callback);

        await (<ExposedThing>thing).handleReadProperty("test", { formIndex: 0 });

        callback.should.have.been.called();
    }

    @test async "should call write handler"() {
        const thing = await WoTServerTest.WoT.produce({
            title: "The Machine",
            properties: {
                test: {
                    type: "string",
                    forms: [
                        {
                            href: "http://example.org/test",
                            op: ["readproperty", "writeproperty"],
                        },
                    ],
                },
            },
        });
        const callback = spy(async () => {
            /** */
        });
        thing.setPropertyWriteHandler("test", callback);

        await (<ExposedThing>thing).handleWriteProperty("test", new Content("", Readable.from(Buffer.alloc(0))), {
            formIndex: 0,
        });

        callback.should.have.been.called();
    }

    @test async "should call read handler and emit an event"() {
        const thing = await WoTServerTest.WoT.produce({
            title: "The Machine",
            properties: {
                test: {
                    type: "string",
                    forms: [
                        {
                            href: "http://example.org/test",
                            op: ["readproperty", "observeproperty"],
                        },
                    ],
                },
            },
        });

        const callback = spy(async (options?: InteractionOptions): Promise<InteractionInput> => {
            return "newValue";
        });

        const protocolListener = spy(async (content: Content) => {
            expect(content.type).not.to.be.undefined;
            expect(content.body).not.to.be.undefined;

            const body = await content.toBuffer();
            body.should.be.eq('"test"');
        });

        thing.setPropertyReadHandler("test", callback);

        (thing as ExposedThing).handleObserveProperty("test", protocolListener, { formIndex: 0 });

        await (<ExposedThing>thing).emitPropertyChange("test");

        callback.should.have.been.called();
        protocolListener.should.have.been.called();
    }

    @test async "should be able to subscribe to an event"() {
        const thing = await WoTServerTest.WoT.produce({
            title: "The Machine",
            events: {
                test: {
                    forms: [
                        {
                            href: "http://example.org/test",
                            op: ["subscribeevent"],
                        },
                    ],
                },
            },
        });
        const callback = spy();
        await (<ExposedThing>thing).handleSubscribeEvent("test", callback, { formIndex: 0 });
        (<ExposedThing>thing).emitEvent("test", null);

        callback.should.have.been.called();
    }

    @test async "should call subscribe handler"() {
        const thing = await WoTServerTest.WoT.produce({
            title: "The Machine",
            events: {
                test: {
                    forms: [
                        {
                            href: "http://example.org/test",
                            op: ["subscribeevent"],
                        },
                    ],
                },
            },
        });
        const callback = spy(async () => {
            /**  */
        });
        thing.setEventSubscribeHandler("test", callback);
        await (<ExposedThing>thing).handleSubscribeEvent("test", callback, { formIndex: 0 });

        callback.should.have.been.called();
    }

    @test async "should be able to unsubscribe to an event"() {
        const thing = await WoTServerTest.WoT.produce({
            title: "The Machine",
            events: {
                test: {
                    forms: [
                        {
                            href: "http://example.org/test",
                            op: ["subscribeevent"],
                        },
                    ],
                },
            },
        });
        const callback = spy(async () => {
            /**  */
        });
        const handler = spy(async () => {
            /**  */
        });
        thing.setEventSubscribeHandler("test", handler);
        await (<ExposedThing>thing).handleSubscribeEvent("test", callback, { formIndex: 0 });
        (<ExposedThing>thing).emitEvent("test", null);
        (<ExposedThing>thing).handleUnsubscribeEvent("test", callback, { formIndex: 0 });
        (<ExposedThing>thing).emitEvent("test", null);

        return expect(callback).to.have.been.called.once;
    }

    @test async "should call action handler"() {
        const thing = await WoTServerTest.WoT.produce({
            title: "The Machine",
            actions: {
                test: {
                    type: "string",
                    input: {
                        type: "string",
                    },
                    forms: [
                        {
                            href: "http://example.org/test",
                            op: ["invokeaction"],
                        },
                    ],
                },
            },
        });
        const callback = spy(async (params: InteractionOutput) => {
            expect(await params.value()).to.be.equal("ping");
            return "";
        });

        thing.setActionHandler("test", callback);

        await (<ExposedThing>thing).handleInvokeAction(
            "test",
            new Content("application/json", Readable.from(Buffer.from("ping"))),
            { formIndex: 0 }
        );

        callback.should.have.been.called();
    }

    @test async "should return content when returning 0 for action handler"() {
        const thing = await WoTServerTest.WoT.produce({
            title: "The Machine",
            actions: {
                test: {
                    output: {
                        type: "number",
                    },
                    forms: [
                        {
                            href: "http://example.org/test",
                            op: ["invokeaction"],
                        },
                    ],
                },
            },
        });
        const callback = spy(async (params: InteractionOutput) => {
            return 0;
        });

        thing.setActionHandler("test", callback);

        const result = await (<ExposedThing>thing).handleInvokeAction(
            "test",
            new Content("application/json", Readable.from(Buffer.from(""))),
            { formIndex: 0 }
        );

        callback.should.have.been.called();
        expect(result).to.be.instanceOf(Content);
    }

    @test async "should fail due to wrong uriVariable"() {
        const thing = await WoTServerTest.WoT.produce({
            title: "The Machine",
            properties: {
                test: {
                    type: "string",
                    uriVariables: {
                        testRight: {
                            type: "string",
                        },
                    },
                    forms: [
                        {
                            href: "http://example.org/test",
                            op: ["readproperty"],
                        },
                    ],
                },
            },
        });
        const callback = spy(async () => {
            return true;
        });
        thing.setPropertyReadHandler("test", callback);

        expect(
            (<ExposedThing>thing).handleReadProperty("test", { formIndex: 0, uriVariables: { testWrong: "test" } })
        ).to.eventually.be.rejectedWith(Error);
    }

    @test async "should inject Servient-level dataSchemaMapping on produce"() {
        const customServient = new Servient();
        customServient.dataSchemaMapping = {
            "nw:property": { "nw:valuePath": "/servientWrapper" },
        };
        const customWoT = (await customServient.start()) as NodeWoTRuntime;

        const thing = (await customWoT.produce({
            title: "The Machine",
            properties: {
                test: {
                    type: "string",
                },
            },
        })) as ExposedThing;

        expect(thing["nw:dataSchemaMapping"]?.["nw:property"]?.["nw:valuePath"]).to.equal("/servientWrapper");
    }

    @test async "should not overwrite Thing-level dataSchemaMapping with Servient-level on produce"() {
        const customServient = new Servient();
        customServient.dataSchemaMapping = {
            "nw:property": { "nw:valuePath": "/servientWrapper" },
            "nw:action": { "nw:valuePath": "/servientActionWrapper" },
        };
        const customWoT = (await customServient.start()) as NodeWoTRuntime;

        const thing = (await customWoT.produce({
            title: "The Machine",
            properties: {
                test: {
                    type: "string",
                },
            },
            "nw:dataSchemaMapping": {
                "nw:property": { "nw:valuePath": "/thingWrapper" },
            },
        })) as ExposedThing;

        const mapping = thing["nw:dataSchemaMapping"] ?? {};
        expect(mapping["nw:property"]?.["nw:valuePath"]).to.equal("/thingWrapper"); // overriding
        expect(mapping["nw:action"]?.["nw:valuePath"]).to.equal("/servientActionWrapper"); // inherited
    }
}
