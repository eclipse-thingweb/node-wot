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

const core_1 = require("@node-wot/core");
const binding_http_1 = require("@node-wot/binding-http");
const binding_coap_1 = require("@node-wot/binding-coap");
// create Servient and add HTTP/CoAP binding
const servient = new core_1.Servient();
servient.addClientFactory(new binding_http_1.HttpClientFactory());
servient.addClientFactory(new binding_coap_1.CoapClientFactory());
const wotHelper = new core_1.Helpers(servient);
console.log = () => {
    /* empty */
};
console.debug = () => {
    /* empty */
};
async function testPropertyRead(thing, name) {
    try {
        const res = await thing.readProperty(name);
        const value = await res.value();
        console.info("PASS " + name + " READ:", value);
    } catch (err) {
        if (err instanceof Error) {
            console.error("FAIL " + name + " READ:", err.message);
        } else {
            console.error("FAIL " + name + " READ:", err);
        }
    }
}
async function testPropertyWrite(thing, name, value, shouldFail) {
    const displayValue = JSON.stringify(value);
    try {
        await thing.writeProperty(name, value);
        if (!shouldFail) console.info("PASS " + name + " WRITE (" + displayValue + ")");
        else console.error("FAIL " + name + " WRITE: (" + displayValue + ")");
    } catch (err) {
        if (!shouldFail) {
            if (err instanceof Error) {
                console.error("FAIL " + name + " WRITE (" + displayValue + "):", err.message);
            } else {
                console.error("FAIL " + name + " WRITE (" + displayValue + "):", err);
            }
        } else {
            if (err instanceof Error) {
                console.info("PASS " + name + " WRITE (" + displayValue + "):", err.message);
            } else {
                console.info("PASS " + name + " WRITE (" + displayValue + "):", err);
            }
        }
    }
}
wotHelper
    .fetch("http://localhost:8080/testthing")
    .then(async (td) => {
        // using await for serial execution (note 'async' in then() of fetch())
        try {
            const thing = await WoT.consume(td);
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
            await testPropertyRead(thing, "num");
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
            await testPropertyWrite(thing, "object", null, true);
            await testPropertyWrite(thing, "object", [24, "dark"], true);
        } catch (err) {
            console.error("Script error:", err);
        }
    })
    .catch((err) => {
        console.error("Fetch error:", err);
    });
