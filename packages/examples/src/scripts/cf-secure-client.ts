/********************************************************************************
 * Copyright (c) 2018 - 2020 Contributors to the Eclipse Foundation
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

import "wot-typescript-definitions"
import { Helpers } from "@node-wot/core";

let WoT:WoT.WoT;
let WoTHelpers: Helpers;

 /**
  * To test this client, run the Californium CoAPS example server
  * (https://github.com/eclipse/californium/tree/master/demo-apps/cf-secure)
  */

 WoTHelpers.fetch("file://./cf-sandbox.jsonld").then( async (td) => {
    try {
        let cf = await WoT.consume(td);
        console.info("=== TD ===");
        console.info(td);
        console.info("==========");

        cf.readProperty("test").then( (res) => {
            console.info("Received:", res);
        }).catch( (err) => {
            console.error("Script error:", err.message);
        });

    } catch(err) {
        console.error("Script error:", err);
    }
}).catch( (err) => { console.error("Fetch error:", err); });
