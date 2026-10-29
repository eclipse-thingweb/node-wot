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

// Lists the EtherNet/IP devices that answer a ListIdentity broadcast on the local network.
// Run from the repository root after `npm run build`: node examples/eip-binding/eip-discover.js [localAddress]

const { discoverControllers } = require("@node-wot/binding-eip");

discoverControllers({ localAddress: process.argv[2] })
    .then((devices) => {
        for (const device of devices) {
            const { productName, revision } = device.identity;
            const browsable = device.controller !== undefined ? `, browse with ${device.baseUri}` : "";
            console.log(`${device.host}  ${productName} ${revision.major}.${revision.minor}${browsable}`);
        }
        if (devices.length === 0) console.log("No device answered.");
    })
    .catch((err) => {
        console.error("Script error:", err);
        process.exitCode = 1;
    });
