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
