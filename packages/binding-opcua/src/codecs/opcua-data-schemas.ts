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

import Ajv from "ajv";
import addFormats from "ajv-formats";

// Strict mode has a lot of other checks and it prevents runtime unexpected problems
// TODO: in the future we should use the strict mode
const ajv = new Ajv({ strict: false });
addFormats(ajv);
/**
 * this schema, describe the node-opcua JSON format for a DataValue object
 *
 * const pojo = (new DataValue({})).toString();
 *
 */
export const schemaDataValue = {
    type: ["object"], // "number", "integer", "string", "boolean", "array", "null"],
    properties: {
        serverPicoseconds: { type: "integer" },
        sourcePicoseconds: { type: "integer" },
        serverTimestamp: { type: "string", /* format: "date", */ nullable: true },
        sourceTimestamp: { type: "string", /* format: "date", */ nullable: true },
        statusCode: {
            type: ["object"],
            properties: {
                value: {
                    type: "number",
                },
            },
        },
        value: {
            type: ["object"],
            properties: {
                dataType: {
                    type: ["string", "integer"],
                },
                arrayType: {
                    type: ["string"],
                },
                value: {
                    type: ["number", "integer", "string", "boolean", "array", "null", "object"],
                },
                dimension: {
                    type: ["array"],
                    items: { type: "integer" },
                },
                additionalProperties: false,
            },
        },
    },
    additionalProperties: true,
};

export const schemaVariantJSONNull = {
    type: "null",
    nullable: true,
};

export const schemaVariantJSON = {
    type: "object",
    properties: {
        Type: {
            type: "number",
            description: "The OPCUA DataType  of the Variant, must be 'number'",
        },
        Body: {
            type: ["number", "integer", "string", "boolean", "array", "null", "object"],
            nullable: true,
        },
        Dimensions: {
            type: "array",
            items: { type: "integer" },
        },
    },
    additionalProperties: false,
    required: ["Type", "Body"],
};

export const schemaDataValueJSON1 = {
    type: ["object"], // "number", "integer", "string", "boolean", "array", "null"],
    properties: {
        ServerPicoseconds: { type: "integer" },
        SourcePicoseconds: { type: "integer" },
        ServerTimestamp: {
            type: "string" /*, format: "date" */,
        },
        SourceTimestamp: {
            type: "string" /*, format: "date" */,
        },
        StatusCode: {
            type: "integer",
            minimum: 0,
        },

        Value: schemaVariantJSON,
        Value1: { type: "number", nullable: true },

        Value2: {
            oneOf: [schemaVariantJSON, schemaVariantJSONNull],
        },
    },

    additionalProperties: false,
    required: ["Value"],
};
export const schemaDataValueJSON2 = {
    properties: {
        Value: { type: "null" },
    },
};
export const schemaDataValueJSON = {
    oneOf: [schemaDataValueJSON2, schemaDataValueJSON1],
};
export const schemaDataValueJSONValidate = ajv.compile(schemaDataValueJSON);
export const schemaDataValueValidate = ajv.compile(schemaDataValue);
