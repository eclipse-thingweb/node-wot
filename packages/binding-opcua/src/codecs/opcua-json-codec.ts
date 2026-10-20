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

import { ContentCodec, DataSchema, createLoggers } from "@node-wot/core";
import { DataValue } from "node-opcua-data-value";
import { DataType, Variant } from "node-opcua-variant";

// see https://www.w3.org/Protocols/rfc1341/4_Content-Type.html
import {
    DataValueJSON,
    ExtensionObjectBuilder,
    ExtensionObjectConstructorFuncWithSchema,
    JsonEncoderMode,
    opcuaJsonDecodeDataValue,
    opcuaJsonDecodeVariant,
    opcuaJsonEncodeDataValue,
    opcuaJsonEncodeVariant,
} from "node-opcua-json/104";
import {
    JsonEncoderMode as JsonEncoderMode105,
    opcuaJsonDecodeDataValue as opcuaJsonDecodeDataValue105,
    opcuaJsonDecodeVariant as opcuaJsonDecodeVariant105,
    opcuaJsonEncodeDataValue as opcuaJsonEncodeDataValue105,
    opcuaJsonEncodeVariant as opcuaJsonEncodeVariant105,
} from "node-opcua-json/105";
import { DataSchemaValue } from "wot-typescript-definitions";
import { schemaDataValueJSONAnyEditionValidate } from "./opcua-data-schemas";
import { findConnectionContext } from "../ua-binary";
import { NodeId } from "node-opcua";

const { debug } = createLoggers("binding-opcua", "codec");

// Strict mode has a lot of other checks and it prevents runtime unexpected problems
// TODO: in the future we should use the strict mode

/**
 * this schema, describe the node-opcua JSON format for a DataValue object
 *
 * const pojo = (new DataValue({})).toString();
 *
 */

export function formatForNodeWoT(dataValue: DataValueJSON): DataValueJSON {
    // remove unwanted/unneeded properties
    delete dataValue.SourcePicoseconds;
    delete dataValue.ServerPicoseconds;
    delete dataValue.ServerTimestamp;
    return dataValue;
}

const builder: ExtensionObjectBuilder = {
    getExtensionObjectConstructor(_dataTypeNodeId: NodeId): ExtensionObjectConstructorFuncWithSchema {
        throw new Error("Not implemented");
    },
};

/**
 * Which OPC UA JSON edition a payload is written in, from its own field names:
 * 1.05 uses UaType/Value, 1.04 Type/Body (OPC 10000-6 Annex H). Decoding follows the
 * payload, so a form declaring one edition still reads the other.
 */
function is105(parsed: unknown): boolean {
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed as Record<string, unknown>);
        return keys.includes("UaType") || keys.includes("UaDimensions");
    }
    return false;
}

/** the edition to emit, from the contentType parameters; 1.04 unless asked otherwise */
function wants105(parameters?: { [key: string]: string }): boolean {
    return parameters?.version === "1.05";
}

function mode105(parameters?: { [key: string]: string }): JsonEncoderMode105 {
    return parameters?.mode?.toLowerCase() === "verbose" ? JsonEncoderMode105.Verbose : JsonEncoderMode105.Compact;
}

// application/json   => is equivalent to application/opcua+json;type=Value
export class OpcuaJSONCodec implements ContentCodec {
    getMediaType(): string {
        return "application/opcua+json";
    }

