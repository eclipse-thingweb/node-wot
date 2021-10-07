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

import {
    opcuaJsonEncodeDataValue,
    opcuaJsonDecodeDataValue,
    opcuaJsonEncodeVariant,
    opcuaJsonDecodeVariant,
} from "node-opcua-json";
import { BinaryStream } from "node-opcua-binary-stream";

export const schemaDataValue = {
    type: ["object", "number", "integer", "string", "boolean", "array", "null"]
    /*
        type: "object",
        properties: {
            serverPicosecond: {
                type: "number"
            },
            sourcePicosecond: {
                type: "number"
            }
        },
    */
};

export class OpcuaJSONCodec implements ContentCodec {
    getMediaType(): string {
        return "application/opcua-json";
    }

    bytesToValue(bytes: Buffer, schema: DataSchema, parameters?: { [key: string]: string }): DataValue {
        const type = parameters?.type ?? "DataValue";
        let parsed = JSON.parse(bytes.toString());
        switch (type) {
            case "DataValue":
                return opcuaJsonDecodeDataValue(parsed);
            case "Variant":
                return new DataValue({ value: opcuaJsonDecodeVariant(parsed) });
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
                return new DataValue({ value });
            }
            default:
                throw new Error("[OpcuaJSONCodec|bytesToValue]: Invalid type " + type);
        }
    }

    valueToBytes(dataValue: DataValue, schema: DataSchema, parameters?: { [key: string]: string }): Buffer {
        const type = parameters?.type ?? "DataValue";
        switch (type) {
            case "DataValue":
                return Buffer.from(JSON.stringify(opcuaJsonEncodeDataValue(dataValue, true)), "ascii");
            case "Variant":
                return Buffer.from(JSON.stringify(opcuaJsonEncodeVariant(dataValue.value, true)), "ascii");
            case "Value": {
                const v = opcuaJsonEncodeVariant(dataValue.value, false);
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

export class OpcuaBinaryCodec implements ContentCodec {
    getMediaType(): string {
        return "application/opcua-binary";
    }

    bytesToValue(bytes: Buffer, schema: DataSchema, parameters?: { [key: string]: string }): DataValue {
        const binaryStream = new BinaryStream(bytes);
        const dataValue = new DataValue();
        dataValue.decode(binaryStream);
        return dataValue;
    }

    valueToBytes(dataValue: DataValue, schema: DataSchema, parameters?: { [key: string]: string }): Buffer {
        const size = dataValue.binaryStoreSize();
        const stream = new BinaryStream(size);
        dataValue.encode(stream);
        const body = stream.buffer;
        return body;
    }
}
export const theOpcuaBinaryCodec = new OpcuaBinaryCodec();
