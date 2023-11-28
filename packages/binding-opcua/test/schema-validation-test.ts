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

import { createLoggers } from "@node-wot/core";
import { expect } from "chai";

import { DataType, DataValue, StatusCodes, VariantArrayType } from "node-opcua-client";
import { opcuaJsonEncodeDataValue } from "node-opcua-json";

import { schemaDataValueValidate, schemaDataValueJSONValidate } from "../src/codec";

const { debug } = createLoggers("binding-opcua", "schema-validation-test");

const data = {
    uint32: new DataValue({
        statusCode: StatusCodes.Good,
        value: {
            dataType: DataType.UInt32,
            value: 42,
        },
    }),

    "string array": new DataValue({
        sourcePicoseconds: 10,
        sourceTimestamp: new Date(1909, 12, 31),
        statusCode: StatusCodes.BadAggregateInvalidInputs,
        value: {
            dataType: DataType.String,
            value: ["Hello", "World"],
        },
    }),
    "current time": new DataValue({
        sourcePicoseconds: 10,
        sourceTimestamp: new Date(1909, 12, 31),
        statusCode: StatusCodes.BadAggregateInvalidInputs,
        value: {
            dataType: DataType.DateTime,
            value: [new Date(2019, 11, 23)],
        },
    }),

    matrix: new DataValue({
        serverPicoseconds: 10,
        serverTimestamp: new Date(1909, 12, 31),
        statusCode: StatusCodes.BadAggregateInvalidInputs,
        value: {
            dataType: DataType.UInt64,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6],
        },
    }),
    null: new DataValue({}),
};

describe("schemas", () => {
    describe("schemaDataValue", () => {
        Object.entries(data).forEach(([name, obj1]) => {
            it("(experimental) " + name, () => {
                const validate = schemaDataValueValidate;

                const obj1 = new DataValue({}).toJSON();
                const isValid = validate(obj1);
                if (!isValid) {
                    debug(`Valid: ${isValid}`);
                    debug(`Errors: ${validate.errors}`);
                }
                debug(`${obj1}`);
                expect(isValid).equal(true);
            });
        });
    });
    describe("schemaDataValueJSON", () => {
        const validate = schemaDataValueJSONValidate;

        Object.entries(data).forEach(([name, obj1]) => {
            it("DataValue " + name, () => {
                const dataValueJSON = JSON.parse(JSON.stringify(opcuaJsonEncodeDataValue(obj1, true)));

                const isValid = validate(dataValueJSON);
                if (!isValid) {
                    debug(`Valid: ${isValid}`);
                    debug(`Errors: ${validate.errors}`);
                    debug(`dataValueJSON: ${dataValueJSON}`);
                }

                expect(isValid).eql(true);
            });
        });
    });
});
