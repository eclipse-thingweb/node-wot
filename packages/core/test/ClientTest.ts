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

import { Subscription } from "rxjs/Subscription";

import Servient from "../src/servient";
import { Form } from "@node-wot/td-tools";
import { ProtocolClient, ProtocolClientFactory, Content } from "../src/protocol-interfaces"
import { ContentSerdes } from "../src/content-serdes";
import Helpers from "../src/helpers";
import { Readable } from "stream";
import { ProtocolHelpers } from "../src/core";

class TDClient implements ProtocolClient {

    public readResource(form: Form): Promise<Content> {
        // Note: this is not a "real" DataClient! Instead it just reports the same TD in any case
        let c: Content = { type: ContentSerdes.TD, body: Readable.from(Buffer.from(JSON.stringify(myThingDesc))) };
        return Promise.resolve(c);
    }

    public writeResource(form: Form, content: Content): Promise<void> {
        return Promise.reject("writeResource not implemented");
    }

    public invokeResource(form: Form, content: Content): Promise<Content> {
        return Promise.reject("invokeResource not implemented");
    }

    public unlinkResource(form: Form): Promise<void> {
        return Promise.reject("unlinkResource not implemented");
    }

    public subscribeResource(form: Form, next: ((value: any) => void), error?: (error: any) => void, complete?: () => void): Subscription {
        return new Subscription();
    }

    public start(): boolean {
        return true;
    }

    public stop(): boolean {
        return true;
    }

    public setSecurity = (metadata: any) => false;

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

    private trap: Function;

    public setTrap(callback: Function) {
        this.trap = callback
    }

    public readResource(form: Form): Promise<Content> {
        return Promise.resolve(this.trap(form));
    }

    public writeResource(form: Form, content: Content): Promise<void> {
        return Promise.resolve(this.trap(form, content));
    }

    public invokeResource(form: Form, content: Content): Promise<Content> {
        return Promise.resolve(this.trap(form, content));
    }

    public unlinkResource(form: Form): Promise<void> {
        return Promise.resolve(this.trap(form));
    }
    public subscribeResource(form: Form, next: ((value: any) => void), error?: (error: any) => void, complete?: () => void): Subscription {
        // send one event
        next(this.trap(form));
        // then complete
        setImmediate(() => { complete(); });
        return new Subscription();
    }

    public start(): boolean {
        return true;
    }

    public stop(): boolean {
        return true;
    }

    public setSecurity = (metadata: any) => false;
}

class TrapClientFactory implements ProtocolClientFactory {

    public scheme: string = "testdata";
    client = new TrapClient();

    public setTrap(callback: Function) {
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

let myThingDesc = {
    "@context": ["https://w3c.github.io/wot/w3c-wot-td-context.jsonld"],
    "@type": ["Thing"],
    id: "urn:dev:wot:test-thing",
    title: "aThing",
    security: [{ scheme: "nosec" }],
    properties: {
        aProperty: {
            type: "integer",
            readOnly: false,
            forms: [
                { href: "testdata://host/athing/properties/aproperty", mediaType: "application/json" }
            ]
        },
        aPropertyToObserve: {
            type: "integer",
            readOnly: false,
            observable: true,
            forms: [
                { href: "testdata://host/athing/properties/apropertytoobserve", mediaType: "application/json", op: ["observeproperty"] }
            ]
        }
    },
    actions: {
        anAction: {
            input: { "type": "integer" },
            output: { "type": "integer" },
            forms: [
                { "href": "testdata://host/athing/actions/anaction", "mediaType": "application/json" }
            ]
        }
    },
    events: {
        anEvent: {
            data: {
                type:"string"
            },
            forms: [
                { "href": "testdata://host/athing/events/anevent", "mediaType": "application/json" }
            ]
        }
    }
}

@suite("client flow of servient")
class WoTClientTest {

    static servient: Servient;
    static clientFactory: TrapClientFactory;
    static WoT: typeof WoT;
    static WoTHelpers : Helpers;

    static before() {
        this.servient = new Servient();
        this.WoTHelpers = new Helpers(this.servient);
        this.clientFactory = new TrapClientFactory();
        this.servient.addClientFactory(this.clientFactory);
        this.servient.addClientFactory(new TDClientFactory());
        this.servient.start().then(myWoT => { this.WoT = myWoT; });
        console.log("started test suite");
    }

    static after() {
        this.servient.shutdown();
        console.log("finished test suite");
    }

    @test async "read a Property"() {
        // let the client return 42
        WoTClientTest.clientFactory.setTrap(
            () => {
                return { type: "application/json", body: Readable.from(Buffer.from("42")) };
            }
        );
        const td = await WoTClientTest.WoTHelpers.fetch("td://foo");
        const thing = await WoTClientTest.WoT.consume(td);

        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing.getThingDescription()).to.have.property("properties");
        expect(thing.getThingDescription()).to.have.property("properties").to.have.property("aProperty");

        const result = await thing.readProperty("aProperty");
        expect(result).not.to.be.null;

        const value = await result.value()
        expect(value.toString()).to.equal("42");
    }
    @test async "read all properties"() {
        // let the client return 42
        WoTClientTest.clientFactory.setTrap(
            () => {
                return { type: "application/json", body: Readable.from(Buffer.from("42")) };
            }
        );
        
        const td = await WoTClientTest.WoTHelpers.fetch("td://foo");
        const thing = await WoTClientTest.WoT.consume(td);
        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing.getThingDescription()).to.have.property("properties");
        expect(thing.getThingDescription()).to.have.property("properties").to.have.property("aProperty");

        const result:WoT.PropertyReadMap = await thing.readAllProperties();
        expect(result).not.to.be.null;
        expect(result.get("aProperty")).not.to.be.null;
        expect(result.get("aPropertyToObserve")).to.be.undefined;

        let io:WoT.InteractionOutput = result.get("aProperty");
        const value = await io.value();
        expect(value).to.equal(42)
    }

