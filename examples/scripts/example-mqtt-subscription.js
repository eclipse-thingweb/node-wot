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
    "name": "Node MCU MQTT Parking Sensor",
    "id": "urn:dev:wot:com:siemens:parking",
    "events": {
        "lightSensor": {
            "type": "integer",
            "forms": [
                {"href": "mqtt://192.168.1.187:1883/lightSensor", "mqtt:qos":  0, "mqtt:retain" : false}
            ]
        },
        "parkingStatus": {
            "type": "boolean",
            "forms": [
                {"href": "mqtt://192.168.1.187:1883/parkingStatus",  "mqtt:qos":  0, "mqtt:retain" : false}
            ]
        },
        "temperature": {
            "type": "integer",
            "forms": [
                {"href": "mqtt://test.mosquitto.org:1883/wot/temperature",  "mqtt:qos":  0, "mqtt:retain" : false}
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

} catch(err) {
    console.log("Script error: " + err);
  }
