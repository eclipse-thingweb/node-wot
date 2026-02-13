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

import { DataSchema } from "wot-typescript-definitions";

export const variantDataSchema: DataSchema = {
    description: "A JSON structure representing a OPCUA Variant encoded in JSON format using 1.04 specification",
    type: "object",
    properties: {
        Type: {
            type: "number",
            enum: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
            description: "The OPCUA DataType  of the Variant, must be 'number'",
        },
        Body: {
            description: "The body can be any JSON value",
            // "type": ["string", "number", "object", "array", "boolean", "null"]
        },
    },
    required: ["Type", "Body"],
    additionalProperties: false,
};

export const opcuaVariableSchemaType: Record<string, DataSchema> = {
    number: {
        type: "number",
        description: "A simple number",
    },
    dataValue: {
        description: "A JSON structure representing a OPCUA DataValue encoded in JSON format using 1.04 specification",
        type: "object",
        properties: {
            SourceTimestamp: {
                //  type: "date",
                description: "The sourceTimestamp of the DataValue",
            },
            Value: variantDataSchema,
        },
        required: ["Value"],
        additionalProperties: false,
    },
    variant: variantDataSchema,
};
