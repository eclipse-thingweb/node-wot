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

import { suite, test } from "@testdeck/mocha";
import { expect, should } from "chai";

import { Subscription } from "rxjs/Subscription";

import Servient from "../src/servient";
import ConsumedThing from "../src/consumed-thing";
import { Form, SecurityScheme } from "@node-wot/td-tools";
import { ProtocolClient, ProtocolClientFactory, Content } from "../src/protocol-interfaces";
import { ContentSerdes } from "../src/content-serdes";
import Helpers from "../src/helpers";
import { Readable } from "stream";
import { ProtocolHelpers } from "../src/core";
import { ThingDescription } from "wot-typescript-definitions";
// should must be called to augment all variables
should();
class TDClient implements ProtocolClient {
    public readResource(form: Form): Promise<Content> {
        // Note: this is not a "real" DataClient! Instead it just reports the same TD in any case
        const c: Content = { type: ContentSerdes.TD, body: Readable.from(Buffer.from(JSON.stringify(myThingDesc))) };
        return Promise.resolve(c);
    }

    public writeResource(form: Form, content: Content): Promise<void> {
        return Promise.reject(new Error("writeResource not implemented"));
    }

    public invokeResource(form: Form, content: Content): Promise<Content> {
        return Promise.reject(new Error("invokeResource not implemented"));
    }

    public unlinkResource(form: Form): Promise<void> {
        return Promise.reject(new Error("unlinkResource not implemented"));
    }

    public subscribeResource(
        form: Form,
        next: (value: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ): Promise<Subscription> {
        return new Promise<Subscription>((resolve, reject) => {
            resolve(new Subscription());
        });
    }

    public async start(): Promise<void> {
        // do nothing
    }

    public async stop(): Promise<void> {
        // do nothing
    }

    public setSecurity = (metadata: SecurityScheme[]) => false;

    public toString(): string {
        return "TDClient";
    }
}

class TDClientFactory implements ProtocolClientFactory {
    public readonly scheme: string = "td";

    client = new TDClient();

    public getClient(): ProtocolClient {
        return this.client;
    }

    public init(): boolean {
        return true;
    }

    public destroy(): boolean {
        return true;
    }
}

class TrapClient implements ProtocolClient {
    private trap: (...args: unknown[]) => Content | Promise<Content>;

    public setTrap(callback: (...args: unknown[]) => Content | Promise<Content>) {
        this.trap = callback;
    }

    public async readResource(form: Form): Promise<Content> {
        return await this.trap(form);
    }

    public async writeResource(form: Form, content: Content): Promise<void> {
        await this.trap(form, content);
    }

    public async invokeResource(form: Form, content: Content): Promise<Content> {
        return await this.trap(form, content);
    }

    public async unlinkResource(form: Form): Promise<void> {
        await this.trap(form);
    }

    public subscribeResource(
        form: Form,
        next: (value: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ): Promise<Subscription> {
        return new Promise<Subscription>((resolve, reject) => {
            // send one event
            next(this.trap(form) as Content);
            // then complete
            setImmediate(() => {
                complete();
            });
            resolve(new Subscription());
        });
    }

    public async start(): Promise<void> {
        // do nothing
    }

    public async stop(): Promise<void> {
        // do nothing
    }

    public setSecurity = (metadata: SecurityScheme[]) => false;
}

class TrapClientFactory implements ProtocolClientFactory {
    public scheme = "testdata";
    client = new TrapClient();

    public setTrap(callback: (...args: unknown[]) => Content | Promise<Content>) {
        this.client.setTrap(callback);
    }

    public getClient(): ProtocolClient {
        return this.client;
    }

    public init(): boolean {
        return true;
    }

    public destroy(): boolean {
        return true;
    }
}

class TestProtocolClient implements ProtocolClient {
    readResource(form: Form): Promise<Content> {
        throw new Error("Method not implemented.");
    }

    writeResource(form: Form, content: Content): Promise<void> {
        throw new Error("Method not implemented.");
    }

    invokeResource(form: Form, content: Content): Promise<Content> {
        throw new Error("Method not implemented.");
    }

    unlinkResource(form: Form): Promise<void> {
        throw new Error("Method not implemented.");
    }

