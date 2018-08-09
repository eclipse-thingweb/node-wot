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

import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import { expect, should, assert } from "chai";
// should must be called to augment all variables
should();

import { ResourceListener, BasicResourceListener, Content, ContentSerdes } from "@node-wot/core";

import HttpServer from "../src/http-server";
import HttpClient from "../src/http-client";

class TestResourceListener extends BasicResourceListener implements ResourceListener {

    public referencedVector: any;
    constructor(vector: any) {
        super();
        this.referencedVector = vector;
    }

    public onRead() : Promise<Content> {
        this.referencedVector.expect = "GET";
        return new Promise<Content>(
            (resolve,reject) => resolve({ mediaType: ContentSerdes.DEFAULT , body: Buffer.from("TEST") })
        );
    }

    public onWrite(content : Content) : Promise<void> {
        this.referencedVector.expect = "PUT";
        return new Promise<void>((resolve,reject) => resolve())
    }

    public onInvoke(content : Content) : Promise<Content> {
        this.referencedVector.expect = "POST";
        return new Promise<Content>(
            (resolve,reject) => resolve({ mediaType: ContentSerdes.DEFAULT, body: Buffer.from("TEST") })
        );
    }

    public onUnlink() : Promise<void> {
        this.referencedVector.expect = "DELETE";
        return new Promise<void>(
            (resolve,reject) => resolve()
        );
    }
}

@suite("HTTP client implementation")
class HttpClientTest {

    @test async "should apply form information"() {

    try {

        var testVector = { expect: "UNSET" }

        let httpServer = new HttpServer(60603);
        httpServer.addResource("/", new TestResourceListener(testVector) );

        await httpServer.start();
        expect(httpServer.getPort()).to.equal(60603);

        let client = new HttpClient();
        let representation;

        // read with POST instead of GET
        representation = await client.readResource({
            href: "http://localhost:60603/",
            "http:methodName": "POST"
        });
        expect(testVector.expect).to.equal("POST");
        testVector.expect = "UNSET";

        // write with POST instead of PUT
        representation = await client.writeResource({
            href: "http://localhost:60603/",
            "http:methodName": "POST"
        }, { mediaType: ContentSerdes.DEFAULT, body: Buffer.from("test") } );
        expect(testVector.expect).to.equal("POST");
        testVector.expect = "UNSET";

        // invoke with PUT instead of POST
        representation = await client.invokeResource({
            href: "http://localhost:60603/",
            "http:methodName": "PUT"
        }, { mediaType: ContentSerdes.DEFAULT, body: Buffer.from("test") } );
        expect(testVector.expect).to.equal("PUT");
        testVector.expect = "UNSET";

        // invoke with DELETE instead of POST
        representation = await client.invokeResource({
            href: "http://localhost:60603/",
            "http:methodName": "DELETE"
        });
        expect(testVector.expect).to.equal("DELETE");
        testVector.expect = "UNSET";
        
        // FIXME -- why does it block forever?
        //await httpServer.stop();

    } catch (err) {
        console.error("ERROR", err);
    }
    }
}