    bytesToValue(bytes: Buffer, schema: DataSchema, parameters?: { [key: string]: string }): DataSchemaValue {
        const type = parameters?.type ?? "DataValue";
        let parsed = JSON.parse(bytes.toString());
        // the namespace table of the session that produced the payload (`;uaconn=`, set by the
        // binding): without it, an `nsu=` NodeId decodes as a String NodeId of namespace 0
        const namespaceArray = findConnectionContext(parameters?.uaconn)?.namespaceArray ?? [];

        const wantDataValue = parameters?.to === "DataValue" || false;

        switch (type) {
            case "DataValue": {
                const isValid = schemaDataValueJSONAnyEditionValidate(parsed);
                if (!isValid) {
                    debug(`bytesToValue: parsed = ${parsed}`);
                    debug(`bytesToValue: ${schemaDataValueJSONAnyEditionValidate.errors}`);
                    throw new Error(`Invalid JSON dataValue : ${JSON.stringify(parsed, null, " ")}`);
                }

                const payloadIs105 = is105(parsed);
                const dataValue = payloadIs105
                    ? opcuaJsonDecodeDataValue105(parsed, builder, namespaceArray)
                    : opcuaJsonDecodeDataValue(parsed, builder, namespaceArray);
                if (wantDataValue) {
                    return dataValue;
                }
                if (payloadIs105 || wants105(parameters)) {
                    return opcuaJsonEncodeDataValue105(
                        dataValue,
                        mode105(parameters),
                        namespaceArray
                    ) as DataSchemaValue;
                }
                return formatForNodeWoT(
                    opcuaJsonEncodeDataValue(dataValue, JsonEncoderMode.Reversible, namespaceArray)
                );
            }
            case "Variant": {
                const payloadIs105 = is105(parsed);
                const variant = payloadIs105
                    ? opcuaJsonDecodeVariant105(parsed, builder, namespaceArray)
                    : opcuaJsonDecodeVariant(parsed, builder, namespaceArray);
                if (wantDataValue) {
                    return new DataValue({ value: variant });
                }
                const v =
                    payloadIs105 || wants105(parameters)
                        ? opcuaJsonEncodeVariant105(variant, mode105(parameters), namespaceArray)
                        : opcuaJsonEncodeVariant(variant, JsonEncoderMode.Reversible, namespaceArray);
                debug(`${v}`);
                return v as DataSchemaValue;
            }
            case "Value": {
                if (wantDataValue) {
                    if (!parameters?.dataType) {
                        throw new Error(`[OpcuaJSONCodec|bytesToValue]: unknown dataType for Value encoding ${type}`);
                    }
                    if (parameters.dataType === DataType[DataType.DateTime]) {
                        parsed = new Date(parsed);
                    }
                    const value = {
                        dataType: DataType[parameters.dataType as keyof typeof DataType],
                        value: parsed,
                    };
                    return new DataValue({ value });
                } else {
                    if (parameters?.dataType === DataType[DataType.DateTime]) {
                        parsed = new Date(parsed);
                    }
                    return parsed;
                }
            }
            default:
                throw new Error(`[OpcuaJSONCodec|bytesToValue]: Invalid type ${type}`);
        }
    }

    valueToBytes(value: unknown, _schema: DataSchema, parameters?: { [key: string]: string }): Buffer {
        const type = parameters?.type ?? "DataValue";
        // a DataValue or Variant given programmatically: no session here, so no namespace table
        const namespaceArray: string[] = [];
        // an already-encoded payload keeps its own edition; otherwise the form decides
        const emit105 = is105(value) || wants105(parameters);
        switch (type) {
            case "DataValue": {
                let dataValue: DataValue;
                if (value instanceof DataValue) {
                    dataValue = value;
                } else if (value instanceof Variant) {
                    dataValue = new DataValue({ value });
                } else if (typeof value === "string") {
                    // a string is passed through as the JSON it already is
                    return Buffer.from(JSON.stringify(JSON.parse(value)), "utf-8");
                } else {
                    // OPC UA JSON already: passed through, as the binding decodes either edition
                    // with the session's namespace table. Decoding it here, with no table,
                    // would turn an `nsu=` NodeId into a String NodeId of namespace 0.
                    const json = is105(value) ? value : formatForNodeWoT({ ...(value as DataValueJSON) });
                    return Buffer.from(JSON.stringify(json), "utf-8");
                }
                if (emit105) {
                    const encoded = opcuaJsonEncodeDataValue105(dataValue, mode105(parameters), namespaceArray);
                    return Buffer.from(JSON.stringify(encoded), "utf-8");
                }
                const dataValueJSON = formatForNodeWoT(
                    opcuaJsonEncodeDataValue(dataValue, JsonEncoderMode.Reversible, namespaceArray)
                );
                return Buffer.from(JSON.stringify(dataValueJSON), "utf-8");
            }
            case "Variant": {
                if (value instanceof DataValue) {
                    value = emit105
                        ? opcuaJsonEncodeVariant105(value.value, mode105(parameters), namespaceArray)
                        : opcuaJsonEncodeVariant(value.value, JsonEncoderMode.Reversible, namespaceArray);
                } else if (value instanceof Variant) {
                    value = emit105
                        ? opcuaJsonEncodeVariant105(value, mode105(parameters), namespaceArray)
                        : opcuaJsonEncodeVariant(value, JsonEncoderMode.Reversible, namespaceArray);
                } else if (typeof value === "string") {
                    value = JSON.parse(value);
                }
                return Buffer.from(JSON.stringify(value), "utf-8");
            }
            case "Value": {
                if (value === undefined) {
                    return Buffer.alloc(0);
                }
                if (value instanceof DataValue) {
                    value = opcuaJsonEncodeVariant(value.value, JsonEncoderMode.NonReversible, namespaceArray);
                } else if (value instanceof Variant) {
                    value = opcuaJsonEncodeVariant(value, JsonEncoderMode.NonReversible, namespaceArray);
                }
                return Buffer.from(JSON.stringify(value), "utf-8");
            }
            default:
                throw new Error(`[OpcuaJSONCodec|valueToBytes]: Invalid type : ${type}`);
        }
    }
}
export const theOpcuaJSONCodec = new OpcuaJSONCodec();
