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
import { expect, should } from "chai";
// should must be called to augment all variables
should();

import * as http from "http";
import * as rp from "request-promise";

import { AssetResourceListener } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";
import { CoapServer } from "@node-wot/binding-coap";

const coap = require("coap");

@suite("Multi-protcol implementation")
class ProtocolsTest {

    @test "should work cross-protocol"(done: Function) {
        let httpServer = new HttpServer(0);
        let coapServer = new CoapServer(0);

        let asset = new AssetResourceListener("test");

        httpServer.addResource("/", asset);
        coapServer.addResource("/", asset);
        
        httpServer.start();
        coapServer.start();

        let uri = `http://localhost:${httpServer.getPort()}/`;

        rp.get(uri).then(body => {
            expect(body).to.equal("test");

            let req1 = coap.request({ method: "PUT", hostname: "localhost", port: coapServer.getPort(), path: "/" } );
            req1.on("response", (res1 : any) => {
                expect(res1.code).to.equal("2.04");
                rp.get(uri).then(body => {
                    expect(body).to.equal("by-coap");

                    rp.put(uri, {body: "by-http"}).then(body => {
                        let req2 = coap.request({ method: "GET", hostname: "localhost", port: coapServer.getPort(), path: "/" } );
                        req2.on("response", (res2 : any) => {
                                expect(res2.payload.toString()).to.equal("by-http");

                                httpServer.stop();
                                coapServer.stop();

                                done();
                            });
                        req2.end();
                    });
                });
            });
            req1.write("by-coap");
            req1.end();
        });
    }
}
