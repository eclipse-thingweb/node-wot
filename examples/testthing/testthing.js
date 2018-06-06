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

WoT.expose({name: "TestThing" })
    .then(function (thing) {
        console.info(thing.name + " running");

        thing.addProperty( {name : "bool", value : false, description: { "type": "boolean" } });
        thing.addProperty( {name : "int", value : 42, description: { "type": "integer" } });
        thing.addProperty( {name : "num", value : 3.14, description: { "type": "number" } });
        thing.addProperty( {name : "string", value : "unset", description: { "type": "string" } });
        thing.addProperty( {name : "array", value : [2, ""], description: { "type": "array" } });
        thing.addProperty( {name : "object",
                            value : {"prop1": 123, "prop2" : "abc"},
                            description: {
                                "type": "object",
                                "field": [
                                    { "name": "id", "value": { "type": "integer" } },
                                    { "name": "name", "value": { "type": "string" } }
                                ]
                            }
                        });

        // Property checks
        thing
            .onUpdateProperty({"request" : {name : "bool"},
                "callback" : (param) => {
                    checkPropertyWrite("boolean", typeof param);
                }
            })
            .onUpdateProperty({"request" : {name : "int"},
                "callback" : (param) => {
                    let inputtype = typeof param;
                    if (param === Math.floor(param)) inputtype = "integer";
                    checkPropertyWrite("integer", inputtype);
                }
            })
            .onUpdateProperty({"request" : {name : "num"},
                "callback" : (param) => {
                    checkPropertyWrite("number", typeof param);
                }
            })
            .onUpdateProperty({"request" : {name : "string"},
                "callback" : (param) => {
                    checkPropertyWrite("string", typeof param);
                }
            })
            .onUpdateProperty({"request" : {name : "array"},
                "callback" : (param) => {
                    let inputtype = typeof param;
                    if (Array.isArray(param)) inputtype = "array";
                    checkPropertyWrite("array", inputtype);
                }
            })
            .onUpdateProperty({"request" : {name : "object"},
                "callback" : (param) => {
                    let inputtype = typeof param;
                    if (Array.isArray(param)) inputtype = "array";
                    checkPropertyWrite("object", inputtype);
                }
            });

        // Actions
        thing
            .addAction({ name: "void-void",
                         action: (param) => {
                            checkActionInvocation("void-void", "undefined", typeof param);
                         }
                       })
            .addAction({ name: "void-int",
                         outputDataDescription: '{ type: "integer" }',
                         action: (param) => {
                             checkActionInvocation("void-int", "undefined", typeof param);
                             return 0;
                         }
                       })
            .addAction({ name: "int-void",
                         inputDataDescription: '{ type: "integer" }',
                         action: (param) => {
                             let inputtype = typeof param;
                             if (param === Math.floor(param)) inputtype = "integer";
                             checkActionInvocation("int-void", "integer", inputtype);
                         }
                       })
            .addAction({ name: "int-int",
                         inputDataDescription: '{ type: "integer" }',
                         outputDataDescription: '{ type: "integer" }',
                         action: (param) => {
                             let inputtype = typeof param;
                             if (param === Math.floor(param)) inputtype = "integer";
                             checkActionInvocation("int-int", "integer", inputtype);
                             return param+1;
                         }
                       })
            .addAction({ name: "int-string",
                         inputDataDescription: '{ type: "integer" }',
                         outputDataDescription: '{ type: "string" }',
                         action: (param) => {
                            let inputtype = typeof param;
                            if (param === Math.floor(param)) inputtype = "integer";
                            checkActionInvocation("int-string", "integer", inputtype);
                            if (inputtype=="integer") {
                                return new String(param)
                                                .replace(/0/g,"zero-")
                                                .replace(/1/g,"one-")
                                                .replace(/2/g,"two-")
                                                .replace(/3/g,"three-")
                                                .replace(/4/g,"four-")
                                                .replace(/5/g,"five-")
                                                .replace(/6/g,"six-")
                                                .replace(/7/g,"seven-")
                                                .replace(/8/g,"eight-")
                                                .replace(/9/g,"nine-")
                            } else {
                                return "ERROR";
                            }
                         }
                       })
            .addAction({ name : "void-complex",
                         outputDataDescription: '{ type: "object", field: [ { name: "prop1", value: { type: "integer" } }, { name: "prop2", value: { type: "string" } } ], required: [ "prop1", "prop2" ] }',
                         action: (param) => {
                            checkActionInvocation("void-complex", "undefined", typeof param);
                            return {"prop1": 123, "prop2" : "abc"};
                         }
                       })
            .addAction({ name : "complex-void",
                         inputDataDescription: '{ type: "object", field: [ { name: "prop1", value: { type: "integer" } }, { name: "prop2", value: { type: "string" } } ], required: [ "prop1", "prop2" ] }',
                         action: (param) => {
                             checkActionInvocation("complex-void", "object", typeof param);
                         }
                       });
    });
