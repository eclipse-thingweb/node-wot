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

import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import { expect, should, assert } from "chai";
// should must be called to augment all variables
should();

import * as http from "http";
import * as url from "url";
import { AddressInfo } from "net";

import { Content, ContentSerdes, ProtocolServer } from "@node-wot/core";

import HttpClient from "../src/http-client";
import { endianness } from "os";

interface TestVector {
    op: Array<string>;
    method?: string;
    schema?: any;
    payload?: any;
    form: any;
}

class TestHttpServer implements ProtocolServer {
    public readonly scheme: string = "test";

    private testVector: TestVector;

    private readonly port: number = 60606;
    private readonly address: string = undefined;
    private readonly server: http.Server = http.createServer((req, res) => { this.checkRequest(req, res) });

    constructor(port?: number, address?: string) {
        if (port !== undefined) {
            this.port = port;
        }
        if (address !== undefined) {
            this.address = address;
        }
    }

    public start(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.server.once('listening', () => {
                resolve();
            });
            this.server.listen(this.port, this.address);
        });
    }

    public stop(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.server.close(() => { console.error("STOPPED"); resolve(); });
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

    public expose(thing: any): Promise<void> {
        return new Promise<void>((resolve, reject) => { resolve(); });
    }

    public setTestVector(vector: TestVector) {
        if (!vector.op) throw new Error("No vector op given");
        if (!vector.form["http:methodName"]) {
            // TODO also check all array entries
            switch (vector.op[0]) {
                case "readproperty": vector.method = "GET"; break;
                case "writeproperty": vector.method = "PUT"; break;
                case "observeproperty": vector.method = "GET"; break;
                case "invokeaction": vector.method = "POST"; break;
                case "subscribeevent": vector.method = "GET"; break;
                default: throw new Error("Unknown op " + vector.op);
            }
        } else {
            vector.method = vector.form["http:methodName"];
        }
        this.testVector = vector;
    }

    private checkRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        if (!this.testVector) throw new Error("No test vector given");

        expect(req.method).to.equal(this.testVector.method);
        expect(req.url).to.equal(url.parse(this.testVector.form.href).path);

        if (this.testVector.payload !== undefined) {
            // load payload
            let body: Array<any> = [];
            req.on("data", (data) => { body.push(data) });
            req.on("end", () => {
                let value;
                try {
                    value = ContentSerdes.get().contentToValue({ type: ContentSerdes.DEFAULT, body: Buffer.concat(body) }, this.testVector.schema);
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

@suite("HTTP client implementation")
class HttpClientTest {

    @test async "should apply defaults"() {

        var inputVector;

        let httpServer = new TestHttpServer(60603);
        await httpServer.start();
        expect(httpServer.getPort()).to.equal(60603);

        let client = new HttpClient();

        // read with defaults
        inputVector = {
            op: ["readproperty"],
            form: {
                href: "http://localhost:60603/"
            }
        };
        httpServer.setTestVector(inputVector);
        let representation = await client.readResource(inputVector.form);

        // write with defaults
        inputVector = {
            op: ["writeproperty"],
            form: {
                href: "http://localhost:60603/"
            },
            payload: "test"
        };
        httpServer.setTestVector(inputVector);
        representation = await client.writeResource(inputVector.form, { type: ContentSerdes.DEFAULT, body: Buffer.from(inputVector.payload) });

        // invoke with defaults
        inputVector = {
            op: ["invokeaction"],
            form: {
                href: "http://localhost:60603/"
            },
            payload: "test"
        };
        httpServer.setTestVector(inputVector);
        representation = await client.invokeResource(inputVector.form, { type: ContentSerdes.DEFAULT, body: Buffer.from(inputVector.payload) });

        return httpServer.stop();
    }

    @test async "should apply form information"() {

        var inputVector;

        let httpServer = new TestHttpServer(60603);
        await httpServer.start();
        expect(httpServer.getPort()).to.equal(60603);

        let client = new HttpClient();

        // read with POST instead of GET
        inputVector = {
            op: ["readproperty"],
            form: {
                href: "http://localhost:60603/",
                "http:methodName": "POST"
            }
        };
        httpServer.setTestVector(inputVector);
        let representation = await client.readResource(inputVector.form);

        // write with POST instead of PUT
        inputVector = {
            op: ["writeproperty"],
            form: {
                href: "http://localhost:60603/",
                "http:methodName": "POST"
            },
            payload: "test"
        };
        httpServer.setTestVector(inputVector);
        representation = await client.writeResource(inputVector.form, { type: ContentSerdes.DEFAULT, body: Buffer.from(inputVector.payload) });

        // invoke with PUT instead of POST
        inputVector = {
            op: ["invokeaction"],
            form: {
                href: "http://localhost:60603/",
                "http:methodName": "PUT"
            },
            payload: "test"
        };
        httpServer.setTestVector(inputVector);
        representation = await client.invokeResource(inputVector.form, { type: ContentSerdes.DEFAULT, body: Buffer.from(inputVector.payload) });

        // invoke with DELETE instead of POST
        inputVector = {
            op: ["invokeaction"],
            form: {
                href: "http://localhost:60603/",
                "http:methodName": "DELETE"
            }
        };
        httpServer.setTestVector(inputVector);
        representation = await client.invokeResource(inputVector.form);

        return httpServer.stop();
    }
}
