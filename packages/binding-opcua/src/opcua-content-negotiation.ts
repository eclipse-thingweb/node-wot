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

//
// Content negotiation for OPC UA.
//
// This module is the ONE place where a form's `contentType` is turned into a decision
// about how to represent a DataValue. An `opc.tcp` form takes one media type,
// `application/opcua+uabinary`: the payload is the OPC UA Binary DataValue, and the
// `type` parameter picks what `value()` returns (the value, the Variant or the DataValue,
// as OPC UA JSON). The JSON renderings below are internal to those views.
//
// See doc/content-negotiation.md and doc/decisions.md (D8).
//

import { DataValue } from "node-opcua-data-value";
import { DataType, Variant, VariantArrayType, isValidVariant } from "node-opcua-variant";
import {
    ExtensionObjectBuilder,
    ExtensionObjectConstructorFuncWithSchema,
    JsonEncoderMode,
    opcuaJsonDecodeDataValue,
    opcuaJsonDecodeVariant,
    opcuaJsonEncodeVariant,
} from "node-opcua-json/104";
import {
    JsonEncoderMode as JsonEncoderMode105,
    opcuaJsonDecodeDataValue as opcuaJsonDecodeDataValue105,
    opcuaJsonDecodeVariant as opcuaJsonDecodeVariant105,
    opcuaJsonEncodeDataValue as opcuaJsonEncodeDataValue105,
    opcuaJsonEncodeVariant as opcuaJsonEncodeVariant105,
} from "node-opcua-json/105";
import { NodeId } from "node-opcua-nodeid";
import { coerceInt64, coerceUInt64 } from "node-opcua-basic-types";

import { decodeUABinaryDataValue, encodeUABinaryDataValue } from "./ua-binary";

/** The media type of an `opc.tcp` form: OPC 10000-6 Table 80, planned for WoT OPC UA Binding 1.1. */
export const OPCUA_UABINARY = "application/opcua+uabinary";

// Structures with a custom dataType are not decoded here: the binding resolves them through its
// session (see ua-binary.ts), and writing one is refused for now (issue #1583).
const builder: ExtensionObjectBuilder = {
    getExtensionObjectConstructor(_dataTypeNodeId: NodeId): ExtensionObjectConstructorFuncWithSchema {
        throw new Error("Not implemented");
    },
};

/** How a DataValue is represented. */
export type OPCUAFlavour =
    /** OPC UA JSON, the bare value: 42.5 */
    | "value"
    /** OPC UA JSON, the value plus its OPC UA type: { UaType: 11, Value: 42.5 } */
    | "variant"
    /** OPC UA JSON, the whole envelope: value, Status, timestamps */
    | "dataValue"
    /** OPC UA Binary: the payload of application/opcua+uabinary */
    | "uaBinary";

/** What `value()` returns for application/opcua+uabinary, chosen by its `type` parameter. */
export type OPCUAView = "value" | "variant" | "dataValue";

/**
 * The edition of an OPC UA JSON payload: 1.04 is the deprecated Reversible/NonReversible pair
 * (Part 6 Annex H), 1.05 the Compact/Verbose pair that replaced it. Each view writes one edition
 * (see encodeDataValue); a written payload may use either (see detectEdition).
 */
export type JsonEdition = "1.04" | "1.05";

export interface ContentFormat {
    /** media type with parameters stripped */
    mediaType: string;
    flavour: OPCUAFlavour;
    /** for application/opcua+uabinary: what value() returns */
    view: OPCUAView;
    /** parameters parsed off the contentType string */
    parameters: Record<string, string>;
}

/** The JSON rendering of each view of application/opcua+uabinary. */
const VIEW_FORMATS: Record<OPCUAView, ContentFormat> = {
    value: { mediaType: "", flavour: "value", view: "value", parameters: {} },
    variant: { mediaType: "", flavour: "variant", view: "variant", parameters: {} },
    dataValue: { mediaType: "", flavour: "dataValue", view: "dataValue", parameters: {} },
};

