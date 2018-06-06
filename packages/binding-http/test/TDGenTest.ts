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
 * Basic test suite for TD parsing
 */

import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import { expect, should } from "chai";
// should must be called to augment all variables
should();

import Servient from "@node-wot/core";
import ExposedThing from "@node-wot/core";
import { ContentCodec } from "@node-wot/core";
import { ProtocolServer } from "@node-wot/core";
import * as Helpers from "@node-wot/core";

import * as TD from "@node-wot/td-tools";

import HttpServer from "../src/http-server";

@suite("TD Generation")
class TDGeneratorTest {
  @test "TD generation test"() {

    let servient: Servient = new Servient();
    servient.addServer(new HttpServer());
    servient.start().then(WoT => {

      let thing: WoT.ExposedThing = WoT.produce({ name: "TDGeneratorTest" });

      thing.addProperty({
        name: "prop1",
        schema: `{ "type": "number" }`
      });
      thing.addAction({
        name: "act1",
        inputSchema: `{ "type": "string" }`
      });

      let td: TD.Thing = TD.parseTDString(thing.getThingDescription());

      expect(td).to.have.property("name").that.equals("TDGeneratorTest");

      let add = Helpers.getAddresses()[0];
      let ser: Array<ProtocolServer> = servient.getServers();

      expect(ser).to.be.an('Array').with.length.above(0)
      expect(td.interaction[0]).to.have.property("name").that.include("prop1");
      expect(td.interaction[1]).to.have.property("name").that.include("act1");
      expect(td.interaction[0]).to.have.property("semanticType").that.include("Property");
      expect(td.interaction[1]).to.have.property("semanticType").that.include("Action");

      if (ser[0].getPort() !== -1) {
        expect(td.interaction[0].form[0]).to.have.property("mediaType").that.equals("application/json");
        expect(td.interaction[0].form[0]).to.have.property("href").that.equals("http://" + add + ":" + ser[0].getPort() + "/TDGeneratorTest/properties/prop1");
        expect(td.interaction[1].form[0]).to.have.property("mediaType").that.equals("application/json");
        expect(td.interaction[1].form[0]).to.have.property("href").that.equals("http://" + add + ":" + ser[0].getPort() + "/TDGeneratorTest/actions/act1");
      }
    });
  }
}
