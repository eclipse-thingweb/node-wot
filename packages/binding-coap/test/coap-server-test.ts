import Servient, { ExposedThing, Content } from "@node-wot/core";
/********************************************************************************
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
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
import { DataSchemaValue, InteractionInput, InteractionOptions } from "wot-typescript-definitions";
import * as TD from "@node-wot/td-tools";
import CoapServer from "../src/coap-server";
import { CoapClient } from "../src/coap";
import { Readable } from "stream";
import { IncomingMessage, registerFormat, request } from "coap";

// should must be called to augment all variables
should();

const PORT = 31831;
@suite("CoAP server implementation")
class CoapServerTest {
    @test async "should start and stop a server"() {
        const coapServer = new CoapServer({ port: PORT });

        await coapServer.start(new Servient());
        expect(coapServer.getPort()).to.eq(PORT); // from test

        await coapServer.stop();
        expect(coapServer.getPort()).to.eq(-1); // from getPort() when not listening
    }

    @test async "should read property"() {
        const coapServer = new CoapServer({ port: PORT });

        await coapServer.start(new Servient());

        const testThing = new ExposedThing(new Servient(), {
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
        expect((await resp.toBuffer()).toString()).to.equal('"testValue"');

        await coapServer.stop();
    }

    @test async "should write property"() {
        const coapServer = new CoapServer({ port: PORT });

        await coapServer.start(new Servient());

        const testThing = new ExposedThing(new Servient(), {
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
        await coapClient.writeResource(
            new TD.Form(uri + "properties/test"),
            new Content("text/plain", Readable.from(Buffer.from("testValue1", "utf-8")))
        );
        const resp = await coapClient.readResource(new TD.Form(uri + "properties/test"));
        const data = (await resp.toBuffer()).toString();
        expect(data).to.equal('"testValue1"');

        await coapServer.stop();
    }

    @test async "should perform an action"() {
        const coapServer = new CoapServer({ port: PORT });

        await coapServer.start(new Servient());

        const testThing = new ExposedThing(new Servient(), {
            title: "Test",
            actions: {
                try: {
                    output: { type: "string" },
                },
            },
        });

        testThing.setActionHandler("try", async (input: WoT.InteractionOutput) => {
            return "TEST";
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.actions.try.forms = [];

        await coapServer.expose(testThing);

        const uri = `coap://localhost:${coapServer.getPort()}/test/`;

        const coapClient = new CoapClient(coapServer);
        const resp = await coapClient.invokeResource(
            new TD.Form(uri + "actions/try"),
            new Content("text/plain", Readable.from(Buffer.from("testValue1", "utf-8")))
        );
        expect((await resp.toBuffer()).toString()).to.equal('"TEST"');

        await coapServer.stop();
    }

    @test async "should subscribe to event"() {
        const coapServer = new CoapServer({ port: PORT });

        await coapServer.start(new Servient());

        const testThing = new ExposedThing(new Servient(), {
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
        const port = 9000;
        const coapServer1 = new CoapServer({ port });
        await coapServer1.start(new Servient());

        expect(coapServer1.getPort()).to.eq(port);

        const coapServer2 = new CoapServer({ port: coapServer1.getPort() });

        try {
            await coapServer2.start(new Servient());
        } catch (err) {
            expect((err as Error).message).to.eql(`bind EADDRINUSE 0.0.0.0:${port}`);
        }

        await coapServer1.stop();
    }

    @test async "should support IPv6"() {
        const coapServer = new CoapServer({ port: PORT, address: "::" });
        await coapServer.start(new Servient());

        const testThing = new ExposedThing(new Servient(), {
            title: "Test",
            properties: {
                test: {
                    type: "string",
                    forms: [],
                },
            },
        });

        const test: DataSchemaValue = "testValue";
        testThing.setPropertyReadHandler("test", (_) => Promise.resolve(test));

        await coapServer.expose(testThing);

        const uri = `coap://[::1]:${coapServer.getPort()}/test/`;

        const coapClient = new CoapClient(coapServer);
        const resp = await coapClient.readResource(new TD.Form(uri + "properties/test"));
        expect((await resp.toBuffer()).toString()).to.equal('"testValue"');

        await coapClient.stop();
        await coapServer.stop();
    }

    @test async "should take in account global uriVariables"() {
        const port = 9001;
        const coapServer = new CoapServer({ port });

        await coapServer.start(new Servient());

        const testThing = new ExposedThing(new Servient(), {
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
            expect(options?.uriVariables).to.deep.equal({ id: "testId", globalVarTest: "test1" });
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
        expect((await resp.toBuffer()).toString()).to.equal('"testValue"');

        await coapServer.stop();
    }

    @test async "should support /.well-known/core"() {
        const port = 9001;
        const coapServer = new CoapServer({ port });

        await coapServer.start(new Servient());

        const testTitles = ["Test1", "Test2"];

        for (const title of testTitles) {
            const thing = new ExposedThing(new Servient(), {
                title,
            });

            await coapServer.expose(thing);
        }

        const uri = `coap://localhost:${coapServer.getPort()}/.well-known/core`;

        const coapClient = new CoapClient(coapServer);
        const resp = await coapClient.readResource(new TD.Form(uri));
        expect((await resp.toBuffer()).toString()).to.equal(
            '</test1>;rt="wot.thing";ct="50 432",</test2>;rt="wot.thing";ct="50 432"'
        );

        await coapServer.stop();
    }

    @test async "should support TD Content-Format negotiation"() {
        const port = 5683;
        const coapServer = new CoapServer({ port });

        await coapServer.start(new Servient());

        const testThing = new ExposedThing(new Servient(), {
            title: "Test",
        });

        await coapServer.expose(testThing);

        const uri = `coap://localhost:${coapServer.getPort()}/test`;

        registerFormat("application/foobar", 65000);

        const defaultContentFormat = "application/td+json";
        const unsupportedContentFormat = "application/foobar";
        const contentFormats = [
            defaultContentFormat,
            "application/json",
            "application/xml",
            unsupportedContentFormat,
            null,
        ];

        const promises = contentFormats.map(
            (contentFormat) =>
                new Promise<void>((resolve) => {
                    const req = request(uri);

                    if (contentFormat != null) {
                        req.setHeader("Accept", contentFormat);
                    }

                    req.on("response", async (res: IncomingMessage) => {
                        const requestContentFormat = res.headers["Content-Format"];

                        if (contentFormat === unsupportedContentFormat) {
                            expect(res.code).to.equal("4.06");
                            expect(res.payload.toString()).to.equal(
                                `Content-Format ${unsupportedContentFormat} is not supported by this resource.`
                            );
                        } else {
                            expect(requestContentFormat).to.equal(contentFormat ?? defaultContentFormat);
                        }

                        resolve();
                    });
                    req.end();
                })
        );

        await Promise.all(promises);

        await coapServer.stop();
    }

    @test async "should supply Size2 option when fetching a TD"() {
        const port = 9002;
        const coapServer = new CoapServer({ port });

        await coapServer.start(new Servient());

        const testThing = new ExposedThing(new Servient(), {
            title: "Test",
            description: "This is a test!".repeat(100),
        });

        await coapServer.expose(testThing);

        await new Promise<void>((resolve) => {
            const req = request({
                host: "localhost",
                pathname: "test",
                port: coapServer.getPort(),
            });
            req.setOption("Size2", 0);
            req.on("response", (res) => {
                expect(res.headers.Size2).to.equal(JSON.stringify(testThing.getThingDescription()).length);
                resolve();
            });
            req.end();
        });

        await coapServer.stop();
    }

    @test async "should check uriVariables consistency"() {
        const port = 9003;
        const coapServer = new CoapServer({ port });
        const servient = new Servient();

        const baseUri = `coap://localhost:${port}/test`;

        await coapServer.start(servient);

        const testThing = new ExposedThing(servient, {
            title: "Test",
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
            actions: {
                try: {
                    output: { type: "string" },
                    uriVariables: {
                        step: { type: "integer" },
                    },
                },
            },
        });

        let test: DataSchemaValue;
        testThing.setPropertyReadHandler("test", (options) => {
            expect(options?.uriVariables).to.deep.equal({ id: "testId" });
            return new Promise<InteractionInput>((resolve, reject) => {
                resolve(test);
            });
        });
        testThing.setPropertyWriteHandler("test", async (value, options) => {
            expect(options?.uriVariables).to.deep.equal({ id: "testId" });
            test = await value.value();
            expect(test?.valueOf()).to.deep.equal("on");
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.test.forms = [];
        testThing.setActionHandler("try", async (input: WoT.InteractionOutput, params?: InteractionOptions) => {
            expect(params?.uriVariables).to.deep.equal({ step: 5 });
            return "TEST";
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.actions.try.forms = [];

        await coapServer.expose(testThing);

        const coapClient = new CoapClient(coapServer);

        const propertyUri = `${baseUri}/properties/test?id=testId`;

        await coapClient.writeResource(new TD.Form(propertyUri), new Content("text/plain", Readable.from("on")));

        const response1 = await coapClient.readResource(new TD.Form(propertyUri));
        expect((await response1.toBuffer()).toString()).to.equal('"on"');

        const response2 = await coapClient.invokeResource(new TD.Form(`${baseUri}/actions/try?step=5`));
        expect((await response2.toBuffer()).toString()).to.equal('"TEST"');

        await coapClient.stop();
        await coapServer.stop();
    }

    @test async "should report allproperties excluding non-JSON properties"() {
        const port = 5683;
        const coapServer = new CoapServer({ port });
        const servient = new Servient();

        await coapServer.start(servient);

        const tdTemplate: WoT.ExposedThingInit = {
            title: "TestA",
            properties: {
                image: {
                    forms: [
                        {
                            contentType: "image/svg+xml",
                        },
                    ],
                },
                testInteger: {
                    type: "integer",
                },
                testBoolean: {
                    type: "boolean",
                },
                testString: {
                    type: "string",
                },
                testObject: {
                    type: "object",
                },
                testArray: {
                    type: "array",
                },
            },
        };
        const testThing = new ExposedThing(servient, tdTemplate);

        const image = "<svg xmlns='http://www.w3.org/2000/svg'><text>FOO</text></svg>";
        const integer = 123;
        const boolean = true;
        const string = "ABCD";
        const object = { t1: "xyz", i: 77 };
        const array = ["x", "y", "z"];
        testThing.setPropertyReadHandler("image", async (_) => image);
        testThing.setPropertyReadHandler("testInteger", async (_) => integer);
        testThing.setPropertyReadHandler("testBoolean", async (_) => boolean);
        testThing.setPropertyReadHandler("testString", async (_) => string);
        testThing.setPropertyReadHandler("testObject", async (_) => object);
        testThing.setPropertyReadHandler("testArray", async (_) => array);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.image.forms = [];
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.testInteger.forms = [];
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.testBoolean.forms = [];
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.testString.forms = [];
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.testObject.forms = [];
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.testArray.forms = [];

        await coapServer.expose(testThing, tdTemplate);

        const coapClient = new CoapClient(coapServer);

        const decodeContent = async (content: Content) => JSON.parse((await content.toBuffer()).toString());

        const baseUri = `coap://localhost:${port}/testa/properties`;

        // check values one by one first
        const responseInteger = await coapClient.readResource(new TD.Form(`${baseUri}/testInteger`));
        expect(await decodeContent(responseInteger)).to.equal(integer);
        const responseBoolean = await coapClient.readResource(new TD.Form(`${baseUri}/testBoolean`));
        expect(await decodeContent(responseBoolean)).to.equal(boolean);
        const responseString = await coapClient.readResource(new TD.Form(`${baseUri}/testString`));
        expect(await decodeContent(responseString)).to.equal(string);
        const responseObject = await coapClient.readResource(new TD.Form(`${baseUri}/testObject`));
        expect(await decodeContent(responseObject)).to.deep.equal(object);
        const responseArray = await coapClient.readResource(new TD.Form(`${baseUri}/testArray`));
        expect(await decodeContent(responseArray)).to.deep.equal(array);

        // check values of readallproperties
        const responseAll = await coapClient.readResource(new TD.Form(baseUri));
        expect(await decodeContent(responseAll)).to.deep.equal({
            image,
            testInteger: integer,
            testBoolean: boolean,
            testString: string,
            testObject: object,
            testArray: array,
        });

        await coapServer.stop();
        await coapClient.stop();
    }

    @test async "should reject requests for undefined meta operations"() {
        const coapServer = new CoapServer();
        const servient = new Servient();

        await coapServer.start(servient);

        const testThingWithoutForms = new ExposedThing(servient, {
            title: "Test",
        });

        await coapServer.expose(testThingWithoutForms);

        await new Promise<void>((resolve) => {
            const req = request({
                host: "localhost",
                pathname: "test/properties",
                port: coapServer.getPort(),
                method: "GET",
            });
            req.on("response", (res: IncomingMessage) => {
                expect(res.code).to.equal("4.04");
                resolve();
            });
            req.end();
        });

        await coapServer.stop();
        await servient.shutdown();
    }

    @test async "should reject unsupported methods for meta operations"() {
        const coapServer = new CoapServer();
        const servient = new Servient();

        await coapServer.start(servient);

        const testThingWithoutForms = new ExposedThing(servient, {
            title: "Test",
            properties: {
                testInteger: {
                    type: "integer",
                    forms: [],
                },
            },
        });

        await coapServer.expose(testThingWithoutForms);

        await new Promise<void>((resolve) => {
            const req = request({
                host: "localhost",
                pathname: "test/properties",
                port: coapServer.getPort(),
                method: "PUT",
            });
            req.on("response", (res) => {
                expect(res.code).to.equal("4.05");
                resolve();
            });
            req.end();
        });

        await coapServer.stop();
        await servient.shutdown();
    }
}
