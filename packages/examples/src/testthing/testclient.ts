/********************************************************************************
 * Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
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

let WoT: WoT.WoT;
let WoTHelpers: Helpers;

console.log = () => { };
console.debug = () => { };

async function testPropertyRead(thing: WoT.ConsumedThing, name: string) {
    try {
        let res = await thing.readProperty(name);
        console.info("PASS " + name + " READ:", res);
    } catch (err) {
        console.error("FAIL " + name + " READ:", err.message);
    }
}

async function testPropertyWrite(thing: WoT.ConsumedThing, name: string, value: any, shouldFail: boolean) {
    let displayValue = JSON.stringify(value);
    try {
        await thing.writeProperty(name, value);
        if (!shouldFail) console.info("PASS " + name + " WRITE (" + displayValue + ")");
        else console.error("FAIL " + name + " WRITE: (" + displayValue + ")");
    } catch (err) {
        if (!shouldFail) console.error("FAIL " + name + " WRITE (" + displayValue + "):", err.message);
        else console.info("PASS " + name + " WRITE (" + displayValue + "):", err.message);
    }
}


WoTHelpers.fetch("http://localhost:8080/testthing").then(async (td) => {
    // using await for serial execution (note 'async' in then() of fetch())
    try {
        let thing = await WoT.consume(td);
        console.info("=== TD ===");
        console.info(td);
        console.info("==========");
        console.info();

        console.info("========== bool");
        await testPropertyRead(thing, "bool");
        await testPropertyWrite(thing, "bool", true, false);
        await testPropertyWrite(thing, "bool", false, false);
        await testPropertyWrite(thing, "bool", "true", true);

        console.info("========== int");
        await testPropertyRead(thing, "int");
        await testPropertyWrite(thing, "int", 4711, false);
        await testPropertyWrite(thing, "int", 3.1415, true);
        await testPropertyWrite(thing, "int", "Pi", true);

        console.info("========== num");
        await testPropertyRead(thing, "num",);
        await testPropertyWrite(thing, "num", 4711, false);
        await testPropertyWrite(thing, "num", 3.1415, false);
        await testPropertyWrite(thing, "num", "Pi", true);

        console.info("========== string");
        await testPropertyRead(thing, "string");
        await testPropertyWrite(thing, "string", "testclient", false);
        await testPropertyWrite(thing, "string", 13, true);
        await testPropertyWrite(thing, "string", null, true);

        console.info("========== array");
        await testPropertyRead(thing, "array");
        await testPropertyWrite(thing, "array", [23, "illuminated"], false);
        await testPropertyWrite(thing, "array", { id: 24, name: "dark" }, true);
        await testPropertyWrite(thing, "array", null, true);

        console.info("========== object");
        await testPropertyRead(thing, "object");
        await testPropertyWrite(thing, "object", { id: 23, name: "illuminated" }, false);
        await testPropertyWrite(thing, "object", null, false);
        await testPropertyWrite(thing, "object", [24, "dark"], true);

    } catch (err) {
        console.error("Script error:", err);
    }

}).catch((err) => { console.error("Fetch error:", err); });