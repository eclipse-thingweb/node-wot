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
import { OracleServer } from "@node-wot/binding-oracle";
import { HttpServer } from "@node-wot/binding-http";

// consuming protocols
import { CoapClientFactory } from "@node-wot/binding-coap";
import { FileClientFactory } from "@node-wot/binding-file";
import { ConsumedThing } from "wot-typescript-definitions";
import { fstat } from "fs";
var fs = require('fs');

console.debug = () => { };
console.log = () => { };

let servient = new Servient();

servient.addServer(new HttpServer());
servient.addServer(new OracleServer());
servient.addClientFactory(new CoapClientFactory());
servient.addClientFactory(new FileClientFactory());

// get WoT object for privileged script
servient.start().then(async (WoT) => {

  console.info("OracleServient started");

  // choose false for mockup
  var live = false;

  var PumpP101: ConsumedThing, ValveV102: ConsumedThing;

  // exposed Thing toward Oracle IoT Cloud Service
  WoT.produce({
    id: "urn:dev:wot:siemens:festolive",
    name: "FestoLive",
    "iotcs:deviceModel": "urn:com:siemens:wot:festo"
  })
    .then((thing) => {
      if(thing instanceof ExposedThing) {
        let exposedThing : ExposedThing = thing;

      console.info(thing.name + " produced");

      exposedThing
        // actuator state
        .addProperty("PumpStatus", { type: "boolean", readOnly: true }, false)
        .addProperty("ValveStatus", { type: "boolean", readOnly: true }, false)

        // upper tank (102)
        .addProperty("Tank102LevelValue", { type: "number", readOnly: true }, 0.0)
        .addProperty("Tank102OverflowStatus", { type: "boolean", readOnly: true }, false)

        // lower tank (101)
        .addProperty("Tank101MaximumLevelStatus", { type: "boolean", readOnly: true }, false)
        .addProperty("Tank101MinimumLevelStatus", { type: "boolean", readOnly: true }, false)
        .addProperty("Tank101OverflowStatus", { type: "boolean", readOnly: true }, false)

        // actuators
        .addAction("StartPump", {}, () => {
          return new Promise((resolve, reject) => {
            console.info(">>> Startung pump!");
            if (live) PumpP101.invokeAction("on")
              .then(() => { resolve(); })
              .catch((err) => { console.error("+++ StartPump invoke error: " + err); reject(err); });
            resolve();
          });
        })
        .addAction("StopPump", {}, () => {
          return new Promise((resolve, reject) => {
            console.info(">>> Stopping pump!");
            if (live) PumpP101.invokeAction("off")
              .then(() => { resolve(); })
              .catch((err) => { console.error("+++ StopPump invoke error: " + err); reject(err); });
          });
        })
        .addAction("OpenValve", {}, () => {
          return new Promise((resolve, reject) => {
            console.info(">>> Opening valve!");
            if (live) ValveV102.invokeAction("open")
              .then(() => { resolve(); })
              .catch((err) => { console.error("+++ OpenValve invoke error: " + err); reject(err); });
          });
        })
        .addAction("CloseValve", {}, () => {
          return new Promise((resolve, reject) => {
            console.info(">>> Closing valve!");
            if (live) ValveV102.invokeAction("close")
              .then(() => { resolve(); })
              .catch((err) => { console.error("+++ CloseValve invoke error: " + err); reject(err); });
          });
        });

      thing.expose()
        .then(() => { console.info(thing.name + " ready"); })
        .catch((err) => { console.error("Expose error: " + err); });


      if (live) {

        // fetch and consume NodeMCU Things
        let fetchArray = [];
        fetchArray.push(fs.readFileSync("./tdPumpP101.jsonld"), 'utf8');
        fetchArray.push(fs.readFileSync("./tdValveV102.jsonld"), 'utf8');
        fetchArray.push(fs.readFileSync("./tdUltrasonicSensorB101.jsonld"), 'utf8');
        fetchArray.push(fs.readFileSync("./tdB114.jsonld"), 'utf8');
        fetchArray.push(fs.readFileSync("./tdB113.jsonld"), 'utf8');
        fetchArray.push(fs.readFileSync("./tdS111.jsonld"), 'utf8');
        fetchArray.push(fs.readFileSync("./tdS112.jsonld"), 'utf8');
        Promise.all(fetchArray).then((tdArray) => {

          // order must match order of jsonld files
          let [tdPumpP101, tdValveV102, tdUltrasonicSensorB101, tdB114, tdB113, tdS111, tdS112] = tdArray;

          WoT.consume(tdPumpP101) // Status
            .then((PumpP101) => {
              WoT.consume(tdValveV102) // Status
                .then((ValveV102) => {
                  WoT.consume(tdUltrasonicSensorB101) // level
                    .then((UltrasonicSensorB101) => {
                      WoT.consume(tdB114) // maxlevel101
                        .then((LevelSensorB114) => {
                          WoT.consume(tdB113) // minlevel101
                            .then((LevelSensorB113) => {
                              WoT.consume(tdS111) // overflow101
                                .then((LevelSwitchS111) => {
                                  WoT.consume(tdS112) // overflow102
                                    .then((FloatSwitchS112) => {
                                      // regularly sync state to exposed Thing
                                      setInterval(() => {

                                        let readArray = [];
                                        readArray.push(PumpP101.readProperty("status"));
                                        readArray.push(ValveV102.readProperty("status"));
                                        readArray.push(UltrasonicSensorB101.readProperty("levelvalue"));
                                        readArray.push(FloatSwitchS112.readProperty("overflow102"));
                                        readArray.push(LevelSensorB114.readProperty("maxlevel101"));
                                        readArray.push(LevelSensorB113.readProperty("minlevel101"));
                                        readArray.push(LevelSwitchS111.readProperty("overflow101"));
                                        Promise.all(readArray).then((resArray) => {

                                          // order must match order of read interactions
                                          let [pumpStatus, valveStatus, levelvalue102, overflow102, maxlevel101, minlevel101, overflow101] = resArray;

                                          console.info("+++++++++++++++++++++++++++++++++++++++++++++");
                                          console.info("+++ PumpStatus  . . . . . . . " + pumpStatus);
                                          thing.writeProperty("PumpStatus", pumpStatus === "ON" ? true : false);
                                          console.info("+++ ValveStatus . . . . . . . " + valveStatus);
                                          thing.writeProperty("ValveStatus", valveStatus === "OPEN" ? true : false);
                                          console.info("+++ Tank102LevelValue . . . . " + levelvalue102);
                                          thing.writeProperty("Tank102LevelValue", levelvalue102);
                                          console.info("+++ Tank102OverflowStatus . . " + overflow102);
                                          thing.writeProperty("Tank102OverflowStatus", overflow102);
                                          console.info("+++ Tank101MaximumLevelStatus " + maxlevel101);
                                          thing.writeProperty("Tank101MaximumLevelStatus", maxlevel101);
                                          console.info("+++ Tank101MinimumLevelStatus " + minlevel101);
                                          thing.writeProperty("Tank101MinimumLevelStatus", minlevel101);
                                          console.info("+++ Tank101OverflowStatus . . " + overflow101);
                                          thing.writeProperty("Tank101OverflowStatus", overflow101);

                                        }).catch(err => { console.error("+++ NodeMCU read error: " + err); });

                                      }, 5000);
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });

      } else {

        // not live: mock values
        setInterval(() => {
          thing.properties.PumpStatus.write(Math.random() < 0.5 ? true : false);
          thing.properties.ValveStatus.write(Math.random() < 0.5 ? true : false);
          let level102 = Math.random() * 150;
          thing.properties.Tank102LevelValue.write(level102);
          thing.properties.Tank102OverflowStatus.write(level102 > 140);
          let level101 = 150 - level102;
          thing.properties.Tank101MaximumLevelStatus.write(level101 > 100);
          thing.properties.Tank101MinimumLevelStatus.write(level101 > 10);
          thing.properties.Tank101OverflowStatus.write(level101 > 140);
        }, 5000);

      } // live?

    }

    });
}).catch((err) => { console.error("Servient start error: " + err); });
