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
// Binding-scoped content negotiation for OPC UA.
//
// This module is the ONE place where a form's `contentType` is turned into a
// decision about how to represent a DataValue. It deliberately does not consult
// the global ContentSerdes registry for media types that OPC UA owns, because
// that registry is a process-wide Map keyed by media type: `application/octet-stream`
// there means "Modbus register packing" (big-endian, fixed width, scalars only),
// which silently truncates an OPC UA Double to a 32-bit float.
//
// See doc/content-negotiation.md for the reasoning and the measured behaviour per OPC UA
// data type, and doc/decisions.md for why each contentType means what it does.
//

import { DataValue } from "node-opcua-data-value";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import {
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
import { NodeId } from "node-opcua-nodeid";
import { coerceInt64, coerceUInt64 } from "node-opcua-basic-types";

import { theOpcuaBinaryCodec } from "./codecs/opcua-binary-codec";

// Same stance as OpcuaJSONCodec: structures with a custom dataType are not decoded here.
const builder: ExtensionObjectBuilder = {
    getExtensionObjectConstructor(_dataTypeNodeId: NodeId): ExtensionObjectConstructorFuncWithSchema {
        throw new Error("Not implemented");
    },
};

/** How much of the DataValue the consumer asked for. */
export type OPCUAFlavour =
    /** the bare value: 42.5 */
    | "value"
    /** the value plus its OPC UA type: { Type: 11, Body: 42.5 } */
    | "variant"
    /** the whole envelope: value, StatusCode, timestamps */
    | "dataValue"
    /** OPC UA Binary, for consumers that are themselves OPC UA clients */
    | "binary"
    /** raw bytes, legal only when the Variant holds a ByteString */
    | "byteString";

/**
 * Which edition of the OPC UA JSON encoding is produced. 1.04 is the deprecated
 * Reversible/NonReversible pair (Part 6 Annex H), 1.05 the Compact/Verbose pair that
 * replaced it. Selected per form with `;version=`, defaulting to 1.04 so that existing
 * Thing Descriptions keep the payloads they were written against.
 * Decoding accepts either edition whatever this says: see detectEdition below.
 */
export type JsonEdition = "1.04" | "1.05";

/** 1.05 only: Compact omits defaults, Verbose keeps everything and names enumerations. */
export type JsonMode = "compact" | "verbose";

export interface ContentFormat {
    /** media type with parameters stripped */
    mediaType: string;
    flavour: OPCUAFlavour;
    edition: JsonEdition;
    mode: JsonMode;
    /** parameters parsed off the contentType string */
    parameters: Record<string, string>;
}

export const DEFAULT_JSON_EDITION: JsonEdition = "1.04";

function resolveEdition(
    parameters: Record<string, string>,
    mediaType: string
): { edition: JsonEdition; mode: JsonMode } {
    const version = parameters.version ?? DEFAULT_JSON_EDITION;
    if (version !== "1.04" && version !== "1.05") {
        throw new Error(
            `binding-opcua: unsupported 'version' parameter '${version}' on ${mediaType}. ` +
                `Expected 1.04 (OPC UA Reversible/NonReversible JSON) or 1.05 (Compact/Verbose).`
        );
    }
    const rawMode = parameters.mode?.toLowerCase();
    if (rawMode !== undefined && rawMode !== "compact" && rawMode !== "verbose") {
        throw new Error(
            `binding-opcua: unsupported 'mode' parameter '${parameters.mode}' on ${mediaType}. ` +
                `Expected compact or verbose.`
        );
    }
    if (rawMode !== undefined && version === "1.04") {
        throw new Error(
            `binding-opcua: the 'mode' parameter belongs to the OPC UA 1.05 JSON encoding, ` +
                `but ${mediaType} asks for version=1.04. Add version=1.05, or drop mode.`
        );
    }
    return { edition: version, mode: (rawMode as JsonMode) ?? "compact" };
}

/**
 * W3C WoT TD 1.1 section 5.3.4.2 defines the Form `contentType` default as
 * "application/json". A binding may not redefine it, so this is not configurable.
 */
export const DEFAULT_CONTENT_TYPE = "application/json";

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
    const raw = contentType ?? DEFAULT_CONTENT_TYPE;
    const mediaType = raw.split(";")[0].trim();
    const parameters = parseParameters(raw);

    const { edition, mode } = resolveEdition(parameters, mediaType);

    switch (mediaType) {
        case "application/json":
            return { mediaType, flavour: "value", edition, mode, parameters };

        case "application/opcua+json": {
            const t = (parameters.type ?? "DataValue").toLowerCase();
            const map: Record<string, OPCUAFlavour> = {
                value: "value",
                variant: "variant",
                datavalue: "dataValue",
            };
            const flavour = map[t];
            if (flavour === undefined) {
                throw new Error(
                    `binding-opcua: unsupported 'type' parameter '${parameters.type}' on ${mediaType}. ` +
                        `Expected one of: Value, Variant, DataValue.`
                );
            }
            return { mediaType, flavour, edition, mode, parameters };
        }

        case "application/opcua+octet-stream":
            return { mediaType, flavour: "binary", edition, mode, parameters };

        case "application/octet-stream":
            // Legal only for a ByteString Variant; decided at encode time when the
            // actual dataType is known. See assertByteStringOnly below.
            return { mediaType, flavour: "byteString", edition, mode, parameters };

        default:
            throw new Error(
                `binding-opcua: unsupported contentType '${raw}'. ` +
                    `Supported: application/json, application/opcua+json;type=Value|Variant|DataValue ` +
                    `(optionally ;version=1.05[;mode=compact|verbose]), ` +
                    `application/opcua+octet-stream, and application/octet-stream for ByteString values only.`
            );
    }
}

