/********************************************************************************
 * Copyright (c) 2026 Contributors to the Eclipse Foundation
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
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { EipForm } from "../src/eip-form";
import { validateEipForm } from "../src/eip-form-validation";

function form(extra: Record<string, unknown> = {}): EipForm {
    return { href: "eip://h/1,0/MotorSpeed", op: ["readproperty"], "eipv:type": "eipv:REAL", ...extra } as EipForm;
}

describe("EtherNet/IP form validation", () => {
    describe("accepts", () => {
        it("a primitive tag with all three operations", () => {
            expect(() =>
                validateEipForm(form({ op: ["readproperty", "observeproperty", "writeproperty"] }))
            ).to.not.throw();
        });

        it("a string op", () => {
            expect(() => validateEipForm(form({ op: "readproperty" }))).to.not.throw();
        });

        it("every form of the sample TD", () => {
            const td = JSON.parse(
                fs.readFileSync(path.join(__dirname, "../../../examples/eip-binding/Rockwell.td.jsonld"), "utf8")
            );
            for (const prop of Object.values<{ forms: EipForm[] }>(td.properties)) {
                for (const f of prop.forms) {
                    expect(() => validateEipForm(f)).to.not.throw();
                }
            }
        });

        it("an array with dimensions and element count", () => {
            expect(() =>
                validateEipForm(form({ "eipv:dimensions": [10], "eipv:elementCount": 4, "eipv:type": "eipv:DINT" }))
            ).to.not.throw();
        });

        it("matching read and write services", () => {
            expect(() => validateEipForm(form({ "eipv:service": "ReadTagFragmented" }))).to.not.throw();
            expect(() =>
                validateEipForm(form({ op: ["writeproperty"], "eipv:service": "WriteTagFragmented" }))
            ).to.not.throw();
        });

        it("rejects eipv:scale and eipv:offset and points to map:valueMapping", () => {
            expect(() => validateEipForm(form({ "eipv:type": "eipv:INT", "eipv:scale": 0.1 }))).to.throw(
                "eipv:scale is not supported, use map:valueMapping"
            );
            expect(() => validateEipForm(form({ "eipv:type": "eipv:INT", "eipv:offset": 5 }))).to.throw(
                "eipv:offset is not supported, use map:valueMapping"
            );
        });

        it("ignores map: and octv: terms", () => {
            expect(() =>
                validateEipForm(
                    form({ "map:valueMapping": { "map:fromWire": [{ "map:proc": "mul", "map:value": 2 }] } })
                )
            ).to.not.throw();
        });
    });

    describe("operations and services", () => {
        it("rejects form without op", () => {
            expect(() => validateEipForm(form({ op: undefined }))).to.throw("op");
        });

        it("rejects unsupported operations", () => {
            expect(() => validateEipForm(form({ op: ["invokeaction"] }))).to.throw("invokeaction");
            expect(() => validateEipForm(form({ op: ["subscribeevent"] }))).to.throw("subscribeevent");
        });

        it("rejects unknown services", () => {
            expect(() => validateEipForm(form({ "eipv:service": "Foo" }))).to.throw("eipv:service");
        });

        it("rejects the PCCC service", () => {
            expect(() => validateEipForm(form({ "eipv:service": "ExecutePCCC" }))).to.throw("PCCC");
        });

        it("rejects a read service combined with writeproperty", () => {
            expect(() =>
                validateEipForm(form({ op: ["readproperty", "writeproperty"], "eipv:service": "ReadTag" }))
            ).to.throw("ReadTag");
        });

        it("rejects a write service combined with read operations", () => {
            expect(() =>
                validateEipForm(form({ op: ["readproperty", "writeproperty"], "eipv:service": "WriteTag" }))
            ).to.throw("WriteTag");
        });
    });

    describe("type and structure", () => {
        it("rejects both eipv:type and eipv:structureDefinition", () => {
            const structure = { "eipv:typeName": "T", "eipv:fields": [] };
            expect(() => validateEipForm(form({ "eipv:structureDefinition": structure }))).to.throw(
                "eipv:type and eipv:structureDefinition"
            );
        });

        it("rejects a form with neither", () => {
            expect(() => validateEipForm(form({ "eipv:type": undefined }))).to.throw("eipv:type");
        });

        it("rejects unknown types", () => {
            expect(() => validateEipForm(form({ "eipv:type": "eipv:FOO" }))).to.throw("eipv:FOO");
        });
    });

    describe("arrays", () => {
        it("rejects elementCount without dimensions", () => {
            expect(() => validateEipForm(form({ "eipv:elementCount": 2 }))).to.throw("eipv:dimensions");
        });

        it("rejects invalid dimensions", () => {
            expect(() => validateEipForm(form({ "eipv:dimensions": [] }))).to.throw("eipv:dimensions");
            expect(() => validateEipForm(form({ "eipv:dimensions": [1, 2, 3, 4] }))).to.throw("eipv:dimensions");
            expect(() => validateEipForm(form({ "eipv:dimensions": [0] }))).to.throw("eipv:dimensions");
            expect(() => validateEipForm(form({ "eipv:dimensions": [1.5] }))).to.throw("eipv:dimensions");
        });

        it("rejects an element count outside 1..product", () => {
            expect(() => validateEipForm(form({ "eipv:dimensions": [2, 3], "eipv:elementCount": 7 }))).to.throw(
                "eipv:elementCount"
            );
            expect(() => validateEipForm(form({ "eipv:dimensions": [2, 3], "eipv:elementCount": 0 }))).to.throw(
                "eipv:elementCount"
            );
        });

        it("rejects BOOL and STRING arrays", () => {
            expect(() => validateEipForm(form({ "eipv:type": "eipv:BOOL", "eipv:dimensions": [4] }))).to.throw("BOOL");
            expect(() => validateEipForm(form({ "eipv:type": "eipv:STRING", "eipv:dimensions": [4] }))).to.throw(
                "STRING"
            );
        });

        it("requires eipv:byteSize for arrays of structures", () => {
            const structure = {
                "eipv:typeName": "T",
                "eipv:fields": [{ "eipv:name": "A", "eipv:type": "eipv:DINT", "eipv:byteOffset": 0 }],
            };
            expect(() =>
                validateEipForm(
                    form({ "eipv:type": undefined, "eipv:structureDefinition": structure, "eipv:dimensions": [2] })
                )
            ).to.throw("eipv:byteSize");
            expect(() =>
                validateEipForm(
                    form({
                        "eipv:type": undefined,
                        "eipv:structureDefinition": { ...structure, "eipv:byteSize": 4 },
                        "eipv:dimensions": [2],
                    })
                )
            ).to.not.throw();
        });
    });

    describe("timing", () => {
        it("rejects negative or non-integer polling time and timeout", () => {
            expect(() => validateEipForm(form({ "eipv:pollingTime": -1 }))).to.throw("eipv:pollingTime");
            expect(() => validateEipForm(form({ "eipv:pollingTime": 1.5 }))).to.throw("eipv:pollingTime");
            expect(() => validateEipForm(form({ "eipv:timeout": -5 }))).to.throw("eipv:timeout");
        });
    });

    describe("structure definitions", () => {
        function structureForm(structure: unknown): EipForm {
            return form({ "eipv:type": undefined, "eipv:structureDefinition": structure });
        }
        const dint = { "eipv:name": "A", "eipv:type": "eipv:DINT", "eipv:byteOffset": 0 };

        it("accepts nested structures and array members", () => {
            expect(() =>
                validateEipForm(
                    structureForm({
                        "eipv:typeName": "Outer",
                        "eipv:fields": [
                            {
                                "eipv:name": "Flag",
                                "eipv:type": "eipv:BOOL",
                                "eipv:byteOffset": 0,
                                "eipv:bitOffset": 3,
                            },
                            {
                                "eipv:name": "Values",
                                "eipv:type": "eipv:REAL",
                                "eipv:byteOffset": 4,
                                "eipv:dimensions": [3],
                            },
                            {
                                "eipv:name": "Inner",
                                "eipv:byteOffset": 16,
                                "eipv:structureDefinition": { "eipv:typeName": "Inner", "eipv:fields": [dint] },
                            },
                        ],
                    })
                )
            ).to.not.throw();
        });

        it("requires typeName and fields", () => {
            expect(() => validateEipForm(structureForm({ "eipv:fields": [dint] }))).to.throw("eipv:typeName");
            expect(() => validateEipForm(structureForm({ "eipv:typeName": "T" }))).to.throw("eipv:fields");
        });

        it("rejects duplicate field names", () => {
            expect(() =>
                validateEipForm(structureForm({ "eipv:typeName": "T", "eipv:fields": [dint, dint] }))
            ).to.throw("duplicate");
        });

        it("requires exactly one of type and nested structure per field", () => {
            const none = { "eipv:name": "A", "eipv:byteOffset": 0 };
            const both = {
                ...dint,
                "eipv:structureDefinition": { "eipv:typeName": "I", "eipv:fields": [dint] },
            };
            expect(() => validateEipForm(structureForm({ "eipv:typeName": "T", "eipv:fields": [none] }))).to.throw(
                "'A'"
            );
            expect(() => validateEipForm(structureForm({ "eipv:typeName": "T", "eipv:fields": [both] }))).to.throw(
                "'A'"
            );
        });

        it("requires a valid byteOffset", () => {
            expect(() =>
                validateEipForm(
                    structureForm({ "eipv:typeName": "T", "eipv:fields": [{ ...dint, "eipv:byteOffset": -1 }] })
                )
            ).to.throw("eipv:byteOffset");
            expect(() =>
                validateEipForm(
                    structureForm({ "eipv:typeName": "T", "eipv:fields": [{ ...dint, "eipv:byteOffset": undefined }] })
                )
            ).to.throw("eipv:byteOffset");
        });

        it("requires bitOffset 0..7 for BOOL fields only", () => {
            const bool = { "eipv:name": "B", "eipv:type": "eipv:BOOL", "eipv:byteOffset": 0 };
            expect(() => validateEipForm(structureForm({ "eipv:typeName": "T", "eipv:fields": [bool] }))).to.throw(
                "eipv:bitOffset"
            );
            expect(() =>
                validateEipForm(
                    structureForm({ "eipv:typeName": "T", "eipv:fields": [{ ...bool, "eipv:bitOffset": 8 }] })
                )
            ).to.throw("eipv:bitOffset");
            expect(() =>
                validateEipForm(
                    structureForm({ "eipv:typeName": "T", "eipv:fields": [{ ...dint, "eipv:bitOffset": 1 }] })
                )
            ).to.throw("eipv:bitOffset");
        });

        it("rejects BOOL and STRING array members and nested array members without byteSize", () => {
            const boolArray = {
                "eipv:name": "B",
                "eipv:type": "eipv:BOOL",
                "eipv:byteOffset": 0,
                "eipv:bitOffset": 0,
                "eipv:dimensions": [2],
            };
            expect(() => validateEipForm(structureForm({ "eipv:typeName": "T", "eipv:fields": [boolArray] }))).to.throw(
                "BOOL"
            );
            const nestedArray = {
                "eipv:name": "N",
                "eipv:byteOffset": 0,
                "eipv:dimensions": [2],
                "eipv:structureDefinition": { "eipv:typeName": "I", "eipv:fields": [dint] },
            };
            expect(() =>
                validateEipForm(structureForm({ "eipv:typeName": "T", "eipv:fields": [nestedArray] }))
            ).to.throw("eipv:byteSize");
        });

        it("rejects fields that exceed the declared byteSize", () => {
            expect(() =>
                validateEipForm(structureForm({ "eipv:typeName": "T", "eipv:byteSize": 2, "eipv:fields": [dint] }))
            ).to.throw("eipv:byteSize");
        });

        it("rejects invalid byteSize", () => {
            expect(() =>
                validateEipForm(structureForm({ "eipv:typeName": "T", "eipv:byteSize": 0, "eipv:fields": [dint] }))
            ).to.throw("eipv:byteSize");
        });
    });
});