    subscribeResource(
        form: Form,
        next: (content: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ): Promise<Subscription> {
        throw new Error("Method not implemented.");
    }

    async start(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    async stop(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public securitySchemes: SecurityScheme[];
    setSecurity(securitySchemes: SecurityScheme[], credentials?: Record<string, unknown>): boolean {
        this.securitySchemes = securitySchemes;
        return true;
    }
}

const myThingDesc = {
    "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
    "@type": ["Thing"],
    id: "urn:dev:wot:test-thing",
    title: "aThing",
    security: [{ scheme: "nosec" }],
    properties: {
        aProperty: {
            type: "integer",
            readOnly: false,
            forms: [{ href: "testdata://host/athing/properties/aproperty", mediaType: "application/json" }],
        },
        aPropertyToObserve: {
            type: "integer",
            readOnly: false,
            observable: true,
            forms: [
                {
                    href: "testdata://host/athing/properties/apropertytoobserve",
                    mediaType: "application/json",
                    op: ["observeproperty", "unobserveproperty"],
                },
            ],
        },
    },
    actions: {
        anAction: {
            input: { type: "integer" },
            output: { type: "integer" },
            forms: [{ href: "testdata://host/athing/actions/anaction", mediaType: "application/json" }],
        },
    },
    events: {
        anEvent: {
            data: {
                type: "string",
            },
            forms: [
                {
                    href: "testdata://host/athing/events/anevent",
                    mediaType: "application/json",
                    op: ["subscribeevent", "unsubscribeevent"],
                },
            ],
        },
    },
};

@suite("client flow of servient")
class WoTClientTest {
    static servient: Servient;
    static clientFactory: TrapClientFactory;
    static WoT: typeof WoT;
    static WoTHelpers: Helpers;

    static before() {
        this.servient = new Servient();
        this.WoTHelpers = new Helpers(this.servient);
        this.clientFactory = new TrapClientFactory();
        this.servient.addClientFactory(this.clientFactory);
        this.servient.addClientFactory(new TDClientFactory());
        this.servient.start().then((myWoT) => {
            this.WoT = myWoT;
        });
        console.log("started test suite");
    }

    static async after(): Promise<void> {
        await this.servient.shutdown();
        console.log("finished test suite");
    }

    @test async "read a Property"() {
        // let the client return 42
        WoTClientTest.clientFactory.setTrap(() => {
            return { type: "application/json", body: Readable.from(Buffer.from("42")) };
        });
        const td = (await WoTClientTest.WoTHelpers.fetch("td://foo")) as ThingDescription;
        const thing = await WoTClientTest.WoT.consume(td);

        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing.getThingDescription()).to.have.property("properties");
        expect(thing.getThingDescription()).to.have.property("properties").to.have.property("aProperty");

        const result = await thing.readProperty("aProperty");
        // eslint-disable-next-line no-unused-expressions
        expect(result).not.to.be.null;

        const value = await result.value();
        expect(value.toString()).to.equal("42");
    }

    @test async "read all properties"() {
        // let the client return 42
        WoTClientTest.clientFactory.setTrap(() => {
            return { type: "application/json", body: Readable.from(Buffer.from("42")) };
        });

        const td = (await WoTClientTest.WoTHelpers.fetch("td://foo")) as ThingDescription;
        const thing = await WoTClientTest.WoT.consume(td);
        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing.getThingDescription()).to.have.property("properties");
        expect(thing.getThingDescription()).to.have.property("properties").to.have.property("aProperty");

        const result: WoT.PropertyReadMap = await thing.readAllProperties();
        // eslint-disable-next-line no-unused-expressions
        expect(result).not.to.be.null;
        // eslint-disable-next-line no-unused-expressions
        expect(result.get("aProperty")).not.to.be.null;
        // eslint-disable-next-line no-unused-expressions
        expect(result.get("aPropertyToObserve")).to.be.undefined;

        const io: WoT.InteractionOutput = result.get("aProperty");
        const value = await io.value();
        expect(value).to.equal(42);
    }

    @test async "write a Property with raw readable stream"() {
        // verify the value transmitted
        WoTClientTest.clientFactory.setTrap(async (form: Form, content: Content) => {
            const valueData = await ProtocolHelpers.readStreamFully(content.body);
            expect(valueData.toString()).to.equal("23");
            return content;
        });
        const td = (await WoTClientTest.WoTHelpers.fetch("td://foo")) as ThingDescription;
        const thing = await WoTClientTest.WoT.consume(td);

        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing).to.have.property("properties").that.has.property("aProperty");

        const stream = Readable.from(Buffer.from("23"));
        return thing.writeProperty("aProperty", ProtocolHelpers.toWoTStream(stream));
    }

