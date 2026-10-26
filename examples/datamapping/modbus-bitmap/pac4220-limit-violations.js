"use strict";
/********************************************************************************
 * Copyright (c) 2026 Contributors to the Eclipse Foundation
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

// Run from the repository root after `npm run build`: node examples/datamapping/modbus-bitmap/pac4220-limit-violations.js
const fs = require("fs");
const path = require("path");
const { Servient } = require("@node-wot/core");
const { ModbusClientFactory } = require("@node-wot/binding-modbus");

const td = JSON.parse(fs.readFileSync(path.join(__dirname, "pac4220.td.json"), "utf8"));

async function main() {
    const servient = new Servient();
    servient.addClientFactory(new ModbusClientFactory());
    const wot = await servient.start();

    try {
        const thing = await wot.consume(td);

        const voltage = await (await thing.readProperty("voltageL1N")).value();
        console.log(`Voltage L1-N: ${voltage} V`);

        const raw = await (await thing.readProperty("limitViolationsRaw")).value();
        console.log(`Limit Violations raw: 0x${raw.toString(16).padStart(8, "0")} (${raw})`);

        const flags = await (await thing.readProperty("limitViolations")).value();
        console.log("Limit Violations:", flags);
        const set = Object.entries(flags)
            .filter(([, value]) => value)
            .map(([name]) => name);
        console.log(`Flags set: ${set.length > 0 ? set.join(", ") : "none"}`);
    } finally {
        await servient.shutdown();
    }
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