/** The JSON rendering that value() gives for a view of application/opcua+uabinary. */
export function viewFormat(view: OPCUAView): ContentFormat {
    return VIEW_FORMATS[view];
}

const VIEWS: Record<string, OPCUAView> = { value: "value", variant: "variant", datavalue: "dataValue" };

/** The media types this binding used to accept, and what replaces each. */
function replacementOf(mediaType: string, parameters: Record<string, string>): string | undefined {
    switch (mediaType) {
        case "application/json":
        case "application/octet-stream":
            return OPCUA_UABINARY;
        case "application/opcua+octet-stream":
            return `${OPCUA_UABINARY};type=DataValue`;
        case "application/opcua+json":
            return `${OPCUA_UABINARY};type=${parameters.type ?? "DataValue"}`;
        default:
            return undefined;
    }
}

function parseParameters(contentType: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const part of contentType.split(";").slice(1)) {
        const eq = part.indexOf("=");
        if (eq > 0) {
            out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
        }
    }
    return out;
}

/**
 * Turn a form's contentType into a representation decision.
 *
 * Throws a message naming the offending contentType rather than letting an
 * unsupported one fall through to a codec that will misinterpret it.
 */
export function resolveContentFormat(contentType: string | undefined): ContentFormat {
    if (contentType === undefined || contentType.trim() === "") {
        // W3C WoT TD 1.1 section 5.3.4.2 makes an omitted contentType application/json, which
        // an opc.tcp form no longer takes; reading it as something else would redefine the default
        throw new Error(
            `binding-opcua: an opc.tcp form needs contentType '${OPCUA_UABINARY}'. ` +
                `Without one, a form is application/json (W3C WoT TD 1.1 section 5.3.4.2), which this binding does not support.`
        );
    }
    const mediaType = contentType.split(";")[0].trim();
    const parameters = parseParameters(contentType);

    if (mediaType === OPCUA_UABINARY) {
        const view = VIEWS[(parameters.type ?? "Value").toLowerCase()];
        if (view === undefined) {
            throw new Error(
                `binding-opcua: unsupported 'type' parameter '${parameters.type}' on ${OPCUA_UABINARY}. ` +
                    `Expected one of: Value, Variant, DataValue.`
            );
        }
        return { mediaType, flavour: "uaBinary", view, parameters };
    }

    const replacement = replacementOf(mediaType, parameters);
    if (replacement !== undefined) {
        throw new Error(
            `binding-opcua: contentType '${contentType}' is not supported on opc.tcp forms. Use '${replacement}'.`
        );
    }
    throw new Error(
        `binding-opcua: unsupported contentType '${contentType}'. ` +
            `Supported: ${OPCUA_UABINARY}, with an optional ;type=Value|Variant|DataValue.`
    );
}

/**
 * Writing a structure needs its DataTypeDefinition and the server's namespace index, which
 * only the binding's session has. The plan gives it as OPC UA JSON 1.05, encoded by the
 * binding (question A3, issue #1583); until that lands it is refused rather than half-done.
 */
export function refuseStructure(dataType: DataType, hint: string): void {
    if (dataType === DataType.ExtensionObject) {
        throw new Error(
            `binding-opcua: writing a structure with contentType '${OPCUA_UABINARY}' is not supported yet, ` +
                `and ${hint} is a structure (ExtensionObject). ` +
                `See question A3 of doc/octet-stream-ua-binary-plan.md and ` +
                `https://github.com/eclipse-thingweb/node-wot/issues/1583.`
        );
    }
}

/**
 * Encode a DataValue according to the negotiated format.
 *
 * Returns { body } rather than a Content so that the caller decides how to wrap it; this keeps
 * the module free of stream plumbing.
 */
