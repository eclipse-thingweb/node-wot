import { ProtocolHelpers, ExposedThing } from "@node-wot/core";
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
 * Protocol test suite to test protocol implementations
 */

import { suite, test } from "@testdeck/mocha";
import { expect, should } from "chai";
import { DataSchemaValue, InteractionInput } from "wot-typescript-definitions";
import * as TD from "@node-wot/td-tools";
import CoapServer from "../src/coap-server";
import { CoapClient } from "../src/coap";
import { Readable } from "stream";
import { request } from "coap";

// should must be called to augment all variables
should();

const PORT = 31831;
@suite("CoAP server implementation")
class CoapServerTest {
    @test async "should start and stop a server"() {
        const coapServer = new CoapServer(PORT);

        await coapServer.start(null);
        expect(coapServer.getPort()).to.eq(PORT); // from test

        await coapServer.stop();
        expect(coapServer.getPort()).to.eq(-1); // from getPort() when not listening
    }

    @test async "should read property"() {
        const coapServer = new CoapServer(PORT);

        await coapServer.start(null);

        const testThing = new ExposedThing(null, {
            title: "Test",
            properties: {
                test: {
                    type: "string",
                },
            },
        });

        const test: DataSchemaValue = "testValue";
        testThing.setPropertyReadHandler("test", (_) => Promise.resolve(test));
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.test.forms = [];

        await coapServer.expose(testThing);

        const uri = `coap://localhost:${coapServer.getPort()}/test/`;

        const coapClient = new CoapClient(coapServer);
        const resp = await coapClient.readResource(new TD.Form(uri + "properties/test"));
        expect((await ProtocolHelpers.readStreamFully(resp.body)).toString()).to.equal('"testValue"');

        await coapServer.stop();
    }

