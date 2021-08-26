/********************************************************************************
 * Copyright (c) 2020 - 2021 Contributors to the Eclipse Foundation
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
import { Servient, ExposedThing } from "@node-wot/core";
// exposed protocols
import { FujitsuServer } from "@node-wot/binding-fujitsu";
import { HttpServer } from "@node-wot/binding-http";

// consuming protocols
import { CoapClientFactory } from "@node-wot/binding-coap";
import { FileClientFactory } from "@node-wot/binding-file";
import { TDRepository } from "@node-wot/td-tools";

let servient = new Servient();

servient.addServer(new HttpServer());
servient.addServer(new FujitsuServer("ws://wot.f-ncs.ad.jp/websocket/"));
servient.addClientFactory(new CoapClientFactory());
servient.addClientFactory(new FileClientFactory());

// get WoT object for privileged script
servient.start().then(async (WoT) => {

  console.info("FujitsuLocalProxy started");

  WoT.produce({
      id: "urn:dev:wot:siemens:festofake",
      title: "FestoFake"
    }
  )
    .then((thing) => {
      if(thing instanceof ExposedThing) {
        let exposedThing : ExposedThing = thing;

        console.info(exposedThing.title + " produced");

        exposedThing.addProperty("PumpStatus", { type: "boolean", readOnly: true }, false);
        exposedThing.addProperty("ValveStatus", { type: "boolean", readOnly: true }, false);
    
        // upper tank (102)
        exposedThing.addProperty("Tank102LevelValue", { type: "number", readOnly: true }, 0.0);
        exposedThing.addProperty("Tank102OverflowStatus", { type: "boolean", readOnly: true }, false);
    
        // lower tank (101)
        exposedThing.addProperty("Tank101MaximumLevelStatus", { type: "boolean", readOnly: true }, false);
        exposedThing.addProperty("Tank101MinimumLevelStatus", { type: "boolean", readOnly: true }, false);
        exposedThing.addProperty("Tank101OverflowStatus", { type: "boolean", readOnly: true }, false);
        
        // actuators
        exposedThing.addAction("StartPump", {}, () => {
            return new Promise((resolve, reject) => {
              console.warn(">>> Startung pump!");
              resolve();
            });
          });
          exposedThing.addAction("StopPump", {}, () => {
            return new Promise((resolve, reject) => {
              console.warn(">>> Stopping pump!");
              resolve();
            });
          });
          exposedThing.addAction("OpenValve", {}, () => {
            return new Promise((resolve, reject) => {
              console.warn(">>> Opening valve!");
              resolve();
            });
          });
          exposedThing.addAction("CloseValve", {}, () => {
            return new Promise((resolve, reject) => {
              console.warn(">>> Closing valve!");
              resolve();
            });
          });

          exposedThing.expose()
          .then(() => { console.info(exposedThing.name + " ready"); })
          .catch((err) => { console.error("Expose error: " + err); });

        }
    
    });


}).catch( err => { console.error("Servient start error: " + err); });