export function encodeDataValue(
    format: ContentFormat,
    dataValue: DataValue,
    hint: string,
    namespaceArray: string[] = []
): { body: Buffer } {
    switch (format.flavour) {
        case "value": {
            // the bare value, no OPC UA decoration: the 1.04 NonReversible encoding. 1.05 has no
            // bare value (Compact and Verbose carry the type), and the Value of its envelope is a
            // flat array for a matrix, where NonReversible nests the arrays (Annex H.8)
            const value = opcuaJsonEncodeVariant(dataValue.value, JsonEncoderMode.NonReversible, namespaceArray);
            return { body: Buffer.from(JSON.stringify(value ?? null), "utf-8") };
        }
        case "variant": {
            const value = opcuaJsonEncodeVariant105(dataValue.value, JsonEncoderMode105.Compact, namespaceArray);
            return { body: Buffer.from(JSON.stringify(value ?? null), "utf-8") };
        }
        case "dataValue": {
            const value = opcuaJsonEncodeDataValue105(dataValue, JsonEncoderMode105.Compact, namespaceArray);
            return { body: Buffer.from(JSON.stringify(value ?? null), "utf-8") };
        }
        case "uaBinary": {
            // every field the server sent: the views of value() choose what to show
            return { body: encodeUABinaryDataValue(dataValue) };
        }
        default:
            throw new Error(`binding-opcua: internal error, unhandled flavour ${format.flavour}`);
    }
}

/**
 * Coerce a JSON-decoded value into something a Variant of `dataType` accepts.
 *
 * The cases that matter: OPC UA JSON carries 64-bit integers as strings (a JSON
 * number is an IEEE-754 double and cannot round-trip past 2^53), a ByteString
 * as base64, and a DateTime as an ISO 8601 string.
 */
function coerceForDataType(value: unknown, dataType: DataType): unknown {
    switch (dataType) {
        case DataType.Int64:
            return typeof value === "string" || typeof value === "number" ? coerceInt64(value) : value;
        case DataType.UInt64:
            return typeof value === "string" || typeof value === "number" ? coerceUInt64(value) : value;
        case DataType.ByteString:
            return typeof value === "string" ? Buffer.from(value, "base64") : value;
        case DataType.DateTime:
            return typeof value === "string" ? new Date(value) : value;
        default:
            return value;
    }
}

const INTEGER_RANGES: Partial<Record<DataType, [number, number]>> = {
    [DataType.SByte]: [-128, 127],
    [DataType.Byte]: [0, 255],
    [DataType.Int16]: [-32768, 32767],
    [DataType.UInt16]: [0, 65535],
    [DataType.Int32]: [-2147483648, 2147483647],
    [DataType.UInt32]: [0, 4294967295],
};

/**
 * Whether one element converts to `dataType` without loss. It is checked before the Variant is
 * built, because node-opcua coerces silently: 300 becomes 44 in a Byte array, "abc" NaN in a
 * Double array, and 42.5 becomes 42 for an Int32.
 */
function fitsDataType(value: unknown, dataType: DataType): boolean {
    const range = INTEGER_RANGES[dataType];
    if (range !== undefined) {
        return typeof value === "number" && Number.isInteger(value) && value >= range[0] && value <= range[1];
    }
    switch (dataType) {
        case DataType.Int64:
            return (typeof value === "string" && /^-?\d+$/.test(value)) || Number.isSafeInteger(value);
        case DataType.UInt64:
            return (
                (typeof value === "string" && /^\d+$/.test(value)) ||
                (Number.isSafeInteger(value) && (value as number) >= 0)
            );
        case DataType.Float:
        case DataType.Double:
            return typeof value === "number";
        case DataType.Boolean:
            return typeof value === "boolean";
        case DataType.DateTime:
            return value instanceof Date
                ? !isNaN(value.getTime())
                : typeof value === "string" && !isNaN(Date.parse(value));
        default:
            return true;
    }
}

function toPlainValue(value: unknown): unknown {
    // node-opcua decodes numeric arrays as typed arrays
    return ArrayBuffer.isView(value) && !Buffer.isBuffer(value) ? Array.from(value as unknown as number[]) : value;
}

