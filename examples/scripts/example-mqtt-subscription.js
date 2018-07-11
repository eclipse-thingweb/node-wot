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

let td = 
`{
    "name": "MQTT Counter",
    "id": "urn:dev:wot:mqtt:counter",
    "actions" : {
        "resetCounter": {
            "forms": [
                {"href": "mqtt://test.mosquitto.org:1883/Test/actions/resetCounter",  "mqtt:qos":  0, "mqtt:retain" : false}
            ]
        }
    }, 
    "events": {
        "temperature": {
            "type": "integer",
            "forms": [
                {"href": "mqtt://test.mosquitto.org:1883/Test/events/event1",  "mqtt:qos":  0, "mqtt:retain" : false}
            ]
        } 
    } 
}`;

try {
    let source = WoT.consume(td);
    console.info("=== TD ===");
    console.info(td);
    console.info("==========");

    source.events.temperature.subscribe(
            x => {
                console.info("value:", x);
            },
            e => console.log("onError: %s", e),
            () => {
                console.log("onCompleted");
            }
        );
    console.info("Subscribed");


    setInterval( async () => {
        source.actions.resetCounter.run("").then( (res) => {

        }).catch( (err) => {
            console.error("ResetCounter error:", err.message);
        });

        console.info("Reset counter!",);
    }, 20000);


} catch(err) {
    console.log("Script error: " + err);
  }
