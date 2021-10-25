/********************************************************************************
 * Copyright (c) 2020 - 2021 Contributors to the Eclipse Foundation
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
import * as TD from "@node-wot/td-tools";
import { DataType, VariantLike } from "node-opcua-client";
import { DataSchemaValue } from "wot-typescript-definitions";

/** default implementation offering JSON de-/serialization */
export default class OpcuaCodec implements ContentCodec {
    getMediaType(): string {
        return "application/x.opcua-binary";
    }

    bytesToValue(bytes: Buffer, schema: TD.DataSchema, parameters: { [key: string]: string }): DataSchemaValue {
        let parsed;
        try {
            parsed = JSON.parse(bytes.toString());
            parsed = parsed.value;
        } catch (err) {
            if (err instanceof SyntaxError) {
                if (bytes.byteLength === 0) {
                    // empty payload -> void/undefined
                    parsed = undefined;
                } else {
                    parsed = bytes.values; // Variant instance then
                }
            } else {
                throw err;
            }
        }

        // TODO validate using schema

        // remove legacy wrapping and use RFC 7159
        // TODO remove once dropped from all PlugFest implementation
        if (parsed && parsed.value !== undefined) {
            console.warn("[binding-opcua]", `JsonCodec removing { value: ... } wrapper`);
            parsed = parsed.value;
        }
        return parsed;
    }

    valueToBytes(value: unknown, schema: TD.DataSchema, parameters?: { [key: string]: string }): Buffer {
        let body = "";
        if (value !== undefined) {
            const obj: { inputArguments?: VariantLike[]; dataType?: DataType; payload: unknown } = { payload: value };
            if (!schema.input) {
                const dataTypeString = this.dataTypeToString();
                if (
                    !schema ||
                    !schema[dataTypeString] ||
                    (schema.properties && !(dataTypeString in (schema.properties as Record<string, unknown>)))
                ) {
                    throw new Error(`opc:dataType field not specified for property "${schema.title}"`);
                }
                let dataType = schema[dataTypeString]
                    ? schema[dataTypeString]
                    : (schema.properties as Record<string, string>)[dataTypeString];
                dataType = this.getOPCUADataType(dataType);
                obj.dataType = dataType;
            } else {
                // action!
                const inputArguments = this.getInputArguments(value, schema.input);
                obj.inputArguments = inputArguments;
            }

            body = JSON.stringify(obj);
        }
        return Buffer.from(body);
    }

    public dataTypeToString(): string {
        return "opc:dataType";
    }

    private getOPCUADataType(stringType: string): DataType {
        switch (stringType) {
            case "Null":
                return DataType.Null;
            case "Boolean":
                return DataType.Boolean;
            case "SByte":
                return DataType.SByte;
            case "Byte":
                return DataType.Byte;
            case "Int16":
                return DataType.Int16;
            case "UInt16":
                return DataType.UInt16;
            case "Int32":
                return DataType.Int32;
            case "UInt32":
                return DataType.UInt32;
            case "Int64":
                return DataType.Int64;
            case "UInt64":
                return DataType.UInt64;
            case "Float":
                return DataType.Float;
            case "Double":
                return DataType.Double;
            case "String":
                return DataType.String;
            case "DateTime":
                return DataType.DateTime;
            case "Guid":
                return DataType.Guid;
            case "ByteString":
                return DataType.ByteString;
            case "XmlElement":
                return DataType.XmlElement;
            case "NodeId":
                return DataType.NodeId;
            case "ExpandedNodeId":
                return DataType.ExpandedNodeId;
            case "StatusCode":
                return DataType.StatusCode;
            case "QualifiedName":
                return DataType.QualifiedName;
            case "LocalizedText":
                return DataType.LocalizedText;
            case "ExtensionObject":
                return DataType.ExtensionObject;
            case "DataValue":
                return DataType.DataValue;
            case "Variant":
                return DataType.Variant;
            case "DiagnosticInfo":
                return DataType.DiagnosticInfo;
            default:
                console.warn("[binding-opcua]", `dataType "${stringType}" not found, using "Double" as default`);
                return DataType.Double;
        }
    }

    private getInputArguments(payload: unknown, schema?: TD.DataSchema) {
        const inputArguments: VariantLike[] = [];
        if (!schema) {
            throw new Error('Mandatory "input" field missing in the TD');
        }
        if (schema.type === "object" && !schema.properties) {
            throw new Error('Mandatory  "properties" field missing in the "input"');
        }
        const properties = schema.properties;
        const dataTypeString = this.dataTypeToString();
        if (properties) {
            // multiple inputs
            for (const [key, value] of Object.entries(payload)) {
                if (!(key in properties) || !(dataTypeString in properties[key])) {
                    throw new Error(`dataType field not specified for parameter "${key}"`);
                }
                const tmpDataType = properties[key][dataTypeString];
                const dataType = this.getOPCUADataType(tmpDataType);
                inputArguments.push({ dataType, value });
            }
        } else {
            // single input
            if (!(dataTypeString in schema)) {
                throw new Error(`dataType field not specified for input "${payload}"`);
            }
            const tmpDataType = schema[dataTypeString];
            const dataType = this.getOPCUADataType(tmpDataType);
            const value = payload;
            inputArguments.push({ dataType, value });
        }
        return inputArguments;
    }
}
