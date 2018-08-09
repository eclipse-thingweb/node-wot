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
import { OracleServer } from "@node-wot/binding-oracle";
import { HttpServer } from "@node-wot/binding-http";

// consuming protocols
import { CoapClientFactory } from "@node-wot/binding-coap";
import { FileClientFactory } from "@node-wot/binding-file";

console.debug = () => {};
console.log = () => {};

let servient = new Servient();

servient.addServer(new HttpServer());
servient.addServer(new OracleServer());
servient.addClientFactory(new CoapClientFactory());
servient.addClientFactory(new FileClientFactory());

// get WoT object for privileged script
servient.start().then(async (WoT) => {

  console.info("OracleServient started");


  //let tdPumpP101 = await WoT.fetch("coap://192.168.2.198:5683/PumpP101/td");
  let tdPumpP101 = await WoT.fetch("file://./tdPumpP101.jsonld");
  //let tdValve = await WoT.fetch("coap://192.168.2.199:5683/td");
  let tdValveV102 = await WoT.fetch("file://./tdValveV102.jsonld");

  //let tdUltrasonicSensorB101 = await WoT.fetch("coap://192.168.2.127:5683/UltrasonicSensorB101/td");
  let tdUltrasonicSensorB101 = await WoT.fetch("file://./tdUltrasonicSensorB101.jsonld");

  //let tdB113 = await WoT.fetch("coap://192.168.2.136:5683/B113/td");
  let tdB113 = await WoT.fetch("file://./tdB113.jsonld");
  //let tdB114 = await WoT.fetch("coap://192.168.2.136:5683/B114/td");
  let tdB114 = await WoT.fetch("file://./tdB114.jsonld");

  let tdS111 = await WoT.fetch("file://./tdS111.jsonld");
  // S112 Tank102OverflowStatus
  let tdS112 = await WoT.fetch("file://./tdS112.jsonld");
  
  let PumpP101 = WoT.consume(tdPumpP101); // Status
  let ValveV102 = WoT.consume(tdValveV102); // Status

  let UltrasonicSensorB101 = WoT.consume(tdUltrasonicSensorB101); // level
  let B114 = WoT.consume(tdB114); // maxlevel101
  let B113 = WoT.consume(tdB113); // minlevel101

  let S111 = WoT.consume(tdS111); // overflow101
  let S112 = WoT.consume(tdS112); // overflow102

  setInterval( () => {
    PumpP101.properties.Status.read()
      .then( value => {
        console.info("+++ PumpStatus " + value);
        thing.properties.PumpStatus.write(value==="ON"?true:false);
      })
      .catch( err => { console.error("+++ PumpStatus read error: " + err); });

    ValveV102.properties.Status.read()
      .then( value => {
        console.info("+++ ValveStatus " + value);
        thing.properties.ValveStatus.write(value==="OPEN"?true:false);
      })
      .catch( err => { console.error("+++ ValveStatus read error: " + err); });

    UltrasonicSensorB101.properties.level.read()
      .then( value => {
        console.info("+++ Tank102LevelValue " + value);
        thing.properties.Tank102LevelValue.write(value);
      })
      .catch( err => { console.error("+++ Tank102LevelValue read error: " + err); });
    S112.properties.overflow102.read()
    .then( value => {
      console.info("+++ Tank102OverflowStatus " + value);
      thing.properties.Tank102OverflowStatus.write(value);
    })
    .catch( err => { console.error("+++ Tank102OverflowStatus read error: " + err); });

    B114.properties.maxlevel101.read()
      .then( value => {
        console.info("+++ Tank101MaximumLevelStatus " + value);
        thing.properties.Tank101MaximumLevelStatus.write(value);
      })
      .catch( err => { console.error("+++ Tank101MaximumLevelStatus read error: " + err); });
    B113.properties.minlevel101.read()
      .then( value => {
        console.info("+++ Tank101MinimumLevelStatus " + value);
        thing.properties.Tank101MinimumLevelStatus.write(value);
      })
      .catch( err => { console.error("+++ Tank101MinimumLevelStatus read error: " + err); });
    S111.properties.overflow101.read()
      .then( value => {
        console.info("+++ Tank101OverflowStatus " + value);
        thing.properties.Tank101OverflowStatus.write(value);
      })
      .catch( err => { console.error("+++ Tank101OverflowStatus read error: " + err); });

  }, 2000);





  let thing = WoT.produce({ name: "FestoLive" });

  console.info(thing.name + " created");

  thing
    .addProperty("PumpStatus", { type: "boolean", writable: true }, false)

    .addProperty("ValveStatus", { type: "boolean", writable: true }, false)

    // upper tank (102)
    .addProperty("Tank102LevelValue", { type: "number", writable: false }, 0.0)
    .addProperty("Tank102OverflowStatus", { type: "boolean", writable: false }, false)

    // lower tank (101)
    .addProperty("Tank101MaximumLevelStatus", { type: "boolean", writable: false }, false)
    .addProperty("Tank101MinimumLevelStatus", { type: "boolean", writable: false }, false)
    .addProperty("Tank101OverflowStatus", { type: "boolean", writable: false }, false)
    
    // actuators
    .addAction("OpenValve")
    .addAction("CloseValve")
    .addAction("StartPump")
    .addAction("StopPump")

    .setActionHandler("OpenValve", () => {
        return new Promise((resolve, reject) => {
          console.warn(">>> Opening valve!");
          ValveV102.actions.OpenPneumaticValve.invoke()
            .catch( err => { console.error("+++ OpenValve invoke error: " + err); });
          resolve();
        });
      }
    )
    .setActionHandler("CloseValve", () => {
        return new Promise((resolve, reject) => {
          console.warn(">>> Closing valve!");
          ValveV102.actions.ClosePneumaticValve.invoke()
            .catch( err => { console.error("+++ CloseValve invoke error: " + err); });
          resolve();
        });
      }
    )

    .setActionHandler("StartPump", () => {
        return new Promise((resolve, reject) => {
          console.warn(">>> Startung pump!");
          PumpP101.actions.On.invoke()
            .catch( err => { console.error("+++ StartPump invoke error: " + err); });
          resolve();
        });
      }
    )
    .setActionHandler("StopPump", () => {
        return new Promise((resolve, reject) => {
          console.warn(">>> Stopping pump!");
          PumpP101.actions.Off.invoke()
            .catch( err => { console.error("+++ StopPump invoke error: " + err); });
          resolve();
        });
      }
    );

    console.info(thing.name + " ready");

}).catch( err => { console.error("Servient start error: " + err); });
