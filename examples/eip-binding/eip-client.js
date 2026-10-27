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

// Reads and observes the tags of the Rockwell controller at 192.168.100.218 (see Rockwell.td.jsonld).
// Run from the repository root after `npm run build`: node examples/eip-binding/eip-client.js

const fs = require("fs");
const path = require("path");
const { Servient } = require("@node-wot/core");
const { EipClientFactory } = require("@node-wot/binding-eip");

const OBSERVE_DURATION_MS = 10000;

async function main() {
    const servient = new Servient();
    servient.addClientFactory(new EipClientFactory());
    const WoT = await servient.start();

    try {
        const td = JSON.parse(fs.readFileSync(path.join(__dirname, "Rockwell.td.jsonld"), "utf8"));
        const thing = await WoT.consume(td);

        for (const name of Object.keys(td.properties)) {
            const output = await thing.readProperty(name);
            console.log(name, "=", JSON.stringify(await output.value()));
        }

        const subscription = await thing.observeProperty(
            "Production_Data",
            async (output) => console.log("Production_Data changed:", JSON.stringify(await output.value())),
            (err) => console.error("Observe error:", err)
        );
        await new Promise((resolve) => setTimeout(resolve, OBSERVE_DURATION_MS));
        await subscription.stop();
    } finally {
        await servient.shutdown();
    }
}

main().catch((err) => {
    console.error("Script error:", err);
    process.exitCode = 1;
});