/** A Variant of `dataType` holding `value`, or an error naming what was given: never a lossy one. */
function typedVariant(
    value: unknown,
    dataType: DataType,
    arrayType: VariantArrayType,
    dimensions: number[] | null | undefined,
    given: string,
    hint: string
): Variant {
    const refusal = new Error(
        `binding-opcua: cannot convert the ${given} given for ${hint} ` +
            `to ${DataType[dataType]}, the DataType of the target.`
    );
    const elements = arrayType === VariantArrayType.Scalar ? [value] : value;
    if (!Array.isArray(elements) || !elements.every((v) => fitsDataType(v, dataType))) {
        throw refusal;
    }
    const coerced =
        arrayType === VariantArrayType.Scalar
            ? coerceForDataType(value, dataType)
            : elements.map((v) => coerceForDataType(v, dataType));
    let result: Variant;
    try {
        result = new Variant({ dataType, arrayType, dimensions: dimensions ?? undefined, value: coerced });
    } catch {
        throw refusal;
    }
    if (!isValidVariant(result.arrayType, dataType, result.value, result.dimensions)) {
        throw refusal;
    }
    return result;
}

/** The Variant of a value made only of built-in types, or undefined when there is none. */
export function builtInVariantOf(value: unknown): Variant | undefined {
    const scalar = (dataType: DataType, v: unknown) =>
        new Variant({ dataType, arrayType: VariantArrayType.Scalar, value: v });
    const array = (dataType: DataType, v: unknown[]) =>
        new Variant({ dataType, arrayType: VariantArrayType.Array, value: v });
    const isBytes = (v: unknown): v is Uint8Array => v instanceof Uint8Array;

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
 * Convert a decoded Variant to the DataType of the node or argument it is written to. The
 * codec only sees the JavaScript value, so 42 arrives as a Double for an Int32 node, and an
 * Int64 or a ByteString arrives as the string the Value view uses for it.
 *
 * An abstract DataType (BaseDataType, Number, Integer…) resolves to `DataType.Variant`: any
 * concrete Variant is a value of it, and is written as given.
 */
export function convertVariant(variant: Variant, dataType: DataType, hint: string): Variant {
    if (variant.dataType === dataType || variant.dataType === DataType.Null || dataType === DataType.Variant) {
        return variant;
    }
    refuseStructure(variant.dataType, hint);
    return typedVariant(
        toPlainValue(variant.value),
        dataType,
        variant.arrayType,
        variant.dimensions,
        DataType[variant.dataType],
        hint
    );
}

/** The Variant that a bare JSON value (the Value view) gives for a target of `dataType`. */
function bareValueToVariant(parsed: unknown, dataType: DataType, hint: string): Variant {
    if (Array.isArray(parsed) && parsed.some(Array.isArray)) {
        throw new Error(
            `binding-opcua: nested arrays were given for ${hint}, but a bare value has no room for ` +
                `the dimensions of a matrix. Write it with '${OPCUA_UABINARY};type=Variant'.`
        );
    }
    if (dataType === DataType.Variant) {
        // an abstract DataType: only the JSON type says what to write
        const variant = builtInVariantOf(parsed);
        if (variant === undefined) {
            throw new Error(
                `binding-opcua: the DataType of ${hint} is abstract, and the value given does not say ` +
                    `which OPC UA type to write. Write it with '${OPCUA_UABINARY};type=Variant'.`
            );
        }
        return variant;
    }
    const arrayType = Array.isArray(parsed) ? VariantArrayType.Array : VariantArrayType.Scalar;
    const given = `value ${JSON.stringify(parsed)?.slice(0, 40)}`;
    return typedVariant(parsed, dataType, arrayType, undefined, given, hint);
}

/**
 * The JSON a payload holds, or undefined when it holds none, i.e. when it is a UA Binary
 * DataValue. JSON is tried first: the first byte alone cannot tell them apart, since a JSON
 * number or string starts with a byte that is also a valid DataValue encoding mask.
 */
export function parseJsonPayload(body: Buffer): { json: unknown } | undefined {
    try {
        return { json: JSON.parse(body.toString("utf-8")) };
    } catch {
        return undefined;
    }
}

/**
 * Refuse a Variant or DataValue view that decodes to no value although the payload is not
 * `null`: the OPC UA JSON decoders return a Null Variant for any shape they do not recognise
 * (`{ "Value": 2.5 }` without `UaType`, `42`, `{}`), which must not be written to the node.
 */
function refuseUnrecognised(dataValue: DataValue, parsed: unknown, view: string, hint: string): void {
    if (dataValue.value.dataType !== DataType.Null || parsed === null) {
        return;
    }
    const record = typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    if (record.UaType === 0 || record.Type === 0 || "Status" in record || "StatusCode" in record) {
        return;
    }
    throw new Error(
        `binding-opcua: the ${view} given for ${hint} holds no value that OPC UA JSON recognises: ` +
            `${JSON.stringify(parsed)?.slice(0, 60)}. Expected for instance {"UaType":11,"Value":42.5}.`
    );
}

/**
 * Decode a request body into a DataValue, according to the negotiated format.
 *
 * `dataType` is the type the server expects for the target node; it is needed for
 * the bare-value flavour, where the payload carries no type information at all.
 */
/**
 * Which edition a payload is written in, from its own shape rather than from the
 * contentType: 1.05 names the Variant fields UaType/Value, 1.04 Type/Body. OPC 10000-6
 * Annex H defines exactly this detection so that a decoder can accept both.
 */
export function detectEdition(parsed: unknown): JsonEdition {
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed as Record<string, unknown>);
        if (keys.includes("UaType") || keys.includes("UaDimensions")) {
            return "1.05";
        }
    }
    return "1.04";
}