/**
 * `application/octet-stream` is only meaningful for OPC UA when the value really is
 * a byte sequence. For anything else the bytes would be produced by a codec that
 * knows nothing about OPC UA, so we refuse rather than emit a lossy encoding.
 */
function assertByteStringOnly(variant: Variant, hint: string): void {
    if (variant.dataType === DataType.ByteString && variant.arrayType !== VariantArrayType.Scalar) {
        throw new Error(
            `binding-opcua: contentType 'application/octet-stream' carries one ByteString, and ${hint} holds ` +
                `${VariantArrayType[variant.arrayType]} of ByteString, which a raw octet stream cannot frame. ` +
                `Use application/json to get the byte strings as base64, or ` +
                `application/opcua+json;type=DataValue to keep StatusCode and timestamps.`
        );
    }
    if (variant.dataType !== DataType.ByteString) {
        throw new Error(
            `binding-opcua: contentType 'application/octet-stream' is only supported when the value is a ByteString, ` +
                `but ${hint} is ${DataType[variant.dataType]}. ` +
                `Use application/json for the bare value, or application/opcua+json;type=DataValue to keep ` +
                `StatusCode and timestamps. (OPC-10101 section 6.5.3 is conditional on pass-through serialization; ` +
                `see W3C WoT TD 1.1 section 5.3.4.2 for the contentType default.)`
        );
    }
}

/**
 * Encode a DataValue according to the negotiated format.
 *
 * Returns { type, body } rather than a Content so that the caller decides how to
 * wrap it; this keeps the module free of stream plumbing.
 */
function mode105(format: ContentFormat): JsonEncoderMode105 {
    return format.mode === "verbose" ? JsonEncoderMode105.Verbose : JsonEncoderMode105.Compact;
}

