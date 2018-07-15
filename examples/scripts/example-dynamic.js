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
  var thing = WoT.produce({ name: "DynamicThing" });
  // manually add Interactions
  thing
    .addAction("addProperty")
    .setActionHandler(
      "addProperty",
      () => {
        console.log("Adding Property");
        thing.addProperty("dynProperty", { type: "string" }, "available");
        return new Promise((resolve, reject) => { resolve(); });
      })
    .addAction("remProperty")
    .setActionHandler(
      "remProperty",
      () => {
        console.log("Removing Property");
        thing.removeProperty("dynProperty");
        return new Promise((resolve, reject) => { resolve(); });
      });
  
  thing.expose();
  
} catch (err) {
   console.log("Script error: " + err);
}
