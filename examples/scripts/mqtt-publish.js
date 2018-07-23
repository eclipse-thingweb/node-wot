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
    var counter  = 0;
    var thing = WoT.produce({ 
        name: "MQTT-Test",
        description: "Tests a MQTT client that published counter values as an WoT event and subscribes the resetCounter topic as WoT action to reset the own counter."
    });

    console.log("Setup MQTT broker address/port details in wot-servient.conf.json (also see sample in wot-servient.conf.json_mqtt)!");

    // manually add Interactions
    thing
      .addAction("resetCounter")
      .addEvent(
        "counterEvent",
        {
          type: "integer" 
        });
    
    thing.setActionHandler(
      "resetCounter",
      () => {
        console.log("Resetting counter");
        counter = 0;
        return;
      });
    
    thing.expose();
    
    setInterval( async () => {
        ++counter;
        thing.events.counterEvent.emit(counter);
        console.info("New counter", counter);

    }, 1000);
    
  } catch (err) {
     console.log("Script error: " + err);
  }
