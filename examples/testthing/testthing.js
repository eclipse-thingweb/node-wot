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
    id: "urn:dev:wot:org:w3:testthing:lyon2018",
    name: "TestThing"
});

console.info(thing.name + " produced");

thing
    .addProperty(
        "bool",
        {
            title: "true/false",
            type: "boolean"
        },
        false)
    .addProperty(
        "int",
        {
            title: "Integer number",
            type: "integer"
        },
        42)
    .addProperty(
        "num",
        {
            title: "Floating point",
            type: "number"
        },
        3.14)
    .addProperty("string", { "type": "string" }, "unset")
    .addProperty(
        "array",
        {
            title: "Tuple",
            type: "array",
            items: {}
        },
        [2, "unset"])
    .addProperty(
        "object",
        {
            title: "ID-name",
            description: "Object with ID and name",
            type: "object",
            properties: {
                id: {
                    title: "ID",
                    description: "Internal identifier",
                    type: "integer"
                },
                name: {
                    title: "Name",
                    description: "Public name",
                    type: "string"
                }
            }
        },
        { "id": 123, "name" : "abc" });

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
        {
            title: "void-void Action",
            description: "Action without input nor output"
        },
        (input) => {
            checkActionInvocation("void-void", "undefined", typeof param);
        })
    .addAction(
        "void-int",
        {
            title: "void-int Action",
            description: "Action without input, but with integer output",
            input: { type: "integer" }
        },
        (input) => {
            checkActionInvocation("void-int", "undefined", typeof param);
            return 0;
        })
    .addAction(
        "int-void",
        {
            title: "int-void Action",
            description: "Action with integer input, but without output",
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
            title: "int-int Action",
            description: "Action with integer input and output",
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
            title: "int-string Action",
            description: "Action with integer input and string output",
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
        "void-obj",
        {
            title: "void-obj Action",
            description: "Action without input, but with object output",
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
        "obj-void",
        {
            title: "obj-void Action",
            description: "Action with object input, but wihtout output",
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
        {
            title: "on-bool Event",
            description: "Event with boolean data",
            data: { type: "boolean" }
        })
    .addEvent(
        "on-int",
        {
            title: "on-int Event",
            description: "Event with integer data",
            data: { type: "integer" }
        })
    .addEvent(
        "on-num",
        {
            title: "on-num Event",
            description: "Event with number data",
            data: { type: "number" }
        });

thing.expose().then(() => {
    console.info(thing.name + " ready");
}).catch((err) => { console.error("Expose error:", err.message); });