    @test async "write a Property with data schema value"() {
        // verify the value transmitted
        WoTClientTest.clientFactory.setTrap(async (form: Form, content: Content) => {
            const valueData = await ProtocolHelpers.readStreamFully(content.body);
            expect(valueData.toString()).to.equal("58");
            return content;
        });
        const td = (await WoTClientTest.WoTHelpers.fetch("td://foo")) as ThingDescription;
        const thing = await WoTClientTest.WoT.consume(td);

        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing).to.have.property("properties").that.has.property("aProperty");

        return thing.writeProperty("aProperty", 58);
    }

    @test async "write multiple property new api"() {
        // verify the value transmitted
        WoTClientTest.clientFactory.setTrap(async (form: Form, content: Content) => {
            const valueData = await ProtocolHelpers.readStreamFully(content.body);
            expect(valueData.toString()).to.equal("66");
            return content;
        });

        const td = (await WoTClientTest.WoTHelpers.fetch("td://foo")) as ThingDescription;
        const thing = await WoTClientTest.WoT.consume(td);

        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing).to.have.property("properties").that.has.property("aProperty");

        const valueMap = new Map();
        const stream = Readable.from(Buffer.from("66"));

        valueMap.set("aProperty", ProtocolHelpers.toWoTStream(stream));
        return thing.writeMultipleProperties(valueMap);
    }

