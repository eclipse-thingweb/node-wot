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
 * Basic test suite for TD parsing
 */

import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import { expect, should } from "chai";
// should must be called to augment all variables
should();

import { Servient, ProtocolServer, Helpers, ExposedThing } from "@node-wot/core";

import * as TD from "@node-wot/td-tools";

import { HttpServer } from "@node-wot/binding-http";

@suite("TD Generation")
class TDGeneratorTest {
  @test async "TD generation test"() {

    let servient: Servient = new Servient();
    servient.addServer(new HttpServer({ port: 60604}));

    Helpers.setStaticAddress("localhost");
    
    let myWoT = await servient.start();

    let thing = await myWoT.produce({
      title: "TDGeneratorTest",
      properties: {
        prop1: { type: "number" }
      },
      actions: {
        act1: { input: { type: "string" } }
      }
    });
    
    await thing.setActionHandler("act1", () => { return new Promise<void>((resolve, reject) => { resolve(); }); });

    await thing.expose();

    let td: TD.Thing = TD.parseTD(JSON.stringify(thing.getThingDescription()));

    expect(td).to.have.property("title").that.equals("TDGeneratorTest");

    let ser: Array<ProtocolServer> = servient.getServers();

    expect(ser).to.be.an('Array').with.length.above(0);
    expect(ser[0].getPort()).to.equal(60604);

    expect(td.properties).to.have.property("prop1");
    expect(td.actions).to.have.property("act1");

    expect(td.properties.prop1).to.have.property("forms");
    expect(td.properties.prop1.forms[0]).to.have.property("contentType").that.equals("application/json");
    expect(td.properties.prop1.forms[0]).to.have.property("href").that.equals("http://localhost:" + ser[0].getPort() + "/TDGeneratorTest/properties/prop1");
    expect(td.actions.act1).to.have.property("forms");
    expect(td.actions.act1.forms[0]).to.have.property("contentType").that.equals("application/json");
    expect(td.actions.act1.forms[0]).to.have.property("href").that.equals("http://localhost:" + ser[0].getPort() + "/TDGeneratorTest/actions/act1");
  }
}
