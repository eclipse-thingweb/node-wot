/********************************************************************************
 * Copyright (c) 2020 Contributors to the Eclipse Foundation
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
import { Helpers } from "@node-wot/core";
let WoTHelpers: Helpers;

let td = `{
    "@context": "https://www.w3.org/2019/wot/td/v1",
    "title": "MQTT Counter",
    "id": "urn:dev:wot:mqtt:counter",
    "securityDefinitions": { "nosec_sc": { "scheme": "nosec" }},
    "security": "nosec_sc",
    "actions" : {
        "resetCounter": {
            "forms": [
                {"href": "mqtt://test.mosquitto.org:1883/MQTT-Test/actions/resetCounter"}
            ]
        }
    }, 
    "events": {
        "counter": {
            "data": {
                "type": "integer"
            },
            "forms": [
                {"href": "mqtt://test.mosquitto.org:1883/MQTT-Test/events/counterEvent"}
            ]
        } 
    } 
}`;

try {
    WoT.consume(JSON.parse(td)).then((source) => {
        console.info("=== TD ===");
        console.info(td);
        console.info("==========");

        source
            .subscribeEvent("counter", (x: any) => {
                console.info("value:", x);
            })
            .then(() => {
                console.info("Completed");
            })
            .catch((e: any) => {
                console.error("Error: %s", e);
            });

        setInterval(async () => {
            source
                .invokeAction("resetCounter")
                .then((res) => {})
                .catch((err) => {
                    console.error("ResetCounter error:", err.message);
                });
            console.info("Reset counter!");
        }, 20000);
    });
} catch (err) {
    console.error("Script error: " + err);
}
