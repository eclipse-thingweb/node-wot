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

let thingDescription = '{ "@context": [ "https://w3c.github.io/wot/w3c-wot-td-context.jsonld", "https://w3c.github.io/wot/w3c-wot-common-context.jsonld" ], "@type": [ "Thing", "Sensor" ], "name": "mySensor", "geo:location": "testspace", "interaction": [ { "@type": [ "Property", "Temperature" ], "name": "prop1", "schema": { "type": "number" }, "saref:TemperatureUnit": "degree_Celsius" } ] }';

// try in case thingDescription or script is erroneous
try {
  // WoT.procude() adds Interactions from TD
  let thing = WoT.produce(thingDescription);
  // add server functionality
  thing.setPropertyReadHandler( (propertyName) => {
    console.log("Handling read request for " + propertyName);
    return new Promise((resolve, reject) => {
      resolve(Math.random(100));
    })
  }, "prop1");
  thing.start();
} catch(err) {
  console.log("Script error: " + err);
}
