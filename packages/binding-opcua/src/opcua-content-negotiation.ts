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
// See ../../../../node-wot-mission/06-content-types-101.md for the reasoning, and
// test/octet-stream-shapes-test.ts for the measured behaviour this replaces.
//

import { DataValue } from "node-opcua-data-value";
import { DataType, Variant } from "node-opcua-variant";
import { JsonEncoderMode, opcuaJsonEncodeDataValue, opcuaJsonEncodeVariant } from "node-opcua-json/104";
import { createLoggers } from "@node-wot/core";

import { theOpcuaBinaryCodec } from "./codecs/opcua-binary-codec";

const { debug } = createLoggers("binding-opcua", "content-negotiation");

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

export interface ContentFormat {
    /** media type with parameters stripped */
    mediaType: string;
    flavour: OPCUAFlavour;
    /** parameters parsed off the contentType string */
    parameters: Record<string, string>;
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

    switch (mediaType) {
        case "application/json":
            return { mediaType, flavour: "value", parameters };

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
            return { mediaType, flavour, parameters };
        }

        case "application/opcua+octet-stream":
            return { mediaType, flavour: "binary", parameters };

        case "application/octet-stream":
            // Legal only for a ByteString Variant; decided at encode time when the
            // actual dataType is known. See assertByteStringOnly below.
            return { mediaType, flavour: "byteString", parameters };

        default:
            throw new Error(
                `binding-opcua: unsupported contentType '${raw}'. ` +
                    `Supported: application/json, application/opcua+json;type=Value|Variant|DataValue, ` +
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
export function encodeDataValue(format: ContentFormat, dataValue: DataValue, hint: string): { body: Buffer } {
    switch (format.flavour) {
        case "value": {
            // non-reversible JSON: just the value, no OPC UA decoration
            const value = opcuaJsonEncodeVariant(dataValue.value, JsonEncoderMode.NonReversible, []);
            return { body: Buffer.from(JSON.stringify(value ?? null), "utf-8") };
        }
        case "variant": {
            const value = opcuaJsonEncodeVariant(dataValue.value, JsonEncoderMode.Reversible, []);
            return { body: Buffer.from(JSON.stringify(value ?? null), "utf-8") };
        }
        case "dataValue": {
            const value = opcuaJsonEncodeDataValue(dataValue, JsonEncoderMode.Reversible, []);
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

export function describeFormat(format: ContentFormat): string {
    debug(`format ${format.mediaType} -> ${format.flavour}`);
    return `${format.mediaType} (${format.flavour})`;
}
