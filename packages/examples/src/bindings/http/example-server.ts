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

import { Servient } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";

// create Servient add HTTP binding with port configuration
const servient = new Servient();
servient.addServer(
    new HttpServer({
        port: 8081, // (default 8080)
    })
);

servient.start().then((WoT) => {
    WoT.produce({
        title: "MyCounter",
        properties: {
            count: {
                type: "integer",
            },
        },
    }).then((thing) => {
        // init property value
        let count = 0;

        console.log("Produced " + thing.getThingDescription().title);

        // set property handlers (using async-await)
        thing.setPropertyReadHandler("count", async () => count);
        thing.setPropertyWriteHandler("count", async (intOutput) => {
            const value = await intOutput.value();
            if (typeof value === "number") {
                count = value;
            }
        });

        thing.expose().then(() => {
            console.info(thing.getThingDescription().title + " ready");
            console.info("TD : " + JSON.stringify(thing.getThingDescription()));
        });
    });
});
