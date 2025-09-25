/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
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
/* eslint  no-console: "off" */
import { Servient } from "@node-wot/core";
import { CoapClientFactory } from "@node-wot/binding-coap";

// create Servient and add CoAP binding
const servient = new Servient();
servient.addClientFactory(new CoapClientFactory());

servient
    .start()
    .then(async (WoT) => {
        try {
            const td = await WoT.requestThingDescription("coap://plugfest.thingweb.io:5683/testthing");
            const thing = await WoT.consume(td);

            // read property
            const read1 = await thing.readProperty("string");
            console.log("string value is: ", await read1.value());
        } catch (err) {
            console.error("Script error:", err);
        }
    })
    .catch((err) => {
        console.error("Start error:", err);
    });
