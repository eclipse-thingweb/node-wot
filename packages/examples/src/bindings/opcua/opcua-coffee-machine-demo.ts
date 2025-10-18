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
import util from "util";
import { Servient } from "@node-wot/core";
import { OPCUAClientFactory } from "@node-wot/binding-opcua";
import { thingDescription } from "./opcua-coffee-machine-thing-description";

const pause = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
    const servient = new Servient();
    servient.addClientFactory(new OPCUAClientFactory());

    const wot = await servient.start();

    const thing = await wot.consume(thingDescription);

    let lastTemperature = NaN;
    let lastWaterTankLevel = NaN;
    let lastCoffeeBeanLevel = NaN;
    let lastCurrentState = NaN;
    let lastGrindingDuration = NaN;
    let lastGrinderStatus = NaN;
    let lastHeaterStatus = NaN;
    let lastPumpStatus = NaN;
    let lastValveStatus = NaN;

    const recordedActions: string[] = [];
    const recordAction = (actionName: string) => {
        recordedActions.push(`${new Date().toISOString()} - ${actionName}`);
    };
    process.stdout.write("\x1Bc"); // clear console
    process.stdout.write("\x1B[?25l"); // hide cursor
    const currentStateEnum = ["Off", "Standby", "Error", "Cleaning", "Serving Coffee", "Under Maintenance"];
    const grinderStates = ["Off", "On", "Jammed", "Malfunctioning"];
    const heaterStates = ["Off", "Heating", "Ready", "Malfunctioning"];
    const pumpStates = ["Off", "On", "Malfunctioning"];
    const valveStates = ["Open", "Opening", "Close", "Closing", "Malfunctioning"];

    const waitingMachineCoffeeStandByState = async () => {
        await pause(1000);
        let state = lastCurrentState;
        while (state !== 1) {
            // Standby
            await pause(1000);
            state = lastCurrentState;
        }
    };
    const writeLine = (...args: unknown[]) => {
        process.stdout.write(util.format(...args) + "                         \n");
    };
    const displayOnlineStatus = () => {
        process.stdout.write("\x1B[1;1H"); // move cursor to top left
        writeLine(`======== Coffee Machine Status ======== ${new Date().toISOString()}`);
        writeLine(
            `  🔄   Current State      : ${
                isNaN(lastCurrentState) ? "n/a" : (currentStateEnum[lastCurrentState] ?? lastCurrentState)
            }`
        );
        writeLine(
            `  🔥   Heater Status      : ${
                isNaN(lastHeaterStatus) ? "n/a" : (heaterStates[lastHeaterStatus] ?? lastHeaterStatus)
            }`
        );
        writeLine(
            `  🌡️   Boiler Temperature  : ${isNaN(lastTemperature) ? "n/a" : lastTemperature.toFixed(2) + " °C"}`
        );
        writeLine(
            `  🚰   Pump Status        : ${
                isNaN(lastPumpStatus) ? "n/a" : (pumpStates[lastPumpStatus] ?? lastPumpStatus)
            }`
        );
        writeLine(
            `  🚪   Valve Status       : ${
                isNaN(lastValveStatus) ? "n/a" : (valveStates[lastValveStatus] ?? lastValveStatus)
            }`
        );
        writeLine(
            `  💧   Water Tank Level   : ${isNaN(lastWaterTankLevel) ? "n/a" : lastWaterTankLevel.toFixed(2) + " ml"}`
        );
        writeLine(
            `  ⚙️    Grinder Status     : ${
                isNaN(lastGrinderStatus) ? "n/a" : (grinderStates[lastGrinderStatus] ?? lastGrinderStatus)
            }`
        );
        writeLine(
            `  ⏱️    Grinding Duration  : ${
                isNaN(lastGrindingDuration) ? "n/a" : lastGrindingDuration.toFixed(2) + " s"
            }`
        );
        writeLine(
            `  ☕   Coffee Bean Level  : ${isNaN(lastCoffeeBeanLevel) ? "n/a" : lastCoffeeBeanLevel.toFixed(2) + " g"}`
        );
        writeLine("========================================");
        writeLine("---- Recorded Actions (last 5) ----");
        recordedActions
            .slice(-5)
            .forEach((action) => writeLine(action + "                                                        "));
        writeLine("-----------------------------------");
    };
    try {
        thing
            .observeProperty("waterTankLevel", async (data) => {
                lastWaterTankLevel = (await data.value()) as number;
                displayOnlineStatus();
            })
            .catch((err) => {
                console.error("Error observing waterTankLevel property:", err);
            });
        thing
            .observeProperty("coffeeBeanLevel", async (data) => {
                lastCoffeeBeanLevel = (await data.value()) as number;
                displayOnlineStatus();
            })
            .catch((err) => {
                console.error("Error observing coffeeBeanLevel property:", err);
            });
        thing
            .observeProperty("temperature", async (data) => {
                lastTemperature = (await data.value()) as number;
                displayOnlineStatus();
            })
            .catch((err) => {
                console.error("Error observing temperature property:", err);
            });
        thing
            .observeProperty("currentState", async (data) => {
                lastCurrentState = (await data.value()) as number;
                displayOnlineStatus();
            })
            .catch((err) => {
                console.error("Error observing currentState property:", err);
            });
        thing
            .observeProperty("grinderStatus", async (data) => {
                lastGrinderStatus = (await data.value()) as number;
                displayOnlineStatus();
            })
            .catch((err) => {
                console.error("Error observing grinderStatus property:", err);
            });
        thing
            .observeProperty("grindingDuration", async (data) => {
                lastGrindingDuration = (await data.value()) as number;
                displayOnlineStatus();
            })
            .catch((err) => {
                console.error("Error observing grindingDuration property:", err);
            });
        thing
            .observeProperty("heaterStatus", async (data) => {
                lastHeaterStatus = (await data.value()) as number;
                displayOnlineStatus();
            })
            .catch((err) => {
                console.error("Error observing heaterStatus property:", err);
            });
        thing
            .observeProperty("pumpStatus", async (data) => {
                lastPumpStatus = (await data.value()) as number;
                displayOnlineStatus();
            })
            .catch((err) => {
                console.error("Error observing pumpStatus property:", err);
            });
        thing
            .observeProperty("valveStatus", async (data) => {
                lastValveStatus = (await data.value()) as number;
                displayOnlineStatus();
            })
            .catch((err) => {
                console.error("Error observing valveStatus property:", err);
            });

        // give some time to gather initial values
        await pause(2000);
        await waitingMachineCoffeeStandByState();
        recordAction("Machine is ready !");

        await pause(10000);

        recordAction("Invoking brewCoffee(Mocha) action...");
        await thing.invokeAction("brewCoffee", { RecipeName: "Mocha" });
        await waitingMachineCoffeeStandByState();
        recordAction("Coffee is ready !");

        await pause(10000);

        recordAction("Invoking brewCoffee(Americano) action...");
        await thing.invokeAction("brewCoffee", { RecipeName: "Americano" });
        await waitingMachineCoffeeStandByState();
        recordAction("Coffee is ready !");

        await pause(10000);

        recordAction("Invoking fillTank action...");
        await thing.invokeAction("fillTank");
        await waitingMachineCoffeeStandByState();
        recordAction("Tank is refilled !");
        recordAction("Done !");
    } finally {
        await servient.shutdown();
    }
})().catch((err) => {
    console.error("Script error:", err);
});
