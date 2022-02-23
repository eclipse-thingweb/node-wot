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

// This is an example of Web of Things consumer ("client" mode) Thing script.
// It considers a fictional smart coffee machine in order to demonstrate the capabilities of Web of Things.
// An accompanying tutorial is available at http://www.thingweb.io/smart-coffee-machine.html.

import { ThingDescription } from "wot-typescript-definitions";
import { Helpers } from "@node-wot/core";
let WoTHelpers: Helpers;

WoTHelpers.fetch("http://127.0.0.1:8080/smart-coffee-machine").then(async (td) => {
    try {
        const thing = await WoT.consume(td as ThingDescription);
        log("Thing Description:", td);

        // Read property allAvailableResources
        let allAvailableResources = await (await thing.readProperty("allAvailableResources")).value();
        log("allAvailableResources value is:", allAvailableResources);

        // Now let's change water level to 80
        await thing.writeProperty("availableResourceLevel", 80, { uriVariables: { id: "water" } });

        // And see that the water level has changed
        const waterLevel = await (
            await thing.readProperty("availableResourceLevel", { uriVariables: { id: "water" } })
        ).value();
        log("waterLevel value after change is:", waterLevel);

        // This can also be seen in allAvailableResources property
        allAvailableResources = await (await thing.readProperty("allAvailableResources")).value();
        log("allAvailableResources value after change is:", allAvailableResources);

        // It's also possible to set a client-side handler for observable properties
        thing.observeProperty("maintenanceNeeded", async (data) => {
            log("maintenanceNeeded property has changed! New value is:", data.value());
        });

        // Now let's make 3 cups of latte!
        const makeCoffee = await thing.invokeAction("makeDrink", undefined, {
            uriVariables: { drinkId: "latte", size: "l", quantity: 3 },
        });
        const makeCoffeep = (await makeCoffee.value()) as Record<string, unknown>;
        if (makeCoffeep.result) {
            log("Enjoy your drink!", makeCoffeep);
        } else {
            log("Failed making your drink:", makeCoffeep);
        }

        // See how allAvailableResources property value has changed
        allAvailableResources = await (await thing.readProperty("allAvailableResources")).value();
        log("allAvailableResources value is:", allAvailableResources);

        // Let's add a scheduled task
        const scheduledTask = await thing.invokeAction("setSchedule", {
            drinkId: "espresso",
            size: "m",
            quantity: 2,
            time: "10:00",
            mode: "everyday",
        });
        const scheduledTaskp = (await scheduledTask.value()) as Record<string, string>;
        log(scheduledTaskp.message, scheduledTaskp);

        // See how it has been added to the schedules property
        const schedules = await await (await thing.readProperty("schedules")).value();
        log("schedules value: ", schedules);

        // Let's set up a handler for outOfResource event
        thing.subscribeEvent("outOfResource", (data) => {
            // Here we are simply logging the message when the event is emitted
            // But, of course, could have a much more sophisticated handler
            log("outOfResource event:", data);
        });
    } catch (err) {
        console.error("Script error:", err);
    }
});

// Print data and an accompanying message in a distinguishable way
function log(msg: string, data: unknown) {
    console.info("======================");
    console.info(msg);
    console.dir(data);
    console.info("======================");
}
