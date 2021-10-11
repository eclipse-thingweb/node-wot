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
import { DataType } from "node-opcua-client";
import { DataSchemaValue } from "wot-typescript-definitions";

/** default implementation offering JSON de-/serialization */
export default class OpcuaCodec implements ContentCodec {
    getMediaType(): string {
        return "application/x.opcua-binary";
    }

    bytesToValue(bytes: Buffer, schema: TD.DataSchema, parameters: { [key: string]: string }): DataSchemaValue {
        // console.debug(`JsonCodec parsing '${bytes.toString()}'`);
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
                    parsed = (<any>bytes).value; // Variant instance then
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
        // console.debug("JsonCodec serializing", value);
        let body = "";
        if (value !== undefined) {
            const obj: any = {};
            obj.payload = value;

            const className = schema.constructor.name;
            const tmpSchema = <any>schema;
            if (className === "ConsumedThingProperty") {
                const dataTypeString = this.dataTypeToString();
                if (
                    !schema ||
                    !tmpSchema[dataTypeString] ||
                    (tmpSchema.properties && !(dataTypeString in (tmpSchema.properties as Record<string, unknown>)))
                ) {
                    throw new Error(`opc:dataType field not specified for property "${schema.title}"`);
                }
                let dataType = tmpSchema[dataTypeString]
                    ? tmpSchema[dataTypeString]
                    : (tmpSchema.properties as Record<string, string>)[dataTypeString];
                dataType = this.getOPCUADataType(dataType);
                obj.dataType = dataType;
            } else if (className === "ConsumedThingAction") {
                const inputArguments = this.getInputArguments(value, tmpSchema.input);
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

    private getInputArguments(payload: any, schema?: TD.DataSchema) {
        const inputArguments: any[] = [];
        const tmpSchema = <any>schema;
        if (!tmpSchema) {
            throw new Error('Mandatory "input" field missing in the TD');
        }
        if (tmpSchema.type === "object" && !tmpSchema.properties) {
            throw new Error('Mandatory  "properties" field missing in the "input"');
        }
        const properties = tmpSchema.properties;
        const dataTypeString = this.dataTypeToString();
        if (properties) {
            // multiple inputs
            for (const key in payload) {
                const tmpObj: any = {};
                if (!(key in properties) || !(dataTypeString in properties[key])) {
                    throw new Error(`dataType field not specified for parameter "${key}"`);
                }
                const tmpDataType = properties[key][dataTypeString];
                tmpObj.dataType = this.getOPCUADataType(tmpDataType);
                tmpObj.value = payload[key];
                inputArguments.push(tmpObj);
            }
        } else {
            // single input
            if (!(dataTypeString in tmpSchema)) {
                throw new Error(`dataType field not specified for input "${payload}"`);
            }
            const tmpObj: any = {};
            const tmpDataType = tmpSchema[dataTypeString];
            tmpObj.dataType = this.getOPCUADataType(tmpDataType);
            tmpObj.value = payload;
            inputArguments.push(tmpObj);
        }
        return inputArguments;
    }
}
