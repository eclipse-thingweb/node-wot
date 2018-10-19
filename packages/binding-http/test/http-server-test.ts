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

import * as rp from "request-promise";

import HttpServer from "../src/http-server";
import { ExposedThing } from "@node-wot/core";

@suite("HTTP server implementation")
class HttpServerTest {

  @test async "should start and stop a server"() {
    let httpServer = new HttpServer(58080);

    await httpServer.start();
    expect(httpServer.getPort()).to.eq(58080); // from test

    await httpServer.stop();
    expect(httpServer.getPort()).to.eq(-1); // from getPort() when not listening
  }

  @test async "should change resource from 'off' to 'on' and try to invoke and delete"() {
    let httpServer = new HttpServer(0);

    await httpServer.start();

    let testThing = new ExposedThing(null);
    testThing.name = "test";
    testThing.addProperty("test", { writable: true, type: "string" }, "off");
    testThing.properties.test.forms = [];
    testThing.addAction("test", {}, (input) => { return new Promise<string>( (resolve, reject) => { resolve("TODO"); }); });
    testThing.actions.test.forms = [];

    await httpServer.expose(testThing);

    let uri = `http://localhost:${httpServer.getPort()}/test`;
    let body;

    body = await rp.get(uri+"/properties/test");
    expect(body).to.equal("\"off\"");

    body = await rp.put(uri+"/properties/test", { body: "on" });
    expect(body).to.equal("");

    body = await rp.get(uri+"/properties/test");
    expect(body).to.equal("\"on\"");

    body = await rp.post(uri+"/actions/test", { body: "toggle" });
    expect(body).to.equal("\"TODO\"");
    
    return httpServer.stop();
  }

  @test async "should cause EADDRINUSE error when already running"() {
    let httpServer1 = new HttpServer(0);

    await httpServer1.start();
    expect(httpServer1.getPort()).to.be.above(0);

    let httpServer2 = new HttpServer(httpServer1.getPort());

    try {
      await httpServer2.start(); // should fail
    } catch (err) {
      console.log("HttpServer failed correctly on EADDRINUSE");
      assert(true);
    };

    expect(httpServer2.getPort()).to.eq(-1);

    let uri = `http://localhost:${httpServer1.getPort()}/`;

    rp.get(uri).then(async body => {
      expect(body).to.equal("One");

      await httpServer1.stop();
      await httpServer2.stop();
    });
  }
}