    @test async "write a Property"() {
        //verify the value transmitted
        WoTClientTest.clientFactory.setTrap(
            async (form: Form, content: Content) => {
                const buffer = await ProtocolHelpers.readStreamFully(content.body);
                expect(buffer.toString()).to.equal("23");
            }
        )
        const td = await WoTClientTest.WoTHelpers.fetch("td://foo");
        const thing = await WoTClientTest.WoT.consume(td);

        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing).to.have.property("properties").that.has.property("aProperty");
        return thing.writeProperty("aProperty",23);
    }

    @test async "write multiple property new api"() {
        //verify the value transmitted
        WoTClientTest.clientFactory.setTrap(
            async(form: Form, content: Content) => {
                const buffer = await ProtocolHelpers.readStreamFully(content.body);
                expect(buffer.toString()).to.equal("66");
            }
        )

        const td = await WoTClientTest.WoTHelpers.fetch("td://foo");
        const thing = await WoTClientTest.WoT.consume(td);

        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing).to.have.property("properties").that.has.property("aProperty");
        
        let valueMap: WoT.PropertyWriteMap = new Map<string, WoT.InteractionInput>();
        valueMap.set("aProperty", 66);
        return thing.writeMultipleProperties(valueMap);
    }

    @test async "call an action"() {
        //an action
        WoTClientTest.clientFactory.setTrap(
           async (form: Form, content: Content) => {
                const buffer = await ProtocolHelpers.readStreamFully(content.body);
                expect(buffer.toString()).to.equal("23");
                return { type: "application/json", body: Readable.from(Buffer.from("42")) };
            }
        )
        const td = await WoTClientTest.WoTHelpers.fetch("td://foo");
        const thing = await WoTClientTest.WoT.consume(td);
        
        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing).to.have.property("actions").that.has.property("anAction");
        const result = await thing.invokeAction("anAction",23);
        expect(result).not.to.be.null;
        const value = await result.value();
        expect(value).to.equal(42);
    }

    @test async "subscribe to property"() {
        
        WoTClientTest.clientFactory.setTrap(
            () => {
                return { type: "application/json", body: Readable.from(Buffer.from("triggered")) };
            }
        )
        const td = await WoTClientTest.WoTHelpers.fetch("td://foo");
        const thing = await WoTClientTest.WoT.consume(td);
        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing).to.have.property("events").that.has.property("anEvent");
        return new Promise((resolve) => {
            thing.subscribeEvent("anEvent", async x => {
                const value = await x.value();
                expect(value).to.equal("triggered");
                resolve(true)
            })
        })
    }


    @test async "observe property"() {
        
        WoTClientTest.clientFactory.setTrap(
            () => {
                return { type: "application/json", body: Readable.from(Buffer.from("12")) };
            }
        )
        const td = await WoTClientTest.WoTHelpers.fetch("td://foo");
        const thing = await WoTClientTest.WoT.consume(td);
        expect(thing).to.have.property("title").that.equals("aThing");
        expect(thing).to.have.property("properties").that.has.property("aPropertyToObserve");
        return new Promise( (resolve)=> {
            thing.observeProperty("aPropertyToObserve",
                async (data: any) => {
                    const value = await data.value();
                    expect(value).to.equal(12);
                    resolve(true);
                }
            );
        })
    }


    @test "observe property should fail"(done: Function) {

        WoTClientTest.WoTHelpers.fetch("td://foo")
            .then((td) => {
                return WoTClientTest.WoT.consume(td);
            })
            .then((thing) => {
                expect(thing).to.have.property("title").that.equals("aThing");
                expect(thing).to.have.property("properties").that.has.property("aProperty");

                thing.observeProperty("aProperty",
                    (data: any) => {
                        done(new Error("property is not observable"))
                    }
                )
                .catch(err => { done() });
            })
            .catch(err => { done(err) });
    }


}
