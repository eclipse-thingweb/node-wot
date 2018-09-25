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
  // internal state, not exposed as Property
  var counter = 0;

  var thing = WoT.produce({ name: "EventSource" });
  // manually add Interactions
  thing.addAction(
    "reset",
    {
      // no input, no output
    },
    () => {
      console.info("Resetting");
      counter = 0;
      return new Promise((resolve, reject) => {
        resolve();
      });
    })
  .addEvent(
    "onchange",
    {
      type: "integer"
    });
  // make available via bindings
  thing.expose().then(() => {
    console.info(thing.name + "ready");
    setInterval( () => {
      ++counter;
      thing.events.onchange.emit(counter);
      console.info("Emitted change", counter);
    }, 5000);
  }).catch((err) => { console.error("Expose error:", err) });
  
} catch (err) {
    console.error("Script error:", err);
}
