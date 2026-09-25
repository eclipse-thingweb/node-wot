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
/*
 * Only the OPC UA JSON encodings are described here: 1.04 (Part 6 Annex H, the deprecated
 * Reversible/NonReversible pair) and 1.05 (Part 6 5.4, Compact/Verbose). node-opcua's own
 * object shapes - what DataValue.toJSON() or Variant.toString() produce - are internals of
 * the library and are never exposed to a WoT consumer, so no schema describes them.
 */

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

/**
 * OPC UA 1.05 renames the Variant fields (Part 6 section 5.4.2.17) and flattens the
 * DataValue onto them (section 5.4.2.18), so a 1.05 payload never matches the shapes
 * above. See doc/opcua-json-encoding.md.
 */
export const schemaVariantJSON105 = {
    type: "object",
    properties: {
        UaType: {
            type: "number",
            description: "The OPCUA DataType of the Variant",
        },
        Value: {
            type: ["number", "integer", "string", "boolean", "array", "null", "object"],
            nullable: true,
        },
        UaDimensions: {
            type: "array",
            items: { type: "integer" },
        },
    },
    additionalProperties: false,
    required: ["UaType"],
};

export const schemaDataValueJSON105 = {
    type: "object",
    properties: {
        UaType: { type: "number" },
        Value: {
            type: ["number", "integer", "string", "boolean", "array", "null", "object"],
            nullable: true,
        },
        UaDimensions: { type: "array", items: { type: "integer" } },
        UaStatus: { type: "integer", minimum: 0 },
        SourceTimestamp: { type: "string" },
        ServerTimestamp: { type: "string" },
        SourcePicoseconds: { type: "integer" },
        ServerPicoseconds: { type: "integer" },
    },
    additionalProperties: false,
};

/**
 * Accepts either edition. anyOf, not oneOf: a 1.04 payload whose optional fields happen to
 * be a subset of the 1.05 shape would match both, and oneOf demands exactly one match.
 * Which decoder runs is decided by the field names, not by this schema.
 */
export const schemaDataValueJSONAnyEdition = {
    anyOf: [schemaDataValueJSON2, schemaDataValueJSON1, schemaDataValueJSON105],
};

export const schemaDataValueJSONValidate = ajv.compile(schemaDataValueJSON);
export const schemaVariantJSON105Validate = ajv.compile(schemaVariantJSON105);
export const schemaDataValueJSONAnyEditionValidate = ajv.compile(schemaDataValueJSONAnyEdition);
