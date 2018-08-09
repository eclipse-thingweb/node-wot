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

try {
  var thing = WoT.produce({ name: "tempSensor" });
  // manually add Interactions
  thing
    .addProperty(
      "temperature",
      {
        type: "number"
      },
      0.0)
    .addProperty(
      "max",
      {
        type: "number"
      },
      0.0)
    .addAction("reset")
    .addEvent(
      "onchange",
      {
        type: "number" 
      });
  
  // add server functionality
  thing.setActionHandler(
    "reset",
    () => {
      console.log("Resetting maximum");
      return thing.properties.max.write(0.0);
    });
  
  thing.expose();
  
  setInterval( async () => {
    let mock = Math.random()*100;
    thing.properties.temperature.write(mock);
    let old = await thing.properties.max.read();
    if (old < mock) {
      thing.properties.max.write(mock);
      thing.events.onchange.emit();
    }
  }, 1000);
  
} catch (err) {
   console.log("Script error: " + err);
}
