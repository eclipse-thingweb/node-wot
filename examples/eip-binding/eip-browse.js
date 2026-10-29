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

// Browses a Logix controller, prints the generated Thing Description and reads every property once.
// Run from the repository root after `npm run build`:
//   node examples/eip-binding/eip-browse.js [eip://192.168.100.218/1,0/] [output.td.jsonld]

const fs = require("fs");
const { Servient } = require("@node-wot/core");
const { EipClientFactory, browseController } = require("@node-wot/binding-eip");

async function main() {
    const uri = process.argv[2] ?? "eip://192.168.100.218/1,0/";
    const output = process.argv[3];

    // browseController reports the tags it left out; WoT.requestThingDescription only logs them.
    const { skipped } = await browseController(uri);
    for (const tag of skipped) console.log(`skipped ${tag.name}: ${tag.reason}`);

    const servient = new Servient();
    servient.addClientFactory(new EipClientFactory());
    const WoT = await servient.start();

    try {
        const td = await WoT.requestThingDescription(uri);
        if (output !== undefined) fs.writeFileSync(output, JSON.stringify(td, null, 2));
        else console.log(JSON.stringify(td, null, 2));

        const thing = await WoT.consume(td);
        for (const name of Object.keys(td.properties)) {
            const value = await (await thing.readProperty(name)).value();
            console.log(name, "=", JSON.stringify(value));
        }
    } finally {
        await servient.shutdown();
    }
}

main().catch((err) => {
    console.error("Script error:", err);
    process.exitCode = 1;
});