    @test async "call an action"() {
        // an action
        WoTClientTest.clientFactory.setTrap(async (form: Form, content: Content) => {
            const valueData = await ProtocolHelpers.readStreamFully(content.body);
            expect(valueData.toString()).to.equal("23");
            return { type: "application/json", body: Readable.from(Buffer.from("42")) };
        });
        const td = (await WoTClientTest.WoTHelpers.fetch("td://foo")) as ThingDescription;
        const thing = await WoTClientTest.WoT.consume(td);

        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing).to.have.property("actions").that.has.property("anAction");
        const result = await thing.invokeAction("anAction", 23);
        // eslint-disable-next-line no-unused-expressions
        expect(result).not.to.be.null;
        const value = await result.value();
        expect(value).to.equal(42);
    }

    @test async "subscribe to event"() {
        WoTClientTest.clientFactory.setTrap(() => {
            return { type: "application/json", body: Readable.from(Buffer.from("triggered")) };
        });
        const td = (await WoTClientTest.WoTHelpers.fetch("td://foo")) as ThingDescription;
        const thing = await WoTClientTest.WoT.consume(td);
        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing).to.have.property("events").that.has.property("anEvent");
        return new Promise((resolve) => {
            thing.subscribeEvent("anEvent", async (x) => {
                const value = await x.value();
                expect(value).to.equal("triggered");
                resolve(true);
            });
        });
    }

    @test async "should unsubscribe to event"() {
        WoTClientTest.clientFactory.setTrap(() => {
            return { type: "application/json", body: Readable.from(Buffer.from("triggered")) };
        });
        const td = (await WoTClientTest.WoTHelpers.fetch("td://foo")) as ThingDescription;
        const thing = await WoTClientTest.WoT.consume(td);
        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing).to.have.property("events").that.has.property("anEvent");
        return new Promise((resolve) => {
            thing.subscribeEvent("anEvent", async (x) => {
                const value = await x.value();
                expect(value).to.equal("triggered");
                resolve(true);
            });
        });
    }

    @test async "should not subscribe twice to event"() {
        WoTClientTest.clientFactory.setTrap(() => {
            return { type: "application/json", body: Readable.from(Buffer.from("triggered")) };
        });
        const td = (await WoTClientTest.WoTHelpers.fetch("td://foo")) as ThingDescription;
        const thing = await WoTClientTest.WoT.consume(td);
        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing).to.have.property("events").that.has.property("anEvent");

        await thing.subscribeEvent("anEvent", () => {
            /** */
        });
        await expect(
            thing.subscribeEvent("anEvent", () => {
                /** */
            })
        ).to.be.rejected;
    }

    @test async "should be able to subscribe again after unsubscribe to event"() {
        WoTClientTest.clientFactory.setTrap(() => {
            return { type: "application/json", body: Readable.from(Buffer.from("triggered")) };
        });
        const td = (await WoTClientTest.WoTHelpers.fetch("td://foo")) as ThingDescription;
        const thing = await WoTClientTest.WoT.consume(td);
        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing).to.have.property("events").that.has.property("anEvent");

        const subscription = await thing.subscribeEvent("anEvent", () => {
            /** */
        });
        await subscription.stop();

        return new Promise((resolve) => {
            thing.subscribeEvent("anEvent", async (x) => {
                const value = await x.value();
                expect(value).to.equal("triggered");
                resolve(true);
            });
        });
    }

    @test async "observe property"() {
        WoTClientTest.clientFactory.setTrap(() => {
            return { type: "application/json", body: Readable.from(Buffer.from("12")) };
        });
        const td = (await WoTClientTest.WoTHelpers.fetch("td://foo")) as ThingDescription;
        const thing = await WoTClientTest.WoT.consume(td);
        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing).to.have.property("properties").that.has.property("aPropertyToObserve");
        return new Promise((resolve) => {
            thing.observeProperty("aPropertyToObserve", async (data) => {
                const value = await data.value();
                expect(value).to.equal(12);
                resolve(true);
            });
        });
    }

    @test async "should not observe twice a property"() {
        WoTClientTest.clientFactory.setTrap(() => {
            return { type: "application/json", body: Readable.from(Buffer.from("triggered")) };
        });
        const td = (await WoTClientTest.WoTHelpers.fetch("td://foo")) as ThingDescription;
        const thing = await WoTClientTest.WoT.consume(td);
        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing).to.have.property("events").that.has.property("anEvent");

        await thing.observeProperty("aPropertyToObserve", () => {
            /** */
        });
        await expect(
            thing.observeProperty("aPropertyToObserve", () => {
                /** */
            })
        ).to.be.rejected;
    }

    @test "observe property should fail"(done: Mocha.Done) {
        WoTClientTest.WoTHelpers.fetch("td://foo")
            .then((td: ThingDescription) => {
                return WoTClientTest.WoT.consume(td);
            })
            .then((thing) => {
                expect(thing).to.have.property("title").that.equals("aThing");
                expect(thing).to.have.property("properties").that.has.property("aProperty");

                thing
                    .observeProperty("aProperty", () => {
                        done(new Error("property is not observable"));
                    })
                    .catch(() => {
                        done();
                    });
            })
            .catch((err) => {
                done(err);
            });
    }

    @test "ensure security thing level"(done: Mocha.Done) {
        try {
            const ct = new ConsumedThing(WoTClientTest.servient);
            ct.securityDefinitions = {
                basic_sc: {
                    scheme: "basic",
                },
            };
            ct.security = ["basic_sc"];
            const pc = new TestProtocolClient();
            const form: Form = {
                href: "https://example.com/",
            };
            ct.ensureClientSecurity(pc, form);
            expect(pc.securitySchemes.length).equals(1);
            expect(pc.securitySchemes[0].scheme).equals("basic");
            done();
        } catch (err) {
            done(err);
        }
    }

    @test "ensure security form level"(done: Mocha.Done) {
        try {
            const ct = new ConsumedThing(WoTClientTest.servient);
            ct.securityDefinitions = {
                basic_sc: {
                    scheme: "basic",
                },
                apikey_sc: {
                    scheme: "apikey",
                },
            };
            ct.security = ["basic_sc"];
            const pc = new TestProtocolClient();
            const form: Form = {
                href: "https://example.com/",
                security: ["apikey_sc"],
            };
            ct.ensureClientSecurity(pc, form);
            expect(pc.securitySchemes.length).equals(1);
            expect(pc.securitySchemes[0].scheme).equals("apikey");
            done();
        } catch (err) {
            done(err);
        }
    }
}
