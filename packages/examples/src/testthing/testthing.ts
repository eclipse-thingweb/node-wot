/********************************************************************************
 * Copyright (c) 2020 Contributors to the Eclipse Foundation
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
/* eslint  no-console: "off" */

function checkPropertyWrite(expected: string, actual: unknown) {
    const output = "Property " + expected + " written with " + actual;
    if (expected === actual) {
        console.info("PASS: " + output);
    } else {
        throw new Error("FAIL: " + output);
    }
}

function checkActionInvocation(name: string, expected: string, actual: unknown) {
    const output = "Action " + name + " invoked with " + actual;
    if (expected === actual) {
        console.info("PASS: " + output);
    } else {
        throw new Error("FAIL: " + output);
    }
}

// init property values
let bool = false;
let int = 42;
let num = 3.14;
let string = "unset";
let array: unknown[] = [2, "unset"];
let object: Record<string, unknown> = { id: 123, name: "abc" };

WoT.produce({
    title: "TestThing",
    properties: {
        bool: {
            title: "Boolean",
            description: "Property that can be set to true or false",
            type: "boolean",
        },
        int: {
            title: "Integer",
            description: "An integer value that can be read and written",
            type: "integer",
        },
        num: {
            title: "Number",
            description: "A floating point value that can be read and written",
            type: "number",
        },
        string: {
            title: "String",
            description: "A string value that can be read and written",
            type: "string",
        },
        array: {
            title: "Array",
            description: "An Array (List) with no structure that can be read and written",
            type: "array",
            items: {},
        },
        object: {
            title: "Object",
            description: "An object with id and name that can be read and written",
            type: "object",
            properties: {
                id: {
                    title: "ID",
                    description: "Integer identifier",
                    type: "integer",
                },
                name: {
                    title: "Name",
                    description: "Name associated to the identifier",
                    type: "string",
                },
            },
        },
    },
    actions: {
        "void-void": {
            title: "void-void Action",
            description: "Action without input nor output",
        },
        "void-int": {
            title: "void-int Action",
            description: "Action without input, but with integer output",
        },
        "int-void": {
            title: "int-void Action",
            description: "Action with integer input, but without output",
            input: { type: "integer" },
        },
        "int-int": {
            title: "int-int Action",
            description: "Action with integer input and output",
            input: { type: "integer" },
            output: { type: "integer" },
        },
        "int-string": {
            title: "int-string Action",
            description: "Action with integer input and string output",
            input: { type: "integer" },
            output: { type: "string" },
        },
        "void-obj": {
            title: "void-obj Action",
            description: "Action without input, but with object output",
            output: {
                type: "object",
                properties: {
                    prop1: {
                        type: "integer",
                    },
                    prop2: {
                        type: "string",
                    },
                },
                required: ["prop1", "prop2"],
            },
        },
        "obj-void": {
            title: "obj-void Action",
            description: "Action with object input, but without output",
            input: {
                type: "object",
                properties: {
                    prop1: { type: "integer" },
                    prop2: { type: "string" },
                },
                required: ["prop1", "prop2"],
            },
        },
    },
    events: {
        "on-bool": {
            title: "Bool Property Change",
            description: "Event with boolean data that is emitted when the bool property is written to",
            data: { type: "boolean" },
        },
        "on-int": {
            title: "Int Property Change",
            description: "Event with integer data that is emitted when the int property is written to ",
            data: { type: "integer" },
        },
        "on-num": {
            title: "Num Property Change",
            description: "Event with number data that is emitted when the num property is written to",
            data: { type: "number" },
        },
        "on-string": {
            title: "String Property Change",
            description: "Event with number data that is emitted when the string property is written to",
            data: { type: "number" },
        },
        "on-array": {
            title: "Array Property Change",
            description: "Event with number data that is emitted when the array property is written to",
            data: { type: "number" },
        },
        "on-object": {
            title: "Object Property Change",
            description: "Event with number data that is emitted when the object property is written to",
            data: { type: "number" },
        },
    },
})
    .then((thing) => {
        console.log("Produced " + thing.getThingDescription().title);

        // set property read/write handlers
        thing
            .setPropertyWriteHandler("bool", async (value) => {
                const localBool = await value.value();
                checkPropertyWrite("boolean", typeof localBool);
                bool = localBool as boolean;
                thing.emitEvent("on-bool", bool);
            })
            .setPropertyReadHandler("bool", async () => bool)
            .setPropertyWriteHandler("int", async (value) => {
                const localInt = await value.value();
                if (localInt === Math.floor(localInt as number)) {
                    checkPropertyWrite("integer", "integer");
                } else {
                    checkPropertyWrite("integer", typeof value);
                }
                int = localInt as number;
                thing.emitEvent("on-int", int);
            })
            .setPropertyReadHandler("int", async () => int)
            .setPropertyWriteHandler("num", async (value) => {
                const localNum = await value.value();
                checkPropertyWrite("number", typeof localNum);
                num = localNum as number;
                thing.emitEvent("on-num", num);
            })
            .setPropertyReadHandler("num", async () => num)
            .setPropertyWriteHandler("string", async (value) => {
                const localString = await value.value();
                checkPropertyWrite("string", typeof localString);
                string = localString as string;
                thing.emitEvent("on-string", string);
            })
            .setPropertyReadHandler("string", async () => string)
            .setPropertyWriteHandler("array", async (value) => {
                const localArray = await value.value();
                if (Array.isArray(localArray)) {
                    checkPropertyWrite("array", "array");
                } else {
                    checkPropertyWrite("array", typeof localArray);
                }
                array = localArray as unknown[];
                thing.emitEvent("on-array", array);
            })
            .setPropertyReadHandler("array", async () => array)
            .setPropertyWriteHandler("object", async (value) => {
                const localObject = await value.value();
                if (Array.isArray(localObject)) {
                    checkPropertyWrite("object", "array");
                } else {
                    checkPropertyWrite("object", typeof localObject);
                }
                object = localObject as Record<string, unknown>;
                thing.emitEvent("on-object", object);
            })
            .setPropertyReadHandler("object", async () => object);

        // set action handlers
        thing
            .setActionHandler("void-void", async (parameters) => {
                checkActionInvocation("void-void", "undefined", typeof (await parameters.value()));
                return undefined;
            })
            .setActionHandler("void-int", async (parameters) => {
                checkActionInvocation("void-int", "undefined", typeof (await parameters.value()));
                return 0;
            })
            .setActionHandler("int-void", async (parameters) => {
                const localParameters = await parameters.value();
                if (localParameters === Math.floor(localParameters as number)) {
                    checkActionInvocation("int-void", "integer", "integer");
                } else {
                    checkActionInvocation("int-void", "integer", typeof parameters);
                }
                return undefined;
            })
            .setActionHandler("int-int", async (parameters) => {
                const localParameters = await parameters.value();
                if (localParameters === Math.floor(localParameters as number)) {
                    checkActionInvocation("int-int", "integer", "integer");
                } else {
                    checkActionInvocation("int-int", "integer", typeof localParameters);
                }
                return (localParameters as number) + 1;
            })
            .setActionHandler("int-string", async (parameters) => {
                const localParameters = await parameters.value();
                const inputtype = typeof localParameters;
                if (localParameters === Math.floor(localParameters as number)) {
                    checkActionInvocation("int-string", "integer", "integer");
                } else {
                    checkActionInvocation("int-string", "integer", typeof localParameters);
                }

                if (inputtype === "number") {
                    return new String(localParameters)
                        .replace(/0/g, "zero-")
                        .replace(/1/g, "one-")
                        .replace(/2/g, "two-")
                        .replace(/3/g, "three-")
                        .replace(/4/g, "four-")
                        .replace(/5/g, "five-")
                        .replace(/6/g, "six-")
                        .replace(/7/g, "seven-")
                        .replace(/8/g, "eight-")
                        .replace(/9/g, "nine-");
                } else {
                    throw new Error("ERROR");
                }
            })
            .setActionHandler("void-obj", async (parameters) => {
                checkActionInvocation("void-complex", "undefined", typeof (await parameters.value()));
                return { prop1: 123, prop2: "abc" };
            })
            .setActionHandler("obj-void", async (parameters) => {
                checkActionInvocation("complex-void", "object", typeof (await parameters.value()));
                return undefined;
            });

        // expose the thing
        thing
            .expose()
            .then(() => {
                console.info(thing.getThingDescription().title + " ready");
            })
            .catch((err) => {
                console.error("Error exposing thing: " + err);
            });
    })
    .catch((e) => {
        console.log(e);
    });
