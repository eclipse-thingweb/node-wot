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
import { expect, should, assert } from "chai";
import * as chai from "chai";
import fetch from "node-fetch";

import HttpServer from "../src/http-server";
import { Content, createLoggers, ExposedThing, Helpers } from "@node-wot/core";
import { DataSchemaValue, InteractionInput, InteractionOptions } from "wot-typescript-definitions";
import chaiAsPromised from "chai-as-promised";
import { Readable } from "stream";

const { debug, error } = createLoggers("binding-http", "http-server-test");

chai.use(chaiAsPromised);

// should must be called to augment all variables
should();

const port = 32080;
const port2 = 32081;
@suite("HTTP server implementation")
class HttpServerTest {
    @test async "should start and stop a server"() {
        const httpServer = new HttpServer({ port });

        await httpServer.start(null);
        expect(httpServer.getPort()).to.eq(port); // from test

        await httpServer.stop();
        expect(httpServer.getPort()).to.eq(-1); // from getPort() when not listening
    }

    @test async "should be able to destroy a thing"() {
        const httpServer = new HttpServer({ port: 0 });

        await httpServer.start(null);

        let testThing = new ExposedThing(null);
        testThing = Helpers.extend(
            {
                title: "Test",
                id: "56789",
                properties: {
                    test: {
                        type: "string",
                    },
                },
            },
            testThing
        );
        // testThing.extendInteractions();
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.test.forms = [];

        await httpServer.expose(testThing);
        let result = await httpServer.destroy("56789");
        expect(result);
        result = await httpServer.destroy("56789");
        expect(!result);

        await httpServer.stop();
    }

    @test async "should change resource from 'off' to 'on' and try to invoke"() {
        const httpServer = new HttpServer({ port: 0 });

        await httpServer.start(null);

        const testThing = new ExposedThing(null, {
            title: "Test",
            properties: {
                test: {
                    forms: [],
                },
            },
            events: {
                eventTest: {
                    forms: [],
                },
            },
            actions: {
                try: {
                    output: { type: "string" },
                    forms: [],
                },
            },
        });

        let test: DataSchemaValue;
        testThing.setPropertyReadHandler("test", (_) => Promise.resolve(test));
        testThing.setPropertyWriteHandler("test", async (value) => {
            test = await value.value();
        });

        testThing.setActionHandler("try", (input: WoT.InteractionOutput) => {
            return new Promise<string>((resolve, reject) => {
                resolve("TEST");
            });
        });

        await httpServer.expose(testThing);

        testThing.handleSubscribeEvent(
            "eventTest",
            async (input: Content) => {
                const data = await input.toBuffer();
                expect(data.toString()).to.equal("'test''");
            },
            { formIndex: 0 }
        );
        testThing.emitEvent("eventTest", "test");

        await testThing.handleWriteProperty(
            "test",
            new Content("text/plain", Readable.from(Buffer.from("off", "utf-8"))),
            { formIndex: 0 }
        );

        const uri = `http://localhost:${httpServer.getPort()}/test/`;
        let resp;

        debug(`Testing ${uri}`);

        resp = await (await fetch(uri + "properties/test")).text();
        expect(resp).to.equal('"off"');

        resp = await (await fetch(uri + "properties")).json();
        expect(resp).to.deep.equal({ test: "off" });

        resp = await (await fetch(uri + "properties/test", { method: "PUT", body: "on" })).text();
        expect(resp).to.equal("");

        resp = await (await fetch(uri + "properties/test")).text();
        expect(resp).to.equal('"on"');

        resp = await (await fetch(uri + "actions/try", { method: "POST", body: "toggle" })).text();
        expect(resp).to.equal('"TEST"');

        resp = await (await fetch(uri + "actions/try", { method: "POST", body: undefined })).text();
        expect(resp).to.equal('"TEST"');

        return httpServer.stop();
    }

