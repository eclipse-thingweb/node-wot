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

console.info("Run this sample without cli.js script!");

let servient_lib = require("../../packages/core/dist/servient");
let mqttBrokerServer_lib = require("../../packages/binding-mqtt/dist/mqtt-broker-server");
let mqttClientFactory_lib = require("../../packages/binding-mqtt/dist/mqtt-client-factory");

var counter = 0;

let servient = new servient_lib.default();
// setup the broker connection
let broker = new mqttBrokerServer_lib.MqttBrokerServer("mqtt://test.mosquitto.org", "1883"); 

servient.addClientFactory(new mqttClientFactory_lib.default());
servient.addServer(broker);

servient.start().then(wotFactory => {
    let thing = wotFactory.produce({ name: "Test" });
    
    thing.addEvent("event1", {type: "number"});
    thing.addAction("resetCounter");

    // add action handler for the topic reset counter
    thing.setActionHandler(
        "resetCounter",
        () => {
        console.log("Resetting counter");
        counter = 0;
        return ;
    });
    
    thing.expose();

    setInterval( async () => {
        ++counter;
        thing.events.event1.emit(counter); // sends data to the topic /Test/events/event1

        console.info("Emitted change", counter);
    }, 5000);

});
