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
 * Protocol test suite to test protocol implementations
 */

import { suite, test } from "@testdeck/mocha";
import { expect, should, assert } from "chai";
import * as chai from "chai";
import fetch from "node-fetch";

import HttpServer from "../src/http-server";
import { Content, ExposedThing, Helpers, ProtocolHelpers } from "@node-wot/core";
import { DataSchemaValue, InteractionInput, InteractionOptions } from "wot-typescript-definitions";
import { Readable } from "stream";
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

// should must be called to augment all variables
should();

@suite("HTTP server implementation")
class HttpServerTest {
    @test async "should start and stop a server"() {
        const httpServer = new HttpServer({ port: 58080 });

        await httpServer.start(null);
        expect(httpServer.getPort()).to.eq(58080); // from test

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
                    type: "string",
                },
            },
            events: {
                eventTest: {
                    forms: [
                        {
                            href: "http://test",
                            op: "subscribeevent"
                        }
                    ],
                },
            },
            actions: {
                try: {
                    output: { type: "string" },
                },
            },
        });
        let test: DataSchemaValue;
        testThing.setPropertyReadHandler("test", (_) => Promise.resolve(test));
        testThing.setPropertyWriteHandler("test", async (value) => {
            test = await value.value();
        });
        await testThing.handleWriteProperty("test", {
            type: "text/plain",
            body: Readable.from(Buffer.from("off", "utf-8"))
        }, { href: "" });
        testThing.properties.test.forms = [];

        testThing.handleSubscribeEvent("eventTest", async (input: Content) => {
            const data = await ProtocolHelpers.readStreamFully(input.body);
            expect(data.toString()).to.equal("'test''");
        });
        testThing.handleEmitEvent("eventTest", "test");

        testThing.setActionHandler("try", (input: WoT.InteractionOutput) => {
            return new Promise<string>((resolve, reject) => {
                resolve("TEST");
            });
        });
        testThing.actions.try.forms = [];

        await httpServer.expose(testThing);

        const uri = `http://localhost:${httpServer.getPort()}/test/`;
        let resp;

        console.log("Testing", uri);

        resp = await (await fetch(uri + "properties/test")).text();
        expect(resp).to.equal('"off"');

        resp = await (await fetch(uri + "properties")).text();
        expect(resp).to.equal('{"test":"\\"off\\""}');

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
        testThing.properties.test.forms = [];
        testThing.setActionHandler("try", (input: WoT.InteractionOutput, params: InteractionOptions) => {
            return new Promise<string>((resolve, reject) => {
                expect(params.uriVariables).to.deep.equal({ step: 5 });
                resolve("TEST");
            });
        });
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

    @test async "should cause EADDRINUSE error when already running"() {
        const httpServer1 = new HttpServer({ port: 0 });

        await httpServer1.start(null);
        expect(httpServer1.getPort()).to.be.above(0);

        const httpServer2 = new HttpServer({ port: httpServer1.getPort() });

        try {
            await httpServer2.start(null); // should fail
        } catch (err) {
            console.log("HttpServer failed correctly on EADDRINUSE");
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
        const httpServer = new HttpServer({ port: 58080, security: { scheme: "nosec" } });

        await httpServer.start(null);
        expect(httpServer.getPort()).to.eq(58080); // port test
        expect(httpServer.getHttpSecurityScheme()).to.eq("NoSec"); // HTTP security scheme test (nosec -> NoSec)
        await httpServer.stop();
    }

    // https://github.com/eclipse/thingweb.node-wot/issues/181
    @test async "should not override a valid security scheme"() {
        const httpServer = new HttpServer({
            port: 58081,
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
        console.log("START SHOULD");
        const httpServer = new HttpServer({
            port: 58081,
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
        let httpServer = new HttpServer({ port: 58080 });
        await httpServer.start(null);
        expect(httpServer.getPort()).to.eq(58080); // WOT PORT from test
        await httpServer.stop();

        // Check PORT
        process.env.PORT = "2222";
        httpServer = new HttpServer({ port: 58080 });
        await httpServer.start(null);
        expect(httpServer.getPort()).to.eq(2222); // from PORT
        await httpServer.stop();

        // CHECK WOT_PORT
        process.env.PORT = undefined;
        process.env.WOT_PORT = "3333";
        httpServer = new HttpServer({ port: 58080 });
        await httpServer.start(null);
        expect(httpServer.getPort()).to.eq(3333); // WOT PORT from test
        await httpServer.stop();

        // Check WOT_PORT has higher priority than PORT
        process.env.PORT = "2600";
        process.env.WOT_PORT = "1337";
        httpServer = new HttpServer({ port: 58080 });
        await httpServer.start(null);
        expect(httpServer.getPort()).to.eq(1337); // WOT PORT from test
        await httpServer.stop();
        delete process.env.PORT;
        delete process.env.WOT_PORT;
    }

    @test.skip async "should allow HttpServer baseUri to specify url prefix for proxied/gateswayed/buildpack etc "() {
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
        testThing.properties.maintenanceNeeded.forms = [];
        testThing.actions.makeDrink.forms = [];

        testThing.getThingDescription();

        await httpServer.expose(testThing);

        const uri = "http://localhost:8080/smart-coffee-machine"; // theBase.concat('/')
        const body = await (await fetch(uri)).text();
        // console.debug(JSON.stringify(JSON.parse(body),undefined,2))

        const expectedUrl = `${theBaseUri}/smart-coffee-machine/actions/makeDrink`;

        expect(body).to.include(expectedUrl);
        console.log(`Found URL ${expectedUrl} in TD`);
        await httpServer.stop();
    }
}