    @test async "should check uriVariables consistency"() {
        const httpServer = new HttpServer({ port: 0 });

        await httpServer.start(null);

        const testThing = new ExposedThing(null, {
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
            expect(options.uriVariables).to.deep.equal({ id: "testId" });
            return new Promise<InteractionInput>((resolve, reject) => {
                resolve(test);
            });
        });
        testThing.setPropertyWriteHandler("test", async (value, options) => {
            expect(options.uriVariables).to.deep.equal({ id: "testId" });
            test = await value.value();
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.test.forms = [];
        testThing.setActionHandler("try", (input: WoT.InteractionOutput, params: InteractionOptions) => {
            return new Promise<string>((resolve, reject) => {
                expect(params.uriVariables).to.deep.equal({ step: 5 });
                resolve("TEST");
            });
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.actions.try.forms = [];

        await httpServer.expose(testThing);

        const uri = `http://localhost:${httpServer.getPort()}/test/`;
        let resp;

        resp = await (await fetch(uri + "properties/test?id=testId", { method: "PUT", body: "on" })).text();
        expect(resp).to.equal("");

        resp = await (await fetch(uri + "actions/try?step=5", { method: "POST", body: "toggle" })).text();
        expect(resp).to.equal('"TEST"');

        return httpServer.stop();
    }

    @test async "should serialize objects for actions and properties"() {
        const httpServer = new HttpServer({ port: 0 });

        await httpServer.start(null);

        const testThing = new ExposedThing(null, {
            title: "Test",
            properties: {
                test: {
                    type: "object",
                },
            },
            actions: {
                try: {
                    output: { type: "object" },
                },
            },
        });
        let test = {};
        testThing.setPropertyReadHandler("test", (_) => Promise.resolve(test));
        testThing.setPropertyWriteHandler("test", async (value) => {
            test = await value.value();
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.test.forms = [];
        testThing.setActionHandler("try", (input: WoT.InteractionOutput) => {
            return new Promise<string>((resolve, reject) => {
                resolve("TEST");
            });
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.actions.try.forms = [];

        await httpServer.expose(testThing);

        const uri = `http://localhost:${httpServer.getPort()}/test/`;
        let resp;

        debug(`Testing ${uri}`);

        resp = await (await fetch(uri + "properties/test")).text();
        expect(resp).to.equal("{}");

        resp = await (await fetch(uri + "properties")).json();
        expect(resp).to.deep.equal({ test: {} });

        resp = await (
            await fetch(uri + "properties/test", {
                method: "PUT",
                body: JSON.stringify({ new: true }),
                headers: { "Content-Type": "application/json" },
            })
        ).text();
        expect(resp).to.equal("");

        resp = await (await fetch(uri + "properties/test")).text();
        expect(resp).to.equal('{"new":true}');

        resp = await (await fetch(uri + "actions/try", { method: "POST", body: "toggle" })).text();
        expect(resp).to.equal('"TEST"');

        resp = await (await fetch(uri + "actions/try", { method: "POST", body: undefined })).text();
        expect(resp).to.equal('"TEST"');

        return httpServer.stop();
    }

    @test async "should cause EADDRINUSE error when already running"() {
        const httpServer1 = new HttpServer({ port: 0 });

        await httpServer1.start(null);
        expect(httpServer1.getPort()).to.be.above(0);

        const httpServer2 = new HttpServer({ port: httpServer1.getPort() });

        try {
            await httpServer2.start(null); // should fail
        } catch (err) {
            error(`HttpServer failed correctly on EADDRINUSE. ${err}`);
            assert(true);
        }

        expect(httpServer2.getPort()).to.eq(-1);

        const uri = `http://localhost:${httpServer1.getPort()}/`;

        return fetch(uri).then(async (body) => {
            expect(await body.text()).to.equal("[]");

            await httpServer1.stop();
            await httpServer2.stop();
        });
    }

    // https://github.com/eclipse/thingweb.node-wot/issues/181
    @test async "should start and stop a server with no security"() {
        const httpServer = new HttpServer({ port, security: { scheme: "nosec" } });

        await httpServer.start(null);
        expect(httpServer.getPort()).to.eq(port); // port test
        expect(httpServer.getHttpSecurityScheme()).to.eq("NoSec"); // HTTP security scheme test (nosec -> NoSec)
        await httpServer.stop();
    }

    // https://github.com/eclipse/thingweb.node-wot/issues/181
    @test async "should not override a valid security scheme"() {
        const httpServer = new HttpServer({
            port: port2,
            serverKey: "./test/server.key",
            serverCert: "./test/server.cert",
            security: {
                scheme: "bearer",
            },
        });
        await httpServer.start(null);
        const testThing = new ExposedThing(null);
        testThing.title = "Test";
        testThing.securityDefinitions = {
            bearer: {
                scheme: "bearer",
            },
        };
        httpServer.expose(testThing);
        await httpServer.stop();

        expect(testThing.securityDefinitions.bearer).not.eql(undefined);
    }

    @test async "should not accept an unsupported scheme"() {
        debug("START SHOULD");
        const httpServer = new HttpServer({
            port: port2,
            serverKey: "./test/server.key",
            serverCert: "./test/server.cert",
            security: {
                scheme: "bearer",
            },
        });
        await httpServer.start(null);

        try {
            const testThing = new ExposedThing(null);
            testThing.title = "Test";
            testThing.securityDefinitions = {
                oauth2: {
                    scheme: "oauth2",
                },
            };
            await expect(httpServer.expose(testThing)).to.be.eventually.rejectedWith(Error);
        } finally {
            await httpServer.stop();
        }
    }

    @test async "config.port is overridden by WOT_PORT or PORT"() {
        // Works when none set
        let httpServer = new HttpServer({ port });
        await httpServer.start(null);
        expect(httpServer.getPort()).to.eq(port); // WOT PORT from test
        await httpServer.stop();

        // Check PORT
        process.env.PORT = "2222";
        httpServer = new HttpServer({ port });
        await httpServer.start(null);
        expect(httpServer.getPort()).to.eq(2222); // from PORT
        await httpServer.stop();

        // CHECK WOT_PORT
        process.env.PORT = undefined;
        process.env.WOT_PORT = "3333";
        httpServer = new HttpServer({ port });
        await httpServer.start(null);
        expect(httpServer.getPort()).to.eq(3333); // WOT PORT from test
        await httpServer.stop();

        // Check WOT_PORT has higher priority than PORT
        process.env.PORT = "2600";
        process.env.WOT_PORT = "1337";
        httpServer = new HttpServer({ port });
        await httpServer.start(null);
        expect(httpServer.getPort()).to.eq(1337); // WOT PORT from test
        await httpServer.stop();
        delete process.env.PORT;
        delete process.env.WOT_PORT;
    }

    @test async "should allow HttpServer baseUri to specify url prefix for proxied/gateswayed/buildpack etc "() {
        const theHostname = "wot.w3c.loopback.site:8080";
        const theBasePath = "/things";
        const theBaseUri = `http://${theHostname}${theBasePath}`;
        const httpServer = new HttpServer({
            baseUri: theBaseUri,
            port: 8080,
        });

        await httpServer.start(null);

        const testThing = new ExposedThing(null, {
            title: "Smart Coffee Machine",
            properties: {
                maintenanceNeeded: {
                    type: "string",
                },
            },
            actions: {
                makeDrink: {
                    output: { type: "string" },
                },
            },
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.maintenanceNeeded.forms = [];
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.actions.makeDrink.forms = [];

        await httpServer.expose(testThing);

        const uri = "http://localhost:8080/smart-coffee-machine";
        const body = await (await fetch(uri)).text();

        const expectedUrl = `${theBaseUri}/smart-coffee-machine/actions/makeDrink`;

        expect(body).to.include(expectedUrl);
        debug(`Found URL ${expectedUrl} in TD`);
        await httpServer.stop();
    }

    @test async "should take in account global uriVariables"() {
        const httpServer = new HttpServer({ port: 0 });

        await httpServer.start(null);

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
        let test: DataSchemaValue;
        testThing.setPropertyReadHandler("test", (options) => {
            expect(options.uriVariables).to.deep.equal({ id: "testId", globalVarTest: "test1" });
            return new Promise<InteractionInput>((resolve, reject) => {
                resolve(test);
            });
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.test.forms = [];

        await httpServer.expose(testThing);

        const uri = `http://localhost:${httpServer.getPort()}/test/`;

        const resp = await (
            await fetch(uri + "properties/test?id=testId&globalVarTest=test1", { method: "GET" })
        ).text();
        expect(resp).to.equal("");

        return httpServer.stop();
    }

    @test async "should allow url rewrite"() {
        const httpServer = new HttpServer({ port: 0, urlRewrite: { "/myroot/foo": "/test/properties/test" } });

        await httpServer.start(null);

        const testThing = new ExposedThing(null, {
            title: "Test",
            properties: {
                test: {
                    type: "object",
                },
            },
        });
        let test = {};
        testThing.setPropertyReadHandler("test", (_) => Promise.resolve(test));
        testThing.setPropertyWriteHandler("test", async (value) => {
            test = await value.value();
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.test.forms = [];
        await httpServer.expose(testThing);

        const uriWithoutThing = `http://localhost:${httpServer.getPort()}/`;
        let resp;

        resp = await (await fetch(uriWithoutThing + "test/properties/test")).text();
        expect(resp).to.equal("{}");

        resp = await (await fetch(uriWithoutThing + "myroot/foo")).text();
        expect(resp).to.equal("{}");

        resp = await (await fetch(uriWithoutThing + "my-entry/does-not-exist")).text();
        expect(resp).to.not.equal("{}"); // i.e., returns 'Not Found'

        return httpServer.stop();
    }

    @test async "should report allproperties excluding non-JSON properties"() {
        const httpServer = new HttpServer({ port: 0 });

        await httpServer.start(null);

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
        const testThing = new ExposedThing(null, tdTemplate);

        const image = "<svg xmlns='http://www.w3.org/2000/svg'><text>FOO</text></svg>";
        const integer = 123;
        const boolean = true;
        const string = "ABCD";
        const object = { t1: "xyz", i: 77 };
        const array = ["x", "y", "z"];
        testThing.setPropertyReadHandler("image", (_) => Promise.resolve(image));
        testThing.setPropertyReadHandler("testInteger", (_) => Promise.resolve(integer));
        testThing.setPropertyReadHandler("testBoolean", (_) => Promise.resolve(boolean));
        testThing.setPropertyReadHandler("testString", (_) => Promise.resolve(string));
        testThing.setPropertyReadHandler("testObject", (_) => Promise.resolve(object));
        testThing.setPropertyReadHandler("testArray", (_) => Promise.resolve(array));

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

        await httpServer.expose(testThing, tdTemplate);

        // check values one by one first
        const responseInteger = await fetch(`http://localhost:${httpServer.getPort()}/testa/properties/testInteger`);
        expect(await responseInteger.json()).to.equal(integer);
        const responseBoolean = await fetch(`http://localhost:${httpServer.getPort()}/testa/properties/testBoolean`);
        expect(await responseBoolean.json()).to.equal(boolean);
        const responseString = await fetch(`http://localhost:${httpServer.getPort()}/testa/properties/testString`);
        expect(await responseString.json()).to.equal(string);
        const responseObject = await fetch(`http://localhost:${httpServer.getPort()}/testa/properties/testObject`);
        expect(await responseObject.json()).to.deep.equal(object);
        const responseArray = await fetch(`http://localhost:${httpServer.getPort()}/testa/properties/testArray`);
        expect(await responseArray.json()).to.deep.equal(array);

        // check values of readallproperties
        const responseAll = await fetch(`http://localhost:${httpServer.getPort()}/testa/properties`);
        expect(await responseAll.json()).to.deep.equal({
            // "image": image, // Note: No support for contentTypes other than JSON -> not included
            testInteger: integer,
            testBoolean: boolean,
            testString: string,
            testObject: object,
            testArray: array,
        });

        return httpServer.stop();
    }

    @test async "should support setting SVG contentType"() {
        const httpServer = new HttpServer({ port: 0 });

        await httpServer.start(null);

        const tdTemplate = {
            title: "Test",
            properties: {
                image: {
                    forms: [
                        {
                            contentType: "image/svg+xml",
                        },
                    ],
                },
            },
        };
        const testThing = new ExposedThing(null, tdTemplate);

        const image = "<svg xmlns='http://www.w3.org/2000/svg'><text>FOO</text></svg>";
        testThing.setPropertyReadHandler("image", (_) => Promise.resolve(image));

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.image.forms = [];
        await httpServer.expose(testThing, tdTemplate);

        const uri = `http://localhost:${httpServer.getPort()}/test/properties/image`;

        const contentTypeResponse = await fetch(uri);
        expect(contentTypeResponse.headers.get("Content-Type")).to.equal("image/svg+xml");

        // check value (e.g., SVG text without quotes)
        expect(await contentTypeResponse.text()).to.equal(image);

        return httpServer.stop();
    }

    @test async "should support setting PNG contentType"() {
        const httpServer = new HttpServer({ port: 0 });

        await httpServer.start(null);

        const tdTemplate = {
            title: "Test",
            properties: {
                image: {
                    forms: [
                        {
                            contentType: "image/png",
                        },
                    ],
                },
            },
        };
        const testThing = new ExposedThing(null, tdTemplate);

        const image =
            "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==";
        testThing.setPropertyReadHandler("image", (_) => Promise.resolve(image));

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.image.forms = [];
        await httpServer.expose(testThing, tdTemplate);

        const uri = `http://localhost:${httpServer.getPort()}/test/properties/image`;

        const contentTypeResponse = await fetch(uri);
        expect(contentTypeResponse.headers.get("Content-Type")).to.equal("image/png");

        return httpServer.stop();
    }

    @test async "should support TD content negotiation"() {
        const httpServer = new HttpServer({ port: 0 });

        await httpServer.start(null);

        const testThing = new ExposedThing(null, {
            title: "Test",
        });

        await httpServer.expose(testThing);

        const uri = `http://localhost:${httpServer.getPort()}/test/`;

        const testCases = [
            {
                inputHeaders: {},
                expected: "application/td+json",
                expectedResponseCode: 200,
            },
            {
                inputHeaders: { Accept: "application/json" },
                expected: "application/json",
                expectedResponseCode: 200,
            },
            {
                // Typical browser request (e.g., Chrome)
                inputHeaders: {
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                },
                // We should favor application/td+json over text/html
                expected: "application/td+json",
                expectedResponseCode: 200,
            },
            {
                inputHeaders: {
                    Accept: "image/svg+xml,text/html,",
                },
                // We should favor text/html over image/svg+xml
                expected: "text/html",
                expectedResponseCode: 200,
            },
            {
                inputHeaders: { Accept: "*/*,application/json" },
                expected: "application/td+json",
                expectedResponseCode: 200,
            },
            {
                inputHeaders: { Accept: "*/*" },
                expected: "application/td+json",
                expectedResponseCode: 200,
            },
            {
                inputHeaders: { Accept: "foo/cbar;baz=fuzz,application/json,foo/cbar" },
                expected: "application/json",
                expectedResponseCode: 200,
            },
            {
                inputHeaders: { Accept: "foo/cbar;baz=fuzz,foo/cbar" },
                expected: null,
                expectedResponseCode: 406,
            },
        ];

        for (const testCase of testCases) {
            const negotiatedContentTypeResponse = await fetch(uri, {
                headers: testCase.inputHeaders,
            });
            expect(negotiatedContentTypeResponse.headers.get("Content-Type")).to.equal(testCase.expected);
            expect(negotiatedContentTypeResponse.status).to.equal(testCase.expectedResponseCode);
        }

        return httpServer.stop();
    }

    @test async "should not support unknown Content-Types during TD content negotiation"() {
        const httpServer = new HttpServer({ port: 0 });

        await httpServer.start(null);

        const testThing = new ExposedThing(null, {
            title: "Test",
        });

        await httpServer.expose(testThing);

        const uri = `http://localhost:${httpServer.getPort()}/test/`;

        const failedNegotiationResponse = await fetch(uri, {
            headers: {
                Accept: "foo/bar",
            },
        });
        expect(failedNegotiationResponse.headers.get("Content-Type")).to.equal(null);
        expect(failedNegotiationResponse.status).to.equal(406);

        return httpServer.stop();
    }

    @test async "TD should have form with readallproperties"() {
        const httpServer = new HttpServer({ port: 0 });

        await httpServer.start(null);

        const tdTemplate: WoT.ExposedThingInit = {
            title: "Test",
            properties: {
                testReadOnly: {
                    type: "number",
                    readOnly: true,
                },
            },
        };
        const testThing = new ExposedThing(null, tdTemplate);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.testReadOnly.forms = [];

        await httpServer.expose(testThing, tdTemplate);

        const uriTD = `http://localhost:${httpServer.getPort()}/test`;

        const tdResponse = await fetch(uriTD);
        const td = await tdResponse.json();

        expect(td).to.have.property("forms").to.be.an("array");
        expect(JSON.stringify(td.forms)).to.deep.contain.oneOf(["readallproperties", "readmultipleproperties"]);
        expect(JSON.stringify(td.forms)).to.not.deep.contain.oneOf(["writeallproperties", "writemultipleproperties"]);

        return httpServer.stop();
    }

    @test async "TD should have form with writeallproperties"() {
        const httpServer = new HttpServer({ port: 0 });

        await httpServer.start(null);

        const tdTemplate: WoT.ExposedThingInit = {
            title: "Test",
            properties: {
                testWriteOnly: {
                    type: "number",
                    writeOnly: true,
                },
            },
        };
        const testThing = new ExposedThing(null, tdTemplate);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.testWriteOnly.forms = [];

        await httpServer.expose(testThing, tdTemplate);

        const uriTD = `http://localhost:${httpServer.getPort()}/test`;

        const tdResponse = await fetch(uriTD);
        const td = await tdResponse.json();

        expect(td).to.have.property("forms").to.be.an("array");
        expect(JSON.stringify(td.forms)).to.not.deep.contain.oneOf(["readallproperties", "readmultipleproperties"]);
        expect(JSON.stringify(td.forms)).to.deep.contain.oneOf(["writeallproperties", "writemultipleproperties"]);

        return httpServer.stop();
    }

    @test async "TD should have form with readallproperties and writeallproperties"() {
        const httpServer = new HttpServer({ port: 0 });

        await httpServer.start(null);

        const tdTemplate: WoT.ExposedThingInit = {
            title: "Test",
            properties: {
                testReadOnly: {
                    type: "number",
                    readOnly: true,
                },
                testWriteOnly: {
                    type: "number",
                    writeOnly: true,
                },
            },
        };
        const testThing = new ExposedThing(null, tdTemplate);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.testReadOnly.forms = [];
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.testWriteOnly.forms = [];

        await httpServer.expose(testThing, tdTemplate);

        const uriTD = `http://localhost:${httpServer.getPort()}/test`;

        const tdResponse = await fetch(uriTD);
        const td = await tdResponse.json();

        expect(td).to.have.property("forms").to.be.an("array");
        expect(JSON.stringify(td.forms)).to.deep.contain.oneOf(["readallproperties", "readmultipleproperties"]);
        expect(JSON.stringify(td.forms)).to.deep.contain.oneOf(["writeallproperties", "writemultipleproperties"]);

        return httpServer.stop();
    }
}
