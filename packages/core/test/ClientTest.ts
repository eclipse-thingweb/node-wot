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

import { Subscription } from "rxjs/Subscription";

import Servient from "../src/servient";
import { Form } from "@node-wot/td-tools";
import { ProtocolClient, ProtocolClientFactory, Content } from "../src/protocol-interfaces"
import { ContentSerdes } from "../src/content-serdes";

class TDClient implements ProtocolClient {

    public readResource(form: Form): Promise<Content> {
        // Note: this is not a "real" DataClient! Instead it just reports the same TD in any case
        let c: Content = { type: ContentSerdes.TD, body: Buffer.from(JSON.stringify(myThingDesc)) };
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
    name: "aThing",
    security: [{ scheme: "nosec" }],
    properties: {
        aProperty: {
            type: "integer",
            readOnly: false,
            forms: [
                { href: "testdata://host/athing/properties/aproperty", mediaType: "application/json" }
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
            type: "number",
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
    static WoT: WoT.WoTFactory;

    static before() {
        this.servient = new Servient();
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

    @test "read a Property"(done: Function) {
        // let the client return 42
        WoTClientTest.clientFactory.setTrap(
            () => {
                return { contentType: "application/json", body: Buffer.from("42") };
            }
        );

        WoTClientTest.WoT.fetch("td://foo")
            .then((td) => {
                let thing = WoTClientTest.WoT.consume(td);
                expect(thing).to.have.property("name").that.equals("aThing");
                expect(thing.properties).to.have.property("aProperty");

                return thing.properties.aProperty.read();
            })
            .then((value) => {
                expect(value).not.to.be.null;
                expect(value.toString()).to.equal("42");
                done();
            })
            .catch(err => { done(err); });
    }

    @test "read a Property new api"(done: Function) {
        // let the client return 42
        WoTClientTest.clientFactory.setTrap(
            () => {
                return { contentType: "application/json", body: Buffer.from("42") };
            }
        );

        WoTClientTest.WoT.fetch("td://foo")
            .then((td) => {
                let thing = WoTClientTest.WoT.consume(td);
                expect(thing).to.have.property("name").that.equals("aThing");
                expect(thing.properties).to.have.property("aProperty");
                return thing.readProperty("aProperty");
            })
            .then((value) => {
                expect(value).not.to.be.null;
                expect(value.toString()).to.equal("42");
                done();
            })
            .catch(err => { done(err); });
    }

    @test "read all properties"(done: Function) {
        // let the client return 42
        WoTClientTest.clientFactory.setTrap(
            () => {
                return { contentType: "application/json", body: Buffer.from("42") };
            }
        );

        WoTClientTest.WoT.fetch("td://foo")
            .then((td) => {
                let thing = WoTClientTest.WoT.consume(td);
                expect(thing).to.have.property("name").that.equals("aThing");
                expect(thing.properties).to.have.property("aProperty");
                return thing.readAllProperties();
            })
            .then((value) => {
                expect(value).not.to.be.null;
                expect(value).to.have.property("aProperty").that.equals(42);
                done();
            })
            .catch(err => { done(err); });
    }

    @test "write a Property"(done: Function) {
        //verify the value transmitted
        WoTClientTest.clientFactory.setTrap(
            (form: Form, content: Content) => {
                expect(content.body.toString()).to.equal("23");
            }
        )

        WoTClientTest.WoT.fetch("td://foo")
            .then((td) => {
                let thing = WoTClientTest.WoT.consume(td);
                expect(thing).to.have.property("name").that.equals("aThing");
                expect(thing).to.have.property("properties").that.has.property("aProperty");
                return thing.properties["aProperty"].write(23);
            })
            .then(() => done())
            .catch(err => { done(err) });
    }

    @test "write a Property new api"(done: Function) {
        //verify the value transmitted
        WoTClientTest.clientFactory.setTrap(
            (form: Form, content: Content) => {
                expect(content.body.toString()).to.equal("23");
            }
        )

        WoTClientTest.WoT.fetch("td://foo")
            .then((td) => {
                let thing = WoTClientTest.WoT.consume(td);
                expect(thing).to.have.property("name").that.equals("aThing");
                expect(thing).to.have.property("properties").that.has.property("aProperty");
                return thing.writeProperty("aProperty", 23);
            })
            .then(() => done())
            .catch(err => { done(err) });
    }

    @test "write multiple property new api"(done: Function) {
        //verify the value transmitted
        WoTClientTest.clientFactory.setTrap(
            (form: Form, content: Content) => {
                expect(content.body.toString()).to.equal("66");
            }
        )

        WoTClientTest.WoT.fetch("td://foo")
            .then((td) => {
                let thing = WoTClientTest.WoT.consume(td);
                expect(thing).to.have.property("name").that.equals("aThing");
                expect(thing).to.have.property("properties").that.has.property("aProperty");

                let valueMap: { [key: string]: any } = {};
                valueMap["aProperty"] = 66;
                return thing.writeMultipleProperties(valueMap);
            })
            .then(() => done())
            .catch(err => { done(err) });
    }

    // @test "observe a Property"(done: Function) {
    //     // let the client return 42
    //     WoTClientTest.clientFactory.setTrap(
    //         () => {
    //             return { contentType: "application/json", body: Buffer.from("42") };
    //         }
    //     );

    //     WoTClientTest.WoT.fetch("data://" + "tdFoo")
    //         .then((td) => {
    //             let thing = WoTClientTest.WoT.consume(td);
    //             expect(thing).not.to.be.null;
    //             expect(this.getThingName(thing)).to.equal("aThing");
    //             expect(thing.onPropertyChange("aProperty")).not.to.be.null;

    //             let subscription = thing.onPropertyChange("aProperty").subscribe(
    //                 x => {
    //                     console.log('onNext: %s', x);
    //                     if (x == 123) {
    //                         done();
    //                     }
    //                 },
    //                 e => console.log('onError: %s', e),
    //                 () => {
    //                     console.log('onCompleted aProperty changed');
    //                     // done();
    //                 }
    //             );

    //             // write one other value
    //             thing.writeProperty("aProperty", 12356666);

    //             setTimeout(() => {
    //                 // update value to trigger success
    //                 return thing.writeProperty("aProperty", 123);
    //             }, 25);
    //         })
    //         .then((value) => {
    //             expect(value).not.to.be.null;
    //             // done(); 
    //         })
    //         .catch(err => { throw err });
    // }

    @test "call an action"(done: Function) {
        //an action
        WoTClientTest.clientFactory.setTrap(
            (form: Form, content: Content) => {
                expect(content.body.toString()).to.equal("23");
                return { contentType: "application/json", body: Buffer.from("42") };
            }
        )

        WoTClientTest.WoT.fetch("td://foo")
            .then((td) => {
                let thing = WoTClientTest.WoT.consume(td);
                expect(thing).to.have.property("name").that.equals("aThing");
                expect(thing).to.have.property("actions").that.has.property("anAction");
                return thing.actions.anAction.invoke(23);
            })
            .then((result) => {
                expect(result).not.to.be.null;
                expect(result).to.equal(42);
                done();
            })
            .catch(err => { done(err) });
    }

    @test "call an action (next API)"(done: Function) {
        //an action
        WoTClientTest.clientFactory.setTrap(
            (form: Form, content: Content) => {
                expect(content.body.toString()).to.equal("23");
                return { contentType: "application/json", body: Buffer.from("42") };
            }
        )

        WoTClientTest.WoT.fetch("td://foo")
            .then((td) => {
                let thing = WoTClientTest.WoT.consume(td);
                expect(thing).to.have.property("name").that.equals("aThing");
                expect(thing).to.have.property("actions").that.has.property("anAction");
                return thing.invokeAction("anAction", 23);
            })
            .then((result) => {
                expect(result).not.to.be.null;
                expect(result).to.equal(42);
                done();
            })
            .catch(err => { done(err) });
    }

    @test "subscribe to event"(done: Function) {
        
        WoTClientTest.clientFactory.setTrap(
            () => {
                return { contentType: "application/json", body: Buffer.from("triggered") };
            }
        )

        WoTClientTest.WoT.fetch("td://foo")
            .then((td) => {
                let thing = WoTClientTest.WoT.consume(td);
                expect(thing).to.have.property("name").that.equals("aThing");
                expect(thing).to.have.property("events").that.has.property("anEvent");
                thing.events.anEvent.subscribe(
                    (x: any) => {
                        expect(x).to.equal("triggered");
                    },
                    (e: any) => {
                        done(e);
                    },
                    () => {
                        done();
                    }
                );
            })
            .catch(err => { done(err) });
    }
}
