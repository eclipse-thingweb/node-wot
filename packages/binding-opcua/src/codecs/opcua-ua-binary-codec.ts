/********************************************************************************
 * Copyright (c) 2026 Contributors to the Eclipse Foundation
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

import { ContentCodec, DataSchema } from "@node-wot/core";
import { DataSchemaValue } from "wot-typescript-definitions";
import { DataValue } from "node-opcua-data-value";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";

import { encodeDataValue, resolveContentFormat } from "../opcua-content-negotiation";
import {
    decodeUABinaryDataValue,
    encodeUABinaryDataValue,
    findConnectionContext,
    variantToArguments,
} from "../ua-binary";

const bareValueFormat = resolveContentFormat("application/json");

/** the value application/json gives for this Variant: the same function, so the same result */
function bareValue(variant: Variant, namespaceArray: string[] = []): DataSchemaValue {
    const { body } = encodeDataValue(
        bareValueFormat,
        new DataValue({ value: variant }),
        "an octet-stream payload",
        namespaceArray
    );
    return JSON.parse(body.toString("utf-8"));
}

function isBytes(value: unknown): value is Uint8Array {
    return value instanceof Uint8Array;
}

/** The Variant of a value made only of built-in types, or undefined when there is none. */
function toBuiltInVariant(value: unknown): Variant | undefined {
    const scalar = (dataType: DataType, v: unknown) =>
        new Variant({ dataType, arrayType: VariantArrayType.Scalar, value: v });
    const array = (dataType: DataType, v: unknown[]) =>
        new Variant({ dataType, arrayType: VariantArrayType.Array, value: v });

    if (isBytes(value)) return scalar(DataType.ByteString, Buffer.from(value));
    if (typeof value === "boolean") return scalar(DataType.Boolean, value);
    // the codec does not know the node's DataType: the binding converts before the Write
    if (typeof value === "number") return scalar(DataType.Double, value);
    if (typeof value === "string") return scalar(DataType.String, value);
    if (Array.isArray(value) && value.length > 0) {
        if (value.every(isBytes))
            return array(
                DataType.ByteString,
                value.map((v) => Buffer.from(v))
            );
        if (value.every((v) => typeof v === "boolean")) return array(DataType.Boolean, value);
        if (value.every((v) => typeof v === "number")) return array(DataType.Double, value);
        if (value.every((v) => typeof v === "string")) return array(DataType.String, value);
    }
    return undefined;
}

/**
 * `application/octet-stream` for OPC UA forms: the payload is an OPC UA Binary DataValue
 * (OPC 10101 §6.5.3, OPC 10000-6 Table 80), and `value()` is what `application/json` gives.
 *
 * Registered for the `opc.tcp` scheme only (see OPCUAClientFactory), so the generic
 * OctetstreamCodec, which packs Modbus registers, stays in place for every other binding.
 *
 * Parameters the binding adds to the Content type, never to the form:
 * - `uaconn=<id>`: the session whose namespace table and structure definitions decode the
 *   payload, as the binding would;
 * - `uapart=arguments`: the payload holds action arguments as `KeyValuePair[]`.
 *
 * See doc/octet-stream-ua-binary-plan.md.
 */
export class OpcuaUABinaryCodec implements ContentCodec {
    getMediaType(): string {
        return "application/octet-stream";
    }

    bytesToValue(bytes: Buffer, _schema?: DataSchema, parameters?: { [key: string]: string }): DataSchemaValue {
        const context = findConnectionContext(parameters?.uaconn);
        const dataValue = decodeUABinaryDataValue(bytes, context?.dataTypeManager);
        if (parameters?.uapart !== "arguments") {
            return bareValue(dataValue.value, context?.namespaceArray);
        }
        const args = variantToArguments(dataValue.value);
        if (args === undefined) {
            throw new Error(
                `binding-opcua: an action output with contentType 'application/octet-stream' must hold KeyValuePair[], ` +
                    `but it holds ${DataType[dataValue.value.dataType]}.`
            );
        }
        const output: Record<string, DataSchemaValue> = {};
        for (const [name, variant] of args) {
            output[name] = bareValue(variant, context?.namespaceArray);
        }
        return output;
    }

    /**
     * A value of built-in types becomes a DataValue holding only the value (plan W1). Anything
     * else, a structure or an action input, needs the server to be encoded, so it is handed
     * over to the binding as JSON (plan section 6.7).
     */
    valueToBytes(value: unknown, _schema?: DataSchema, _parameters?: { [key: string]: string }): Buffer {
        const variant = toBuiltInVariant(value);
        if (variant !== undefined) {
            return encodeUABinaryDataValue(new DataValue({ value: variant }));
        }
        return Buffer.from(JSON.stringify(value ?? null), "utf-8");
    }
}

export const theOpcuaUABinaryCodec = new OpcuaUABinaryCodec();
