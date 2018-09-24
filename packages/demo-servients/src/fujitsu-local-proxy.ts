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

// node-wot implementation of W3C WoT Servient 
import { Servient } from "@node-wot/core";

// exposed protocols
import { FujitsuServer } from "@node-wot/binding-fujitsu";
import { HttpServer } from "@node-wot/binding-http";

// consuming protocols
import { CoapClientFactory } from "@node-wot/binding-coap";
import { FileClientFactory } from "@node-wot/binding-file";

console.debug = () => {};
console.log = () => {};

let servient = new Servient();

servient.addServer(new HttpServer());
servient.addServer(new FujitsuServer("wss://echo.websocket.org/"));
servient.addClientFactory(new CoapClientFactory());
servient.addClientFactory(new FileClientFactory());

// get WoT object for privileged script
servient.start().then(async (WoT) => {

  console.info("FujitsuLocalProxy started");

  let thing = WoT.produce({
      id: "urn:dev:wot:siemens:festolive",
      name: "FestoLive",
      "iotcs:deviceModel": "urn:com:siemens:wot:festolive"
    }
  );

  console.info(thing.name + " produced");

  thing
    .addProperty("PumpStatus", { type: "boolean", writable: false }, false)
    .addProperty("ValveStatus", { type: "boolean", writable: false }, false)

    // upper tank (102)
    .addProperty("Tank102LevelValue", { type: "number", writable: false }, 0.0)
    .addProperty("Tank102OverflowStatus", { type: "boolean", writable: false }, false)

    // lower tank (101)
    .addProperty("Tank101MaximumLevelStatus", { type: "boolean", writable: false }, false)
    .addProperty("Tank101MinimumLevelStatus", { type: "boolean", writable: false }, false)
    .addProperty("Tank101OverflowStatus", { type: "boolean", writable: false }, false)
    
    // actuators
    .addAction("StartPump", {}, () => {
        return new Promise((resolve, reject) => {
          console.warn(">>> Startung pump!");
          resolve();
        });
      })
    .addAction("StopPump", {}, () => {
        return new Promise((resolve, reject) => {
          console.warn(">>> Stopping pump!");
          resolve();
        });
      })
    .addAction("OpenValve", {}, () => {
        return new Promise((resolve, reject) => {
          console.warn(">>> Opening valve!");
          resolve();
        });
      })
    .addAction("CloseValve", {}, () => {
        return new Promise((resolve, reject) => {
          console.warn(">>> Closing valve!");
          resolve();
        });
      });

    thing.expose()
      .then(() => { console.info(thing.name + " ready"); })
      .catch((err) => { console.error("Expose error: " + err); });

}).catch( err => { console.error("Servient start error: " + err); });
