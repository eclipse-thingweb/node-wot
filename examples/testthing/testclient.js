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

"use strict"

console.log = () => {};

async function fetchTD() {
    let td;
    try {
        td = await WoT.fetch("http://localhost:8080/TestThing");
        return td;
    } catch (err) {
        console.warn("Fetch error: Failed to get TD via HTTP, trying CoAP");
        try {
            td = await WoT.fetch("coap://localhost:5683/TestThing");
            return td;
        } catch (err) {
            console.warn("Fetch error: Failed to get TD via CoAP");
        }
    }
    return null;
}

async function testPropertyRead(name, property) {
    try {
        let res = await property.read();
        console.info("PASS "+name+" READ:", res);
    } catch (err) {
        console.error("FAIL "+name+" READ:", err.message);
    }
}
async function testPropertyWrite(name, property, value, shouldFail) {
    let displayValue = JSON.stringify(value);
    try {
        await property.write(value);
        if (!shouldFail) console.info("PASS "+name+" WRITE ("+displayValue+")");
        else console.error("FAIL "+name+" WRITE: ("+displayValue+")");
    } catch (err) {
        if (!shouldFail) console.error("FAIL "+name+" WRITE ("+displayValue+"):", err.message);
        else console.info("PASS "+name+" WRITE ("+displayValue+"):", err.message);
    }
}

fetchTD().then((td) => {

    let thing = WoT.consume(td);

    testPropertyRead("bool", thing.properties.bool);
    testPropertyWrite("bool", thing.properties.bool, true);
    testPropertyWrite("bool", thing.properties.bool, false);
    testPropertyWrite("bool", thing.properties.bool, "true", true);
    
    testPropertyRead("int", thing.properties.int);
    testPropertyWrite("int", thing.properties.int, 4711);
    testPropertyWrite("int", thing.properties.int, 3.1415, true);
    testPropertyWrite("int", thing.properties.int, "Pi", true);
    
    testPropertyRead("num", thing.properties.num);
    testPropertyWrite("num", thing.properties.num, 4711);
    testPropertyWrite("num", thing.properties.num, 3.1415);
    testPropertyWrite("num", thing.properties.num, "Pi", true);
    
    testPropertyRead("num", thing.properties.string);
    testPropertyWrite("num", thing.properties.string, "testclient");
    testPropertyWrite("num", thing.properties.string, 13, true);
    testPropertyWrite("num", thing.properties.string, null, true);
    
    testPropertyRead("array", thing.properties.array);
    testPropertyWrite("array", thing.properties.array, [23, "illuminated"]);
    testPropertyWrite("array", thing.properties.array, { id: 24, name: "dark"}, true);
    testPropertyWrite("array", thing.properties.array, null, true);
    
    testPropertyRead("object", thing.properties.object);
    testPropertyWrite("object", thing.properties.object, { id: 23, name: "illuminated"});
    testPropertyWrite("object", thing.properties.object, null);
    testPropertyWrite("object", thing.properties.object, [24, "dark"], true);
});
