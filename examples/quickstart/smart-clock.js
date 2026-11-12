"use strict";
/********************************************************************************
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
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
Object.defineProperty(exports, "__esModule", { value: true });
// This is an example Thing which is a smart clock that runs 60 times faster than real time, where 1 hour happens in 1 minute.
const core_1 = require("@node-wot/core");
const binding_coap_1 = require("@node-wot/binding-coap");
// create Servient add CoAP binding with port configuration
const servient = new core_1.Servient();
servient.addServer(new binding_coap_1.CoapServer({ port: 5686 }));
core_1.Helpers.setStaticAddress("plugfest.thingweb.io"); // comment this out if you are testing locally
let minuteCounter = 0;
let hourCounter = 0;
async function timeCount(thing) {
    for (minuteCounter = 0; minuteCounter < 59; minuteCounter++) {
        // if we have <60, we can get a 15:60.
        await new Promise((resolve) => setTimeout(resolve, 1000)); // sleep
        thing.emitPropertyChange("time");
    }
    console.info({
        hour: hourCounter,
        minute: minuteCounter,
    });
    hourCounter++;
    if (hourCounter === 24) {
        hourCounter = 0;
    }
}
servient.start().then((WoT) => {
    WoT.produce({
        title: "Smart Clock",
        description: "a smart clock that runs 60 times faster than real time, where 1 hour happens in 1 minute.",
        support: "https://github.com/eclipse-thingweb/node-wot/",
        "@context": "https://www.w3.org/2022/wot/td/v1.1",
        properties: {
            time: {
                readOnly: true,
                observable: true,
                type: "object",
                properties: {
                    minute: {
                        type: "integer",
                        minimum: 0,
                        maximum: 59,
                    },
                    hour: {
                        type: "integer",
                        minimum: 0,
                        maximum: 23,
                    },
                },
            },
        },
    })
        .then(async (thing) => {
            console.log("Produced " + thing.getThingDescription().title);
            thing.setPropertyReadHandler("time", async () => {
                return {
                    hour: hourCounter,
                    minute: minuteCounter,
                };
            });
            timeCount(thing);
            setInterval(async () => {
                timeCount(thing);
                thing.emitPropertyChange("time");
            }, 61000); // if this is 60s, we never leave the for loop
            // expose the thing
            thing.expose().then(() => {
                console.info(thing.getThingDescription().title + " ready");
            });
        })
        .catch((e) => {
            console.log(e);
        });
});