export function encodeDataValue(format: ContentFormat, dataValue: DataValue, hint: string): { body: Buffer } {
    switch (format.flavour) {
        case "value": {
            // the bare value, no OPC UA decoration. 1.05 has no such encoding: both Compact
            // and Verbose carry the type, so the envelope is encoded and its payload taken.
            // That follows OPC 10000-14 section 7.2.5.4: drop the type where the node's
            // DataType already pins it. See doc/opcua-json-encoding.md.
            if (format.edition === "1.05") {
                const envelope = opcuaJsonEncodeVariant105(dataValue.value, mode105(format), []) as {
                    Value?: unknown;
                } | null;
                return { body: Buffer.from(JSON.stringify(envelope?.Value ?? null), "utf-8") };
            }
            const value = opcuaJsonEncodeVariant(dataValue.value, JsonEncoderMode.NonReversible, []);
            return { body: Buffer.from(JSON.stringify(value ?? null), "utf-8") };
        }
        case "variant": {
            const value =
                format.edition === "1.05"
                    ? opcuaJsonEncodeVariant105(dataValue.value, mode105(format), [])
                    : opcuaJsonEncodeVariant(dataValue.value, JsonEncoderMode.Reversible, []);
            return { body: Buffer.from(JSON.stringify(value ?? null), "utf-8") };
        }
        case "dataValue": {
            const value =
                format.edition === "1.05"
                    ? opcuaJsonEncodeDataValue105(dataValue, mode105(format), [])
                    : opcuaJsonEncodeDataValue(dataValue, JsonEncoderMode.Reversible, []);
            return { body: Buffer.from(JSON.stringify(value ?? null), "utf-8") };
        }
        case "binary": {
            return { body: theOpcuaBinaryCodec.valueToBytes(dataValue, { type: "object", properties: {} }) };
        }
        case "byteString": {
            assertByteStringOnly(dataValue.value, hint);
            const body = dataValue.value.value as Buffer;
            return { body: Buffer.isBuffer(body) ? body : Buffer.from(body ?? []) };
        }
        default:
            throw new Error(`binding-opcua: internal error, unhandled flavour ${format.flavour}`);
    }
}

/**
 * Coerce a JSON-decoded value into something a Variant of `dataType` accepts.
 *
 * The cases that matter: OPC UA JSON carries 64-bit integers as strings (a JSON
 * number is an IEEE-754 double and cannot round-trip past 2^53), and a ByteString
 * as base64.
 */
function coerceForDataType(value: unknown, dataType: DataType): unknown {
    switch (dataType) {
        case DataType.Int64:
            return typeof value === "string" || typeof value === "number" ? coerceInt64(value) : value;
        case DataType.UInt64:
            return typeof value === "string" || typeof value === "number" ? coerceUInt64(value) : value;
        case DataType.ByteString:
            return typeof value === "string" ? Buffer.from(value, "base64") : value;
        default:
            return value;
    }
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
        if (keys.includes("UaType") || keys.includes("UaDimensions") || keys.includes("UaStatus")) {
            return "1.05";
        }
    }
    return "1.04";
}

export function decodeToDataValue(format: ContentFormat, body: Buffer, dataType: DataType, hint: string): DataValue {
    switch (format.flavour) {
        case "value": {
            const parsed = JSON.parse(body.toString("utf-8"));
            const value = coerceForDataType(parsed, dataType);
            // coerceInt64/coerceUInt64 yield a [high, low] pair, and node-opcua cannot
            // tell that from a two-element array: the arrayType must be stated.
            const needsScalarHint =
                (dataType === DataType.Int64 || dataType === DataType.UInt64) && !Array.isArray(parsed);
            return new DataValue({
                value: needsScalarHint ? { dataType, arrayType: VariantArrayType.Scalar, value } : { dataType, value },
            });
        }
        case "variant": {
            // liberal on input: the payload's own shape decides, not the contentType
            const parsed = JSON.parse(body.toString("utf-8"));
            const variant =
                detectEdition(parsed) === "1.05"
                    ? opcuaJsonDecodeVariant105(parsed, builder, [])
                    : opcuaJsonDecodeVariant(parsed, builder, []);
            return new DataValue({ value: variant });
        }
        case "dataValue": {
            const parsed = JSON.parse(body.toString("utf-8"));
            return detectEdition(parsed) === "1.05"
                ? opcuaJsonDecodeDataValue105(parsed, builder, [])
                : opcuaJsonDecodeDataValue(parsed, builder, []);
        }
        case "binary": {
            const decoded = theOpcuaBinaryCodec.bytesToValue(body, { type: "object", properties: {} });
            return opcuaJsonDecodeDataValue(decoded, builder, []);
        }
        case "byteString": {
            if (dataType !== DataType.ByteString) {
                throw new Error(
                    `binding-opcua: contentType 'application/octet-stream' is only supported when the target is a ` +
                        `ByteString, but ${hint} expects ${DataType[dataType]}. ` +
                        `Use application/json for the bare value, or application/opcua+json;type=DataValue.`
                );
            }
            return new DataValue({ value: { dataType: DataType.ByteString, value: body } });
        }
        default:
            throw new Error(`binding-opcua: internal error, unhandled flavour ${format.flavour}`);
    }
}
