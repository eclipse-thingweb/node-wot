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

let WoT: WoT.WoT;

function checkPropertyWrite(expected: any, actual: any) {
    let output = "Property " + expected + " written with " + actual;
    if (expected === actual) {
        console.info("PASS: " + output);
    } else {
        throw new Error("FAIL: " + output);
    }
}

function checkActionInvocation(name: any, expected: any, actual: any) {
    let output = "Action " + name + " invoked with " + actual;
    if (expected === actual) {
        console.info("PASS: " + output);
    } else {
        throw new Error("FAIL: " + output);
    }
}

let bool = false;
let int = 42;
let num = 3.14;
let string = "unset";
let array = [2, "unset"];
let object = { "id": 123, "name": "abc" };

WoT.produce({
    title: "TestThing",
    properties: {
        bool: {
            title: "true/false",
            type: "boolean"
        },
        int: {
            title: "Integer number",
            type: "integer"
        },
        num: {
            title: "Floating point",
            type: "number"
        },
        string: {
            type: "string"
        },
        array: {
            title: "Tuple",
            type: "array",
            items: {}
        },
        object: {
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
        }
    },
    actions: {
        "void-void": {
            title: "void-void Action",
            description: "Action without input nor output"
        },
        "void-int": {
            title: "void-void Action",
            description: "Action without input nor output"
        },
        "int-void": {
            title: "int-void Action",
            description: "Action with integer input, but without output",
            input: { type: "integer" }
        },
        "int-int": {
            title: "int-int Action",
            description: "Action with integer input and output",
            input: { type: "integer" },
            output: { type: "integer" }
        },
        "int-string": {
            title: "int-string Action",
            description: "Action with integer input and string output",
            input: { type: "integer" },
            output: { type: "string" }
        },
        "void-obj": {
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
                required: ["prop1", "prop2"]
            }
        },
        "obj-void": {
            title: "obj-void Action",
            description: "Action with object input, but wihtout output",
            input: {
                type: "object",
                properties: {
                    prop1: { type: "integer" },
                    prop2: { type: "string" }
                },
                required: ["prop1", "prop2"]
            }
        }
    },
    events: {
        "on-bool": {
            title: "on-bool Event",
            description: "Event with boolean data",
            data: { type: "boolean" }
        },
        "on-int": {
            title: "on-int Event",
            description: "Event with integer data",
            data: { type: "integer" }
        },
        "on-num": {
            title: "on-num Event",
            description: "Event with number data",
            data: { type: "number" }
        }
    }
})
    .then((thing) => {
        console.log("Produced " + thing.getThingDescription().title);

        // init property values
        thing.writeProperty("bool", bool);
        thing.writeProperty("int", int);
        thing.writeProperty("num", num);
        thing.writeProperty("string", string);
        thing.writeProperty("array", array);
        thing.writeProperty("object", object);

        // set property handlers
        thing
            .setPropertyWriteHandler("bool", (value) => {
                return new Promise((resolve, reject) => {
                    checkPropertyWrite("boolean", typeof value);
                    bool = value;
                    resolve();
                });
            })
            .setPropertyReadHandler("bool", () => {
                return new Promise((resolve, reject) => {
                    resolve(bool);
                });
            })
            .setPropertyWriteHandler("int", (value) => {
                return new Promise((resolve, reject) => {
                    if (value === Math.floor(value)) {
                        checkPropertyWrite("integer", "integer");
                    } else {
                        checkPropertyWrite("integer", typeof value);
                    }
                    int = value;
                    resolve();
                });
            })
            .setPropertyReadHandler("int", () => {
                return new Promise((resolve, reject) => {
                    resolve(int);
                });
            })
            .setPropertyWriteHandler("num", (value) => {
                return new Promise((resolve, reject) => {
                    checkPropertyWrite("number", typeof value);
                    num = value;
                    resolve();
                });
            })
            .setPropertyReadHandler("num", () => {
                return new Promise((resolve, reject) => {
                    resolve(num);
                });
            })
            .setPropertyWriteHandler("string", (value) => {
                return new Promise((resolve, reject) => {
                    checkPropertyWrite("string", typeof value);
                    string = value;
                    resolve();
                });
            })
            .setPropertyReadHandler("string", () => {
                return new Promise((resolve, reject) => {
                    resolve(string);
                });
            })
            .setPropertyWriteHandler("array", (value) => {
                return new Promise((resolve, reject) => {
                    if (Array.isArray(value)) {
                        checkPropertyWrite("array", "array");
                    } else {
                        checkPropertyWrite("array", typeof value);
                    }
                    array = value;
                    resolve();
                });
            })
            .setPropertyReadHandler("array", () => {
                return new Promise((resolve, reject) => {
                    resolve(array);
                });
            })
            .setPropertyWriteHandler("object", (value) => {
                return new Promise((resolve, reject) => {
                    if (Array.isArray(value)) {
                        checkPropertyWrite("object", "array");
                    } else {
                        checkPropertyWrite("object", typeof value);
                    }
                    object = value;
                    resolve();
                });
            })
            .setPropertyReadHandler("object", () => {
                return new Promise((resolve, reject) => {
                    resolve(object);
                });
            });

        // set action handlers
        thing
            .setActionHandler("void-void", (parameters) => {
                return new Promise((resolve, reject) => {
                    checkActionInvocation("void-void", "undefined", typeof parameters);
                    resolve();
                });
            })
            .setActionHandler("void-int", (parameters) => {
                return new Promise((resolve, reject) => {
                    checkActionInvocation("void-int", "undefined", typeof parameters);
                    resolve(0);
                });
            })
            .setActionHandler("int-void", (parameters) => {
                return new Promise((resolve, reject) => {
                    if (parameters === Math.floor(parameters)) {
                        checkActionInvocation("int-void", "integer", "integer");
                    } else {
                        checkActionInvocation("int-void", "integer", typeof parameters);
                    }
                    resolve();
                });
            })
            .setActionHandler("int-int", (parameters) => {
                return new Promise((resolve, reject) => {
                    let inputtype = typeof parameters;
                    if (parameters === Math.floor(parameters)) {
                        checkActionInvocation("int-int", "integer", "integer");
                    } else {
                        checkActionInvocation("int-int", "integer", typeof parameters);
                    }
                    resolve(parameters + 1);
                });
            })
            .setActionHandler("int-string", (parameters) => {
                return new Promise((resolve, reject) => {
                    let inputtype = typeof parameters;
                    if (parameters === Math.floor(parameters)) {
                        checkActionInvocation("int-string", "integer", "integer");
                    } else {
                        checkActionInvocation("int-string", "integer", typeof parameters);
                    }

                    if (inputtype == "number") {
                        resolve(new String(parameters)
                            .replace(/0/g, "zero-")
                            .replace(/1/g, "one-")
                            .replace(/2/g, "two-")
                            .replace(/3/g, "three-")
                            .replace(/4/g, "four-")
                            .replace(/5/g, "five-")
                            .replace(/6/g, "six-")
                            .replace(/7/g, "seven-")
                            .replace(/8/g, "eight-")
                            .replace(/9/g, "nine-"));
                    } else {
                        reject("ERROR");
                    }
                });
            })
            .setActionHandler("void-obj", (parameters) => {
                return new Promise((resolve, reject) => {
                    checkActionInvocation("void-complex", "undefined", typeof parameters);
                    resolve({ "prop1": 123, "prop2": "abc" });
                });
            })
            .setActionHandler("obj-void", (parameters) => {
                return new Promise((resolve, reject) => {
                    checkActionInvocation("complex-void", "object", typeof parameters);
                    resolve();
                });
            });

        // expose the thing
        thing.expose().then(() => { console.info(thing.getThingDescription().title + " ready"); });
    })
    .catch((e) => {
        console.log(e)
    });