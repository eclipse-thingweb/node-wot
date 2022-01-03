/********************************************************************************
 * Copyright (c) 2019 - 2021 Contributors to the Eclipse Foundation
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
import { ContentCodec } from "@node-wot/core";
import { DataSchema } from "@node-wot/td-tools";
import { DataValue } from "node-opcua-data-value";
import { DataType } from "node-opcua-variant";
import Ajv from "ajv";

// see https://www.w3.org/Protocols/rfc1341/4_Content-Type.html
import {
    opcuaJsonEncodeDataValue,
    opcuaJsonDecodeDataValue,
    opcuaJsonDecodeVariant,
    DataValueJSON,
} from "node-opcua-json";
import { BinaryStream } from "node-opcua-binary-stream";

// Strict mode has a lot of other checks and it prevents runtime unexpected problems
// TODO: in the future we should use the strict mode
const ajv = new Ajv({ strict: false });

/**
 * this schema, describe the node-opcua JSON format for a DataValue objevct
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
    // required: [/**  */],
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
            type: ["number"],
        },
        Body: {
            type: ["number", "integer", "string", "boolean", "array", "null", "object"],
            nullable: true,
        },
        Dimensions: {
            type: ["array"],
            items: { type: "integer" },
        },
    },
    additionalProperties: false,
    // required: ["Type", "Body"],
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

export function formatForNodeWoT(dataValue: DataValueJSON): DataValueJSON {
    // remove unwanted/unneeded properties
    delete dataValue.SourcePicoseconds;
    delete dataValue.ServerPicoseconds;
    delete dataValue.ServerTimestamp;
    return dataValue;
}
export class OpcuaJSONCodec implements ContentCodec {
    getMediaType(): string {
        return "application/json+opcua";
    }

    bytesToValue(bytes: Buffer, schema: DataSchema, parameters?: { [key: string]: string }): DataValueJSON {
        const type = parameters?.type ?? "DataValue";
        let parsed = JSON.parse(bytes.toString());
        switch (type) {
            case "DataValue": {
                const isValid = schemaDataValueJSONValidate(parsed);
                if (!isValid) {
                    console.log("[OpcuaJSONCodec|bytesToValue] parsed =", parsed);
                    console.log("[OpcuaJSONCodec|bytesToValue]", schemaDataValueJSONValidate.errors);
                    throw new Error("Invalid JSON dataValue : " + JSON.stringify(parsed, null, " "));
                }
                // return opcuaJsonEncodeDataValue(opcuaJsonDecodeDataValue(parsed), true);
                return parsed;
            }
            case "Variant": {
                const dataValue = new DataValue({ value: opcuaJsonDecodeVariant(parsed) });
                return opcuaJsonEncodeDataValue(dataValue, true);
            }
            case "Value": {
                if (!parameters || !parameters.dataType) {
                    throw new Error("[OpcuaJSONCodec|bytesToValue]: unknown dataType for Value encoding" + type);
                }
                if (parameters.dataType === DataType[DataType.DateTime]) {
                    parsed = new Date(parsed);
                }
                const value = {
                    dataType: DataType[parameters.dataType as keyof typeof DataType],
                    value: parsed,
                };
                return opcuaJsonEncodeDataValue(new DataValue({ value }), true);
            }
            default:
                throw new Error("[OpcuaJSONCodec|bytesToValue]: Invalid type " + type);
        }
    }

    valueToBytes(
        dataValue: DataValueJSON | DataValue | string,
        schema: DataSchema,
        parameters?: { [key: string]: string }
    ): Buffer {
        dataValue =
            dataValue instanceof DataValue
                ? opcuaJsonEncodeDataValue(dataValue, true)
                : typeof dataValue === "string"
                ? (JSON.parse(dataValue) as DataValueJSON)
                : dataValue;

        dataValue = formatForNodeWoT(dataValue);

        const type = parameters?.type ?? "DataValue";
        switch (type) {
            case "DataValue":
                return Buffer.from(JSON.stringify(dataValue), "ascii");
            case "Variant": {
                const str = JSON.stringify(dataValue.Value);
                return Buffer.from(str, "ascii");
            }
            case "Value": {
                const v = dataValue.Value.Body;
                if (!v) {
                    return Buffer.alloc(0);
                }
                return Buffer.from(JSON.stringify(v), "ascii");
            }
            default:
                throw new Error("[OpcuaJSONCodec|valueToBytes]: Invalid type : " + type);
        }
    }
}
export const theOpcuaJSONCodec = new OpcuaJSONCodec();

export function jsonify(a: unknown): unknown {
    return JSON.parse(JSON.stringify(a));
}
export class OpcuaBinaryCodec implements ContentCodec {
    getMediaType(): string {
        return "application/octet-stream+opcua";
    }

    bytesToValue(bytes: Buffer, schema: DataSchema, parameters?: { [key: string]: string }): DataValueJSON {
        const binaryStream = new BinaryStream(bytes);
        const dataValue = new DataValue();
        dataValue.decode(binaryStream);
        return jsonify(opcuaJsonEncodeDataValue(dataValue, true));
    }

    valueToBytes(
        dataValue: DataValueJSON | DataValue,
        schema: DataSchema,
        parameters?: { [key: string]: string }
    ): Buffer {
        dataValue = dataValue instanceof DataValue ? dataValue : opcuaJsonDecodeDataValue(dataValue);

        // remove unwanted properties
        dataValue.serverPicoseconds = 0;
        dataValue.sourcePicoseconds = 0;
        dataValue.serverTimestamp = undefined;

        const size = dataValue.binaryStoreSize();
        const stream = new BinaryStream(size);
        dataValue.encode(stream);
        const body = stream.buffer;
        return body;
    }
}
export const theOpcuaBinaryCodec = new OpcuaBinaryCodec();
