/********************************************************************************
 * Copyright (c) 2025 Contributors to the Eclipse Foundation
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
import { gg } from "./ggg.mjs";
// eslint-disable-next-line import/no-extraneous-dependencies
import Ajv from "ajv";
const ajv = new Ajv();
const schema = {
    type: "object",
    properties: {
        foo: { type: "string" },
        bar: { type: "number" },
    },
    required: ["foo", "bar"],
    additionalProperties: false,
};

const validate = ajv.compile(schema);

const validData = { foo: "hello", bar: 42 };
const invalidData = { foo: "hello", bar: "not a number" };

console.log("validData is valid:", validate(validData));
console.log("invalidData is valid:", validate(invalidData));
if (!validate(invalidData)) {
    console.log("Validation errors:", validate.errors);
}
console.log("gg", gg);