    @test async "should write property"() {
        const coapServer = new CoapServer(PORT);

        await coapServer.start(null);

        const testThing = new ExposedThing(null, {
            title: "Test",
            properties: {
                test: {
                    type: "string",
                },
            },
        });

        let test: DataSchemaValue = "testValue";
        testThing.setPropertyReadHandler("test", (_) => Promise.resolve(test));
        testThing.setPropertyWriteHandler("test", async (value) => {
            test = await value.value();
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.test.forms = [];

        await coapServer.expose(testThing);

        const uri = `coap://localhost:${coapServer.getPort()}/test/`;

        const coapClient = new CoapClient(coapServer);
        await coapClient.writeResource(new TD.Form(uri + "properties/test"), {
            type: "text/plain",
            body: Readable.from(Buffer.from("testValue1", "utf-8")),
        });
        const resp = await coapClient.readResource(new TD.Form(uri + "properties/test"));
        const data = (await ProtocolHelpers.readStreamFully(resp.body)).toString();
        expect(data).to.equal('"testValue1"');

        await coapServer.stop();
    }

    @test async "should perform an action"() {
        const coapServer = new CoapServer(PORT);

        await coapServer.start(null);

        const testThing = new ExposedThing(null, {
            title: "Test",
            actions: {
                try: {
                    output: { type: "string" },
                },
            },
        });

        testThing.setActionHandler("try", (input: WoT.InteractionOutput) => {
            return new Promise<string>((resolve, reject) => {
                resolve("TEST");
            });
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.actions.try.forms = [];

        await coapServer.expose(testThing);

        const uri = `coap://localhost:${coapServer.getPort()}/test/`;

        const coapClient = new CoapClient(coapServer);
        const resp = await coapClient.invokeResource(new TD.Form(uri + "actions/try"), {
            type: "text/plain",
            body: Readable.from(Buffer.from("testValue1", "utf-8")),
        });
        expect((await ProtocolHelpers.readStreamFully(resp.body)).toString()).to.equal('"TEST"');

        await coapServer.stop();
    }

    @test async "should subscribe to event"() {
        const coapServer = new CoapServer(PORT);

        await coapServer.start(null);

        const testThing = new ExposedThing(null, {
            title: "Test",
            events: {
                eventTest: {
                    forms: [
                        {
                            href: "http://test",
                            op: "subscribeevent",
                        },
                    ],
                },
            },
        });

        await coapServer.expose(testThing);

        const uri = `coap://localhost:${coapServer.getPort()}/test/`;

        const coapClient = new CoapClient(coapServer);
        const form = new TD.Form(uri + "events/eventTest");
        const subscription = await coapClient.subscribeResource(form, (value) => {
            /**  */
        });

        subscription.unsubscribe();

        await coapServer.stop();
    }

    @test async "should cause EADDRINUSE error when already running"() {
        const portNumber = 9000;
        const coapServer1 = new CoapServer(portNumber);
        await coapServer1.start(null);

        expect(coapServer1.getPort()).to.eq(portNumber);

        const coapServer2 = new CoapServer(coapServer1.getPort());

        try {
            await coapServer2.start(null);
        } catch (err) {
            expect(err.message).to.eql(`bind EADDRINUSE 0.0.0.0:${portNumber}`);
        }

        await coapServer1.stop();
    }

    @test async "should take in account global uriVariables"() {
        const portNumber = 9001;
        const coapServer = new CoapServer(portNumber);

        await coapServer.start(null);

        const testThing = new ExposedThing(null, {
            title: "Test",
            uriVariables: {
                globalVarTest: {
                    type: "string",
                    enum: ["test1", "test2", "test3"],
                    description: "test",
                },
                id: {
                    type: "string",
                    enum: ["test1", "test2", "test3"],
                },
            },
            properties: {
                test: {
                    type: "string",
                    uriVariables: {
                        id: {
                            type: "string",
                        },
                    },
                },
            },
        });
        const test: DataSchemaValue = "testValue";
        testThing.setPropertyReadHandler("test", (options) => {
            expect(options.uriVariables).to.deep.equal({ id: "testId", globalVarTest: "test1" });
            return new Promise<InteractionInput>((resolve, reject) => {
                resolve(test);
            });
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.test.forms = [];

        await coapServer.expose(testThing);

        const uri = `coap://localhost:${coapServer.getPort()}/test/`;

        const coapClient = new CoapClient(coapServer);
        const resp = await coapClient.readResource(new TD.Form(uri + "properties/test?id=testId&globalVarTest=test1"));
        expect((await ProtocolHelpers.readStreamFully(resp.body)).toString()).to.equal('"testValue"');

        return coapServer.stop();
    }

    @test async "should support /.well-known/core"() {
        const portNumber = 9001;
        const coapServer = new CoapServer(portNumber);

        await coapServer.start(null);

        const testTitles = ["Test1", "Test2"];

        for (const title of testTitles) {
            const thing = new ExposedThing(null, {
                title,
            });

            await coapServer.expose(thing);
        }

        const uri = `coap://localhost:${coapServer.getPort()}/.well-known/core`;

        const coapClient = new CoapClient(coapServer);
        const resp = await coapClient.readResource(new TD.Form(uri));
        expect((await ProtocolHelpers.readStreamFully(resp.body)).toString()).to.equal(
            '</test1>;rt="wot.thing";ct="50 432",</test2>;rt="wot.thing";ct="50 432"'
        );

        return coapServer.stop();
    }

    @test async "should support TD Content-Format negotiation"() {
        const portNumber = 5683;
        const coapServer = new CoapServer(portNumber);

        await coapServer.start(null);

        const testThing = new ExposedThing(null, {
            title: "Test",
        });

        await coapServer.expose(testThing);

        const uri = `coap://localhost:${coapServer.getPort()}/test`;
        let responseCounter = 0;

        const defaultContentFormat = "application/td+json";
        const unsupportedContentFormat = "application/cbor";
        const contentFormats = [defaultContentFormat, "application/json", unsupportedContentFormat];

        for (const contentFormat of contentFormats) {
            const req = request(uri);
            req.setHeader("Accept", contentFormat);
            req.on("response", (res) => {
                const requestContentFormat = res.headers["Content-Format"];

                if (contentFormat === unsupportedContentFormat) {
                    expect(requestContentFormat).to.equal(defaultContentFormat);
                } else {
                    expect(requestContentFormat).to.equal(contentFormat);
                }

                if (++responseCounter >= contentFormats.length) {
                    coapServer.stop();
                }
            });
            req.end();
        }
    }

    @test async "should supply Size2 option when fetching a TD"() {
        const portNumber = 9002;
        const coapServer = new CoapServer(portNumber);

        await coapServer.start(null);

        const testThing = new ExposedThing(null, {
            title: "Test",
            description: "This is a test!".repeat(100),
        });

        await coapServer.expose(testThing);

        const req = request({
            host: "localhost",
            pathname: "test",
            port: coapServer.getPort(),
        });
        req.setOption("Size2", 0);
        req.on("response", (res) => {
            expect(res.headers.Size2).to.equal(JSON.stringify(testThing.getThingDescription()).length);
            coapServer.stop();
        });
        req.end();
    }
}
