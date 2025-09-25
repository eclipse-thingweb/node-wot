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
import { OPCUAClientFactory } from "@node-wot/binding-opcua";
import { thingDescription } from "./opcua-coffee-machine-thing-description";

const pause = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
    const servient = new Servient();
    servient.addClientFactory(new OPCUAClientFactory());

    const wot = await servient.start();
    const thing = await wot.consume(thingDescription);

    try {
        thing
            .observeProperty("waterTankLevel", async (data) => {
                const waterTankLevel = await data.value();
                console.log("------------------------------");
                console.log("tankLevel : ", waterTankLevel, "ml");
                console.log("------------------------------");
            })
            .catch((err) => {
                console.error("Error observing waterTankLevel property:", err);
            });
        thing
            .observeProperty("coffeeBeanLevel", async (data) => {
                const coffeBeanLevel = await data.value();
                console.log("------------------------------");
                console.log("bean level : ", coffeBeanLevel, "g");
                console.log("------------------------------");
            })
            .catch((err) => {
                console.error("Error observing coffeeBeanLevel property:", err);
            });

        await thing.invokeAction("brewCoffee", { CoffeeType: 1 });
        await pause(5000);
        await thing.invokeAction("brewCoffee", { CoffeeType: 0 });
        await pause(5000);

        await thing.invokeAction("fillTank");
        await pause(5000);
    } finally {
        await servient.shutdown();
    }
})().catch((err) => {
    console.error("Script error:", err);
});
