/********************************************************************************
 * Copyright (c) 2026 Contributors to the Eclipse Foundation
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
import { suite, test } from "@testdeck/mocha";
import { expect, should } from "chai";
import fetch from "node-fetch";
import HttpServer from "../src/http-server";
import Servient, { ExposedThing } from "@node-wot/core";

// should must be called to augment all variables
should();

@suite("HTTP Server CORS")
class HttpServerCorsTest {
    private httpServer!: HttpServer;
    private servient!: Servient;
    private thing!: ExposedThing;

    async before() {
        this.servient = new Servient();
        this.httpServer = new HttpServer({ port: 0 });
        await this.httpServer.start(this.servient);
    }

    async after() {
        await this.httpServer.stop();
    }

    @test async "should handle CORS with no security (nosec)"() {
        this.thing = new ExposedThing(this.servient, {
            title: "TestThingNoSec",
            properties: {
                test: {
                    type: "string",
                    forms: [],
                },
            },
        });

        this.thing.setPropertyReadHandler("test", () => Promise.resolve("test-value"));

        await this.httpServer.expose(this.thing);

        const uri = `http://localhost:${this.httpServer.getPort()}/testthingnosec/properties/test`;
        const response = await fetch(uri, {
            headers: {
                Origin: "http://example.com",
            },
        });

        expect(response.status).to.equal(200);
        expect(response.headers.get("Access-Control-Allow-Origin")).to.equal("*");
        expect(response.headers.has("Access-Control-Allow-Credentials")).to.be.false;
    }

    @test async "should handle CORS with basic security (401 response)"() {
        await this.httpServer.stop();

        this.httpServer = new HttpServer({
            port: 0,
            security: [{ scheme: "basic" }],
        });
        await this.httpServer.start(this.servient);

        this.thing = new ExposedThing(this.servient, {
            title: "TestThingBasic",
            securityDefinitions: {
                basic_sc: { scheme: "basic" },
            },
            security: ["basic_sc"],
            properties: {
                test: {
                    type: "string",
                    forms: [],
                },
            },
        });

        await this.httpServer.expose(this.thing);

        const uri = `http://localhost:${this.httpServer.getPort()}/testthingbasic/properties/test`;
        const response = await fetch(uri, {
            headers: {
                Origin: "http://example.com",
            },
        });

        expect(response.status).to.equal(401);
        expect(response.headers.get("Access-Control-Allow-Origin")).to.equal("http://example.com");
        expect(response.headers.get("Access-Control-Allow-Credentials")).to.equal("true");
    }

    @test async "should handle CORS with basic security (200 response)"() {
        await this.httpServer.stop();

        this.httpServer = new HttpServer({
            port: 0,
            security: [{ scheme: "basic" }],
        });
        await this.httpServer.start(this.servient);

        this.thing = new ExposedThing(this.servient, {
            title: "TestThingBasic200",
            securityDefinitions: {
                basic_sc: { scheme: "basic" },
            },
            security: ["basic_sc"],
            id: "urn:test:thing:basic:200",
            properties: {
                test: {
                    type: "string",
                    forms: [],
                },
            },
        });

        this.thing.setPropertyReadHandler("test", () => Promise.resolve("success"));

        this.servient.addCredentials({
            "urn:test:thing:basic:200": {
                username: "user",
                password: "password",
            },
        });

        await this.httpServer.expose(this.thing);

        const uri = `http://localhost:${this.httpServer.getPort()}/urn:test:thing:basic:200/properties/test`;

        const auth = Buffer.from("user:password").toString("base64");

        const response = await fetch(uri, {
            headers: {
                Origin: "http://example.com",
                Authorization: `Basic ${auth}`,
            },
        });

        expect(response.status).to.equal(200);
        expect(response.headers.get("Access-Control-Allow-Origin")).to.equal("http://example.com");
        expect(response.headers.get("Access-Control-Allow-Credentials")).to.equal("true");
        expect(await response.json()).to.equal("success");
    }

    @test async "should handle CORS preflight for basic security"() {
        await this.httpServer.stop();

        this.httpServer = new HttpServer({
            port: 0,
            security: [{ scheme: "basic" }],
        });
        await this.httpServer.start(this.servient);

        this.thing = new ExposedThing(this.servient, {
            title: "TestThingPreflight",
            securityDefinitions: {
                basic_sc: { scheme: "basic" },
            },
            security: ["basic_sc"],
            properties: {
                test: {
                    type: "string",
                    forms: [],
                },
            },
        });

        await this.httpServer.expose(this.thing);

        const uri = `http://localhost:${this.httpServer.getPort()}/testthingpreflight/properties/test`;
        const response = await fetch(uri, {
            method: "OPTIONS",
            headers: {
                Origin: "http://example.com",
                "Access-Control-Request-Method": "GET",
            },
        });

        expect(response.status).to.equal(200);
        expect(response.headers.get("Access-Control-Allow-Origin")).to.equal("http://example.com");
        expect(response.headers.get("Access-Control-Allow-Credentials")).to.equal("true");
        const methods = response.headers.get("Access-Control-Allow-Methods");
        expect(methods).to.contain("GET");
        expect(methods).to.contain("OPTIONS");
    }

    @test async "should handle CORS for write property (PUT)"() {
        this.thing = new ExposedThing(this.servient, {
            title: "TestThingWrite",
            properties: {
                test: {
                    type: "string",
                    forms: [],
                },
            },
        });

        this.thing.setPropertyWriteHandler("test", () => Promise.resolve(undefined));

        await this.httpServer.expose(this.thing);

        const uri = `http://localhost:${this.httpServer.getPort()}/testthingwrite/properties/test`;
        const response = await fetch(uri, {
            method: "PUT",
            body: JSON.stringify("new-value"),
            headers: {
                Origin: "http://example.com",
                "Content-Type": "application/json",
            },
        });

        expect(response.status).to.equal(204);
        expect(response.headers.get("Access-Control-Allow-Origin")).to.equal("*");
    }

    @test async "should handle CORS for invoke action (POST)"() {
        this.thing = new ExposedThing(this.servient, {
            title: "TestThingAction",
            actions: {
                test: {
                    forms: [],
                },
            },
        });

        this.thing.setActionHandler("test", () => Promise.resolve(undefined));

        await this.httpServer.expose(this.thing);

        const uri = `http://localhost:${this.httpServer.getPort()}/testthingaction/actions/test`;
        const response = await fetch(uri, {
            method: "POST",
            headers: {
                Origin: "http://example.com",
            },
        });

        expect(response.status).to.equal(204); // Action without output returns 204
        expect(response.headers.get("Access-Control-Allow-Origin")).to.equal("*");
    }
}
