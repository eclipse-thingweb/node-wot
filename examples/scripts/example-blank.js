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
  thing.addProperty({
    name: "temperature",
    value: 0.0,
    schema: '{ "type": "number" }'
    // use default values for the rest
  }).addProperty({
    name: "max",
    value: 0.0,
    schema: '{ "type": "number" }'
    // use default values for the rest
  }).addAction({
    name: "reset",
    // no input, no output
  }).addEvent({
    name: "onchange",
    schema: '{ "type": "number" }'
  });
  // add server functionality
  thing.setActionHandler("reset", () => {
    console.log("Resetting maximum");
    thing.writeProperty("max", 0.0);
  });
  
  thing.start();
  
  setInterval( async () => {
    let mock = Math.random()*100;
    thing.writeProperty("temperature", mock);
    let old = await thing.readProperty("max");
    if (old < mock) {
      thing.writeProperty("max", mock);
      thing.emitEvent("onchange");
    }
  }, 1000);
  
} catch (err) {
   console.log("Script error: " + err);
}
