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
 * Protocol test suite to test protocol implementations
 */

import { suite, test } from "@testdeck/mocha";
import { expect, should } from "chai";

import * as http from "http";
import * as url from "url";
import { AddressInfo } from "net";

import { ContentSerdes, ProtocolHelpers, ProtocolServer } from "@node-wot/core";

import { Readable } from "stream";

import HttpClient from "../src/http-client";
import { HttpForm } from "../src/http";

// should must be called to augment all variables
should();
// Add spies
const chai = require("chai");
const spies = require("chai-spies");

chai.use(spies);

// use(require("chai"));

interface TestVector {
    op: Array<string>;
    method?: string;
    schema?: any;
    payload?: any;
    form: any;
}

const port1 = 50000;
const port2 = 50001;

class TestHttpServer implements ProtocolServer {
    public readonly scheme: string = "test";

    private testVector: TestVector;

    private readonly port: number = 60606;
    private readonly address: string = undefined;
    private readonly server: http.Server;

    constructor(port?: number, address?: string) {
        if (port !== undefined) {
            this.port = port;
        }
        if (address !== undefined) {
            this.address = address;
        }
        this.server = http.createServer((req, res) => {
            this.checkRequest(req, res);
        });
    }

    public async start(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.server.once("listening", () => {
                resolve();
            });
            this.server.listen(this.port, this.address);
        });
    }

    public async stop(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.server.close(() => {
                console.error("STOPPED");
                resolve();
            });
        });
    }

    /** returns server port number and indicates that server is running when larger than -1  */
    public getPort(): number {
        if (this.server.address() && typeof this.server.address() === "object") {
            return (<AddressInfo>this.server.address()).port;
        } else {
            // includes address() typeof "string" case, which is only for unix sockets
            return -1;
        }
    }

    public expose(thing: unknown): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            resolve();
        });
    }

    public destroy(thingId: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            resolve(false);
        });
    }

    public setTestVector(vector: TestVector) {
        if (!vector.op) throw new Error("No vector op given");
        if (!vector.form["htv:methodName"]) {
            // TODO also check all array entries
            switch (vector.op[0]) {
                case "readproperty":
                    vector.method = "GET";
                    break;
                case "writeproperty":
                    vector.method = "PUT";
                    break;
                case "observeproperty":
                    vector.method = "GET";
                    break;
                case "invokeaction":
                    vector.method = "POST";
                    break;
                case "subscribeevent":
                    vector.method = "GET";
                    break;
                default:
                    throw new Error("Unknown op " + vector.op);
            }
        } else {
            vector.method = vector.form["htv:methodName"];
        }
        this.testVector = vector;
    }

    private checkRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        if (!this.testVector) throw new Error("No test vector given");

        expect(req.method).to.equal(this.testVector.method);
        expect(req.url).to.equal(url.parse(this.testVector.form.href).path);

        if (this.testVector.payload !== undefined) {
            // load payload
            const body: Array<any> = [];
            req.on("data", (data) => {
                body.push(data);
            });
            req.on("end", () => {
                let value;
                try {
                    value = ContentSerdes.get().contentToValue(
                        { type: ContentSerdes.DEFAULT, body: Buffer.concat(body) },
                        this.testVector.schema
                    );
                } catch (err) {
                    throw new Error("Cannot deserialize client payload");
                }
                expect(value).to.equal(this.testVector.payload);
                res.end();
            });
        } else {
            res.end();
        }
    }
}

@suite("HTTP client basic operations")
class HttpClientTest1 {
    static httpServer: TestHttpServer;
    static async before(): Promise<void> {
        HttpClientTest1.httpServer = new TestHttpServer(port1);
        await HttpClientTest1.httpServer.start();
        expect(HttpClientTest1.httpServer.getPort()).to.equal(port1);
    }

    static async after(): Promise<void> {
        HttpClientTest1.httpServer.stop();
    }

    private client: HttpClient;

    before() {
        this.client = new HttpClient();
    }

    after() {
        this.client.stop();
    }

    @test async "should apply defaults : read with default"() {
        // read with defaults
        const inputVector1 = {
            op: ["readproperty"],
            form: <HttpForm>{
                href: `http://localhost:${port1}/`,
            },
        };
        HttpClientTest1.httpServer.setTestVector(inputVector1);
        const resource = await this.client.readResource(inputVector1.form);
        const body = await ProtocolHelpers.readStreamFully(resource.body);
        body.toString("ascii").should.eql("");
    }

    @test async "should apply defaults - write with default"() {
        // write with defaults
        const inputVector2 = {
            op: ["writeproperty"],
            form: <HttpForm>{
                href: `http://localhost:${port1}/`,
            },
            payload: "test",
        };
        HttpClientTest1.httpServer.setTestVector(inputVector2);

        await this.client.writeResource(inputVector2.form, {
            type: ContentSerdes.DEFAULT,
            body: Readable.from(inputVector2.payload),
        });
    }

    @test async "should apply defaults - invoke with default"() {
        // invoke with defaults
        const inputVector3 = {
            op: ["invokeaction"],
            form: <HttpForm>{
                href: `http://localhost:${port1}/`,
            },
            payload: "test",
        };
        HttpClientTest1.httpServer.setTestVector(inputVector3);

        const resource = await this.client.invokeResource(inputVector3.form, {
            type: ContentSerdes.DEFAULT,
            body: Readable.from(inputVector3.payload),
        });

        expect(resource.type).eql(null);
        const body = await ProtocolHelpers.readStreamFully(resource.body);
        body.toString("ascii").should.eql("");
    }

