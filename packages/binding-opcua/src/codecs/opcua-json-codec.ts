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
    opcuaJsonEncodeDataValue,
    opcuaJsonDecodeDataValue,
    opcuaJsonDecodeVariant,
    DataValueJSON,
    opcuaJsonEncodeVariant,
} from "node-opcua-json";
import { DataSchemaValue } from "wot-typescript-definitions";
import { schemaDataValueJSONValidate } from "./opcua-data-schemas";

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

// application/json   => is equivalent to application/opcua+json;type=Value

export class OpcuaJSONCodec implements ContentCodec {
    getMediaType(): string {
        return "application/opcua+json";
    }

    bytesToValue(bytes: Buffer, schema: DataSchema, parameters?: { [key: string]: string }): DataSchemaValue {
        const type = parameters?.type ?? "DataValue";
        let parsed = JSON.parse(bytes.toString());

        const wantDataValue = parameters?.to === "DataValue" || false;

        switch (type) {
            case "DataValue": {
                const isValid = schemaDataValueJSONValidate(parsed);
                if (!isValid) {
                    debug(`bytesToValue: parsed = ${parsed}`);
                    debug(`bytesToValue: ${schemaDataValueJSONValidate.errors}`);
                    throw new Error("Invalid JSON dataValue : " + JSON.stringify(parsed, null, " "));
                }
                if (wantDataValue) {
                    return opcuaJsonDecodeDataValue(parsed);
                }
                return formatForNodeWoT(opcuaJsonEncodeDataValue(opcuaJsonDecodeDataValue(parsed), true));
                // return parsed;
            }
            case "Variant": {
                if (wantDataValue) {
                    const dataValue = new DataValue({ value: opcuaJsonDecodeVariant(parsed) });
                    return dataValue;
                }
                const v = opcuaJsonEncodeVariant(opcuaJsonDecodeVariant(parsed), true);
                debug(`${v}`);
                return v;
            }
            case "Value": {
                if (wantDataValue) {
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
                    return new DataValue({ value });
                } else {
                    if (parameters?.dataType === DataType[DataType.DateTime]) {
                        parsed = new Date(parsed);
                    }
                    return parsed;
                }
            }
            default:
                throw new Error("[OpcuaJSONCodec|bytesToValue]: Invalid type " + type);
        }
    }

    valueToBytes(value: unknown, _schema: DataSchema, parameters?: { [key: string]: string }): Buffer {
        const type = parameters?.type ?? "DataValue";
        switch (type) {
            case "DataValue": {
                let dataValueJSON: DataValueJSON;
                if (value instanceof DataValue) {
                    dataValueJSON = opcuaJsonEncodeDataValue(value, true);
                } else if (value instanceof Variant) {
                    dataValueJSON = opcuaJsonEncodeDataValue(new DataValue({ value }), true);
                } else if (typeof value === "string") {
                    dataValueJSON = JSON.parse(value) as DataValueJSON;
                } else {
                    dataValueJSON = opcuaJsonEncodeDataValue(opcuaJsonDecodeDataValue(value as DataValueJSON), true);
                }
                dataValueJSON = formatForNodeWoT(dataValueJSON);
                return Buffer.from(JSON.stringify(dataValueJSON), "ascii");
            }
            case "Variant": {
                if (value instanceof DataValue) {
                    value = opcuaJsonEncodeVariant(value.value, true);
                } else if (value instanceof Variant) {
                    value = opcuaJsonEncodeVariant(value, true);
                } else if (typeof value === "string") {
                    value = JSON.parse(value);
                }
                return Buffer.from(JSON.stringify(value), "ascii");
            }
            case "Value": {
                if (value === undefined) {
                    return Buffer.alloc(0);
                }
                if (value instanceof DataValue) {
                    value = opcuaJsonEncodeVariant(value.value, false);
                } else if (value instanceof Variant) {
                    value = opcuaJsonEncodeVariant(value, false);
                }
                return Buffer.from(JSON.stringify(value), "ascii");
            }
            default:
                throw new Error("[OpcuaJSONCodec|valueToBytes]: Invalid type : " + type);
        }
    }
}
export const theOpcuaJSONCodec = new OpcuaJSONCodec();