export function decodeToDataValue(
    format: ContentFormat,
    body: Buffer,
    dataType: DataType,
    hint: string,
    namespaceArray: string[] = []
): DataValue {
    switch (format.flavour) {
        case "value": {
            const parsed = JSON.parse(body.toString("utf-8"));
            return new DataValue({ value: bareValueToVariant(parsed, dataType, hint) });
        }
        case "variant": {
            // liberal on input: the payload's own shape decides, not the contentType
            const parsed = JSON.parse(body.toString("utf-8"));
            const variant =
                detectEdition(parsed) === "1.05"
                    ? opcuaJsonDecodeVariant105(parsed, builder, namespaceArray)
                    : opcuaJsonDecodeVariant(parsed, builder, namespaceArray);
            const dataValue = new DataValue({ value: variant });
            refuseUnrecognised(dataValue, parsed, "Variant", hint);
            return dataValue;
        }
        case "dataValue": {
            const parsed = JSON.parse(body.toString("utf-8"));
            const dataValue =
                detectEdition(parsed) === "1.05"
                    ? opcuaJsonDecodeDataValue105(parsed, builder, namespaceArray)
                    : opcuaJsonDecodeDataValue(parsed, builder, namespaceArray);
            refuseUnrecognised(dataValue, parsed, "DataValue", hint);
            return dataValue;
        }
        case "uaBinary": {
            refuseStructure(dataType, hint);
            if (parseJsonPayload(body) !== undefined) {
                // the codec hands over as JSON what it cannot encode without the session: a
                // structure, an action input (plan section 6.7), or a Variant or DataValue view,
                // whose NodeIds need the session's namespace table
                const dataValue = decodeToDataValue(viewFormat(format.view), body, dataType, hint, namespaceArray);
                if (format.view !== "value") {
                    dataValue.value = convertVariant(dataValue.value, dataType, hint);
                }
                return dataValue;
            }
            // keep the fields the consumer sent: StatusCode, timestamps (plan W1)
            const dataValue = decodeUABinaryDataValue(body);
            dataValue.value = convertVariant(dataValue.value, dataType, hint);
            return dataValue;
        }
        default:
            throw new Error(`binding-opcua: internal error, unhandled flavour ${format.flavour}`);
    }
}
