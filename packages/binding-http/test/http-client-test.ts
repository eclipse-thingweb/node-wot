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
import chai, { expect, should } from "chai";

import * as http from "http";

import { Content, DefaultContent, ContentSerdes, createLoggers, ProtocolServer } from "@node-wot/core";

import { Readable } from "stream";
import { text } from "node:stream/consumers";

import HttpClient from "../src/http-client";
import { HttpForm } from "../src/http";

import express from "express";
import serveStatic from "serve-static";
import { DataSchema, DataSchemaValue, Form } from "wot-typescript-definitions";
import SseStream from "ssestream";
import FakeTimers from "@sinonjs/fake-timers";

// Add spies
import spies from "chai-spies";

const { debug } = createLoggers("binding-http", "http-client-test");

// should must be called to augment all variables
should();

chai.use(spies);

interface TestVector {
    op: Array<string>;
    method?: string;
    schema?: DataSchema;
    payload?: DataSchemaValue;
    headers?: Record<string, string>;
    form: Form;
}

const port1 = 30001;
const port2 = 30002;
const port3 = 30001;
const port4 = 30003;

class TestHttpServer implements ProtocolServer {
    public readonly scheme: string = "test";

    private testVector: TestVector | undefined;

    private readonly port: number = 60606;
    private readonly address: string | undefined = undefined;
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
        return new Promise<void>((resolve) => {
            this.server.listen(this.port, this.address, resolve);
        });
    }

    public async stop(): Promise<void> {
        return new Promise<void>((resolve) => {
            this.server.close(() => {
                resolve();
            });
        });
    }

    /** returns server port number and indicates that server is running when larger than -1  */
    public getPort(): number {
        const address = this.server?.address();

        if (typeof address === "object") {
            return address?.port ?? -1;
        }

        const port = parseInt(address);

        if (isNaN(port)) {
            return -1;
        }

        return port;
    }

    public async expose(thing: unknown): Promise<void> {}

    public async destroy(thingId: string): Promise<boolean> {
        return false;
    }

    public setTestVector(vector: TestVector) {
        if (vector.op == null) {
            throw new Error("No vector op given");
        }
        if (vector.form["htv:methodName"] == null) {
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
        expect(req.url).to.equal(new URL(this.testVector.form.href).pathname);

        if (this.testVector.headers) {
            expect(req.headers).to.include(this.testVector.headers);
        }

        if (this.testVector.payload !== undefined) {
            // load payload
            const body: Array<Uint8Array> = [];
            req.on("data", (data) => {
                body.push(data);
            });
            req.on("end", () => {
                if (!this.testVector) {
                    chai.assert.fail("No test vector given");
                }
                let value;
                try {
                    value = ContentSerdes.get().contentToValue(
                        { type: ContentSerdes.DEFAULT, body: Buffer.concat(body) },
                        this.testVector.schema ?? { type: "string" }
                    );
                } catch (err) {
                    throw new Error("Cannot deserialize client payload");
                }
                expect(value).to.equal(this.testVector?.payload);
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

    private client!: HttpClient;

    before() {
        this.client = new HttpClient();
    }

    async after() {
        await this.client.stop();
    }

    @test async "should apply defaults : read with default"() {
        // read with defaults
        const inputVector1 = {
            op: ["readproperty"],
            form: <HttpForm>{
                href: `http://localhost:${port1}/`,
            },
            headers: {
                accept: "application/json",
            },
        };
        HttpClientTest1.httpServer.setTestVector(inputVector1);
        const resource = await this.client.readResource(inputVector1.form);
        const body = await resource.toBuffer();
        body.toString("ascii").should.eql("");
    }

    @test async "should apply defaults - write with default"() {
        // write with defaults
        const inputVector2 = {
            op: ["writeproperty"],
            form: <HttpForm>{
                href: `http://localhost:${port1}/`,
            },
            headers: {
                "content-type": "application/json",
            },
            payload: "test",
        };
        HttpClientTest1.httpServer.setTestVector(inputVector2);

        await this.client.writeResource(inputVector2.form, new DefaultContent(Readable.from(inputVector2.payload)));
    }

    @test async "should apply defaults - invoke with default"() {
        // invoke with defaults
        const inputVector3 = {
            op: ["invokeaction"],
            form: <HttpForm>{
                href: `http://localhost:${port1}/`,
            },
            headers: {
                "content-type": "application/json",
                accept: "application/json",
            },
            payload: "test",
        };
        HttpClientTest1.httpServer.setTestVector(inputVector3);

        const resource = await this.client.invokeResource(
            inputVector3.form,
            new DefaultContent(Readable.from(inputVector3.payload))
        );

        expect(resource.type).eql(ContentSerdes.DEFAULT);
        const body = await resource.toBuffer();
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
        expect(resource.type).eql(ContentSerdes.DEFAULT);
        const body = await resource.toBuffer();
        body.toString("ascii").should.eql("");
    }

    @test async "should apply form information - read with not default content-type"() {
        // read with defaults
        const inputVector1 = {
            op: ["readproperty"],
            form: <HttpForm>{
                href: `http://localhost:${port1}/`,
                contentType: "text/plain",
            },
            headers: {
                accept: "text/plain",
            },
        };
        HttpClientTest1.httpServer.setTestVector(inputVector1);
        const resource = await this.client.readResource(inputVector1.form);
        const body = await resource.toBuffer();
        body.toString("ascii").should.eql("");
    }

    @test async "should apply form information - read with header override"() {
        // read with defaults
        const inputVector1 = {
            op: ["readproperty"],
            form: <HttpForm>{
                href: `http://localhost:${port1}/`,
                "htv:headers": {
                    "htv:fieldName": "accept",
                    "htv:fieldValue": "text/plain",
                },
            },
            headers: {
                accept: "text/plain",
            },
        };
        HttpClientTest1.httpServer.setTestVector(inputVector1);
        const resource = await this.client.readResource(inputVector1.form);
        const body = await resource.toBuffer();
        body.toString("ascii").should.eql("");
    }

    @test async "should apply form information - write with POST instead of PUT"() {
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
        await this.client.writeResource(inputVector2.form, new DefaultContent(Readable.from(inputVector2.payload)));
    }

    @test async "should apply form information - invoke with PUT instead of GET"() {
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
        await this.client.invokeResource(inputVector3.form, new DefaultContent(Readable.from(inputVector3.payload)));
    }

    @test async "should apply form information - invoke with DELETE instead of POST"() {
        // invoke with DELETE instead of POST
        const inputVector4 = {
            op: ["invokeaction"],
            form: <HttpForm>{
                href: `http://localhost:${port1}/`,
                "htv:methodName": "DELETE",
            },
        };
        HttpClientTest1.httpServer.setTestVector(inputVector4);
        await this.client.invokeResource(inputVector4.form);
    }

    @test async "should apply form information - invoke with not default content-type and no inputs"() {
        // invoke with DELETE instead of POST
        const inputVector4 = {
            op: ["invokeaction"],
            form: <HttpForm>{
                href: `http://localhost:${port1}/`,
                contentType: "text/plain",
            },
            headers: {
                accept: "text/plain",
            },
        };
        HttpClientTest1.httpServer.setTestVector(inputVector4);
        await this.client.invokeResource(inputVector4.form);
    }

    @test async "should apply form information - invoke with not default content-type"() {
        // invoke with DELETE instead of POST
        const inputVector4 = {
            op: ["invokeaction"],
            form: <HttpForm>{
                href: `http://localhost:${port1}/`,
                contentType: "text/plain",
            },
            headers: {
                "content-type": "text/plain",
                accept: "text/plain",
            },
            payload: "test",
        };
        HttpClientTest1.httpServer.setTestVector(inputVector4);
        await this.client.invokeResource(
            inputVector4.form,
            new Content("text/plain", Readable.from(inputVector4.payload))
        );
    }

    @test async "should apply form information - invoke with default content-type and response content-type"() {
        // invoke with DELETE instead of POST
        const inputVector4 = {
            op: ["invokeaction"],
            form: <HttpForm>{
                href: `http://localhost:${port1}/`,
                response: {
                    contentType: "text/plain",
                },
            },
            headers: {
                "content-type": "application/json",
                accept: "text/plain",
            },
            payload: "test",
        };
        HttpClientTest1.httpServer.setTestVector(inputVector4);
        await this.client.invokeResource(inputVector4.form, new DefaultContent(Readable.from(inputVector4.payload)));
    }
}

@suite("HTTP client subscriptions")
class HttpClientTest2 {
    @test "should register to sse server and get server sent event"(done: Mocha.Done) {
        // create sse server
        const clock = FakeTimers.install();
        const app = express();
        app.use(serveStatic(__dirname));
        app.get("/sse", function (req: express.Request, res: express.Response) {
            debug("new connection");

            const sseStream = new SseStream(req);
            sseStream.pipe(res);
            const pusher = setInterval(() => {
                sseStream.write({
                    data: "Test event",
                });
            }, 300);

            res.on("close", () => {
                debug("lost connection");
                clearInterval(pusher);
                sseStream.unpipe(res);
                done();
            });
        });

        const server = app.listen(port1, () => {
            debug(`server ready on http://localhost:${port1}`);
        });
        debug("client created");
        const client = new HttpClient();

        // Subscribe to a resource with sse
        const form: HttpForm = {
            op: ["observeproperty"],
            subprotocol: "sse",
            contentType: "application/json",
            href: `http://localhost:${port1}/sse`,
        };

        client
            .subscribeResource(form, async (data) => {
                const str = await text(data.body); // SHOULD be "Test event"
                str.should.eql("Test event");
                client.unlinkResource(form);
                server.close();
                clock.uninstall();
            })
            .then(() => {
                // subscription is active we can tick the clock
                clock.tick(400);
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
            // eslint-disable-next-line no-unused-expressions
            errorSpy.should.have.been.called.once;
            // eslint-disable-next-line no-unused-expressions
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

    @test "should call error() and complete() on subscription with wrong URL"(done: Mocha.Done) {
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
            // eslint-disable-next-line no-unused-expressions
            errorSpy.should.have.been.called.once;
            // eslint-disable-next-line no-unused-expressions
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

    @test "should subscribe successfully"(done: Mocha.Done) {
        const client = new HttpClient();

        // Subscribe to an event
        const form: HttpForm = {
            op: ["subscribeevent"],
            href: `http://localhost:${port3}/`,
        };

        const server = http.createServer((req, res) => {
            res.writeHead(200);
            res.end();
        });

        const subscribeSpy = chai.spy();

        const eventSpy = chai.spy(async function (data: Content) {
            // eslint-disable-next-line no-unused-expressions
            eventSpy.should.have.been.called.once;
            // eslint-disable-next-line no-unused-expressions
            subscribeSpy.should.have.been.called.once;
            server.close();
            done();
        });

        server.listen(port3, "0.0.0.0");
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

    @test "should unsubscribe successfully"(done: Mocha.Done) {
        const client = new HttpClient();

        // Subscribe to an event
        const form: HttpForm = {
            op: ["subscribeevent"],
            href: `http://localhost:${port4}/`,
        };

        const app = express();
        const server = http.createServer({}, app);

        app.get("/", async (req, res) => {
            res.send("Emitted Event!");
        });

        const eventSpy = chai.spy();

        server.listen(port4, "0.0.0.0");
        server.once("listening", async () => {
            let counter = 0;
            const sub = await client.subscribeResource(
                form,
                async () => {
                    counter++;
                    eventSpy();
                    if (counter === 2) {
                        sub.unsubscribe();
                        // wait 100 ms, so that tests fail if unsubscribe didn't work
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        // eslint-disable-next-line no-unused-expressions
                        eventSpy.should.have.been.called.twice;
                        server.close();
                        done();
                    } else if (counter > 2) {
                        server.close();
                        done(new Error("unsubscribe didn't work as expected"));
                    }
                },
                () => {
                    /** */
                },
                () => {
                    /** */
                }
            );
        });
    }
}
