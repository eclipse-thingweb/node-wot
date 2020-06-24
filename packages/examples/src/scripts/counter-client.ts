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

WoTHelpers.fetch("coap://localhost:5683/counter").then( async (td) => {
    // using await for serial execution (note 'async' in then() of fetch())
    try {
        let thing = await WoT.consume(td);
        console.info("=== TD ===");
        console.info(td);
        console.info("==========");

        // read property #1
        let read1 = await thing.readProperty("count");
        console.info("count value is", read1);

        // increment property #1 (without step)
        await thing.invokeAction("increment");
        let inc1 = await thing.readProperty("count");
        console.info("count value after increment #1 is", inc1);

        // increment property #2 (with step)
        await thing.invokeAction("increment", undefined, {uriVariables: {'step' : 3}});
        let inc2 = await thing.readProperty("count");
        console.info("count value after increment #2 (with step 3) is", inc2);

        // decrement property with formIndex == 2
        await thing.invokeAction("decrement", undefined, { formIndex: 2 });
        let dec1 = await thing.readProperty("count");
        console.info("count value after decrement is", dec1);
    } catch(err) {
        console.error("Script error:", err);
    }

}).catch( (err) => { console.error("Fetch error:", err); });