    @test async "should apply form information - read with POST instead of GET"() {
        // read with POST instead of GET
        const inputVector1 = {
            op: ["readproperty"],
            form: <HttpForm>{
                href: `http://localhost:${port1}/`,
                "htv:methodName": "POST",
            },
        };
        HttpClientTest1.httpServer.setTestVector(inputVector1);
        const resource = await this.client.readResource(inputVector1.form);
        expect(resource.type).eql(null);
        const body = await ProtocolHelpers.readStreamFully(resource.body);
        body.toString("ascii").should.eql("");
    }

    @test async "should apply form information - read with POST instead of PUT"() {
        // write with POST instead of PUT
        const inputVector2 = {
            op: ["writeproperty"],
            form: <HttpForm>{
                href: `http://localhost:${port1}/`,
                "htv:methodName": "POST",
            },
            payload: "test",
        };
        HttpClientTest1.httpServer.setTestVector(inputVector2);
        const writeResult = await this.client.writeResource(inputVector2.form, {
            type: ContentSerdes.DEFAULT,
            body: Readable.from(inputVector2.payload),
        });
    }

    @test async "should apply form information - read with PUT instead of GET"() {
        // invoke with PUT instead of POST
        const inputVector3 = {
            op: ["invokeaction"],
            form: <HttpForm>{
                href: `http://localhost:${port1}/`,
                "htv:methodName": "PUT",
            },
            payload: "test",
        };
        HttpClientTest1.httpServer.setTestVector(inputVector3);
        const invokeResourceResult = await this.client.invokeResource(inputVector3.form, {
            type: ContentSerdes.DEFAULT,
            body: Readable.from(inputVector3.payload),
        });
    }

    @test async "should apply form information - read with DELETE instead of POST"() {
        // invoke with DELETE instead of POST
        const inputVector4 = {
            op: ["invokeaction"],
            form: <HttpForm>{
                href: `http://localhost:${port1}/`,
                "htv:methodName": "DELETE",
            },
        };
        HttpClientTest1.httpServer.setTestVector(inputVector4);
        const invokeResourceResult2 = await this.client.invokeResource(inputVector4.form);
    }
}

const express = require("express");
const serveStatic = require("serve-static");
const SseStream = require("ssestream");

@suite("HTTP client subscriptions")
class HttpClientTest2 {
    @test "should register to sse server and get server sent event"(done: any) {
        // create sse server

        const app = express();
        app.use(serveStatic(__dirname));
        app.get("/sse", function (req: any, res: any) {
            console.log("new connection");

            const sseStream = new SseStream(req);
            sseStream.pipe(res);
            const pusher = setInterval(() => {
                sseStream.write({
                    data: "Test event",
                });
            }, 300);

            res.on("close", () => {
                console.log("lost connection");
                clearInterval(pusher);
                sseStream.unpipe(res);
                done();
            });
        });

        const server = app.listen(port1, (err: any) => {
            if (err) throw err;
            console.log(`server ready on http://localhost:${port1}`);
        });
        console.log("client created");
        const client = new HttpClient();

        // Subscribe to a resource with sse
        const form: HttpForm = {
            op: ["observeproperty"],
            subprotocol: "sse",
            contentType: "application/json",
            href: `http://localhost:${port1}/sse`,
        };

        client.subscribeResource(form, (data) => {
            client.unlinkResource(form);
            server.close();
        });
    }

    @test "should call error() and complete() on subscription with no connection"(done: () => void) {
        const client = new HttpClient();

        // Subscribe to an event
        const form: HttpForm = {
            op: ["subscribeevent"],
            href: "http://404.localhost",
        };

        const errorSpy = chai.spy();
        const completeSpy = chai.spy(() => {
            errorSpy.should.have.been.called.once;
            completeSpy.should.have.been.called.once;
            done();
        });

        client.subscribeResource(
            form,
            (data) => {
                /**  */
            },
            errorSpy,
            completeSpy
        );
    }

    @test "should call error() and complete() on subscription with wrong URL"(done: any) {
        const client = new HttpClient();

        // Subscribe to an event
        const form: HttpForm = {
            op: ["subscribeevent"],
            href: `http://localhost:${port2}/`,
        };

        const server = http.createServer((req, res) => {
            res.writeHead(404);
            res.end();
        });

        const errorSpy = chai.spy();
        const completeSpy = chai.spy(function () {
            errorSpy.should.have.been.called.once;
            completeSpy.should.have.been.called.once;
            done();
            server.close();
        });

        server.listen(port2, "0.0.0.0");
        server.once("listening", () => {
            client.subscribeResource(
                form,
                (data) => {
                    /**  */
                },
                errorSpy,
                completeSpy
            );
        });
    }

    @test "should subscribe successfully"(done: any) {
        let client = new HttpClient();

        // Subscribe to an event
        let form: HttpForm = {
            op: ["subscribeevent"],
            href: "http://localhost:60605/",
        };

        let server = http.createServer((req, res) => {
            res.writeHead(200);
            res.end();
        });

        let subscribeSpy = chai.spy();

        let eventSpy = chai.spy(async function (data: any) {
            eventSpy.should.have.been.called.once;
            subscribeSpy.should.have.been.called.once;
            done();
            server.close();
        });

        server.listen(60605, "0.0.0.0");
        server.once("listening", () => {
            client
                .subscribeResource(
                    form,
                    eventSpy,
                    () => {
                        /** */
                    },
                    () => {
                        /** */
                    }
                )
                .then(subscribeSpy);
        });
    }
}
