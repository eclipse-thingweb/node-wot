/********************************************************************************
 * Copyright (c) 2018 Contributors to the Eclipse Foundation
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

function checkPropertyWrite(expected, actual) {
    let output = "Property " + expected + " written with " + actual;
    if (expected === actual) {
        console.info("PASS: " + output);
    } else {
        throw new Error("FAIL: " + output);
    }
}

function checkActionInvocation(name, expected, actual) {
    let output = "Action " + name + " invoked with " + actual;
    if (expected === actual) {
        console.info("PASS: " + output);
    } else {
        throw new Error("FAIL: " + output);
    }
}

let thing = WoT.produce({
    id: "urn:dev:wot:org:w3:testthing",
    name: "TestThing"
});

console.info(thing.name + " produced");

thing
    .addProperty("bool", { "type": "boolean" }, false)
    .addProperty("int", { "type": "integer" }, 42)
    .addProperty("num", { "type": "number" }, 3.14)
    .addProperty("string", { "type": "string" }, "unset")
    .addProperty("array", { "type": "array" }, [2, "unset"])
    .addProperty(
        "object",
        {
            "type": "object",
            "properties": {
                id: { "type": "integer" },
                name: { "type": "string" }
            }
        },
        { "prop1": 123, "prop2" : "abc" });

// Property checks
thing
    .setPropertyWriteHandler(
        "bool",
        (value) => {
            checkPropertyWrite("boolean", typeof value);
        })
    .setPropertyWriteHandler(
        "int",
        (value) => {
            let inputtype = typeof value;
            if (value === Math.floor(value)) inputtype = "integer";
            checkPropertyWrite("integer", inputtype);
        })
    .setPropertyWriteHandler(
        "num",
        (value) => {
            checkPropertyWrite("number", typeof value);
        })
    .setPropertyWriteHandler(
        "string",
        (value) => {
            checkPropertyWrite("string", typeof value);
        })
    .setPropertyWriteHandler(
        "array",
        (value) => {
            let inputtype = typeof value;
            if (Array.isArray(value)) inputtype = "array";
            checkPropertyWrite("array", inputtype);
        })
    .setPropertyWriteHandler(
        "object",
        (value) => {
            let inputtype = typeof value;
            if (Array.isArray(value)) inputtype = "array";
            checkPropertyWrite("object", inputtype);
        });

// Actions
thing
    .addAction(
        "void-void",
        { },
        (input) => {
            checkActionInvocation("void-void", "undefined", typeof param);
        })
    .addAction(
        "void-int",
        {
            input: { type: "integer" }
        },
        (input) => {
            checkActionInvocation("void-int", "undefined", typeof param);
            return 0;
        })
    .addAction(
        "int-void",
        {
            input: { type: "integer" }
        },
        (input) => {
            let inputtype = typeof input;
            if (input === Math.floor(input)) inputtype = "integer";
            checkActionInvocation("int-void", "integer", inputtype);
        })
    .addAction(
        "int-int",
        {
            input: { type: "integer" },
            output: { type: "integer" }
        },
        (input) => {
            let inputtype = typeof input;
            if (input === Math.floor(input)) inputtype = "integer";
            checkActionInvocation("int-int", "integer", inputtype);
            return input+1;
        })
    .addAction(
        "int-string",
        {
            input: { type: "integer" },
            output: { type: "string" }
        },
        (input) => {
            let inputtype = typeof input;
            if (input === Math.floor(input)) inputtype = "integer";
            checkActionInvocation("int-string", "integer", inputtype);
            if (inputtype=="integer") {
                return new String(input)
                                .replace(/0/g,"zero-")
                                .replace(/1/g,"one-")
                                .replace(/2/g,"two-")
                                .replace(/3/g,"three-")
                                .replace(/4/g,"four-")
                                .replace(/5/g,"five-")
                                .replace(/6/g,"six-")
                                .replace(/7/g,"seven-")
                                .replace(/8/g,"eight-")
                                .replace(/9/g,"nine-");
            } else {
                return "ERROR";
            }
        })
    .addAction(
        "void-complex",
        {
            output: {
                type: "object",
                properties: {
                    prop1: {
                        type: "integer"
                    },
                    prop2: {
                        type: "string"
                    }
                },
                required: [ "prop1", "prop2" ]
            }
        },
        (input) => {
            checkActionInvocation("void-complex", "undefined", typeof input);
            return {"prop1": 123, "prop2" : "abc"};
        })
    .addAction(
        "complex-void",
        {
            input: {
                type: "object",
                properties: {
                    prop1: { type: "integer" },
                    prop2: { type: "string" }
                },
                required: [ "prop1", "prop2" ]
            }
        },
        (input) => {
            checkActionInvocation("complex-void", "object", typeof input);
        });
thing
    .addEvent(
        "on-bool",
        { type: "boolean" })
    .addEvent(
        "on-int",
        { type: "integer" })
    .addEvent(
        "on-num",
        { type: "number" });

thing.expose().then(() => {
    console.info(thing.name + " ready");
}).catch((err) => { console.error("Expose error:", err.message); });
