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

/**
 * `application/octet-stream` for OPC UA forms only.
 *
 * Registered for the `opc.tcp` scheme (see OPCUAClientFactory), so it applies to OPC UA
 * forms and leaves the generic OctetstreamCodec — which packs Modbus registers — in place
 * for every other binding.
 *
 * The bytes on the wire are the ByteString itself, with nothing added. In a Thing
 * Description the value is a base64 string, which is how OPC UA JSON carries a ByteString
 * too, so the same TD `"type": "string"` describes both. `arrayBuffer()` still hands back
 * the untouched bytes.
 *
 * Only a scalar ByteString can be represented this way: a sequence of byte strings has no
 * framing in a raw octet stream. The binding refuses everything else before reaching here
 * (see opcua-content-negotiation.ts); the checks below cover direct use of the codec.
 */
export class OpcuaByteStringCodec implements ContentCodec {
    getMediaType(): string {
        return "application/octet-stream";
    }

    bytesToValue(bytes: Buffer, _schema?: DataSchema, _parameters?: { [key: string]: string }): DataSchemaValue {
        return bytes.toString("base64");
    }

    valueToBytes(value: unknown, _schema?: DataSchema, _parameters?: { [key: string]: string }): Buffer {
        if (Buffer.isBuffer(value)) {
            return value;
        }
        if (value instanceof Uint8Array) {
            return Buffer.from(value);
        }
        if (typeof value === "string") {
            return Buffer.from(value, "base64");
        }
        throw new Error(
            `binding-opcua: contentType 'application/octet-stream' carries the bytes of a single ByteString, ` +
                `so the value must be a Buffer, a Uint8Array or a base64 string, but it is ` +
                `${Array.isArray(value) ? "an array" : typeof value}. ` +
                `Use application/json for the bare value, or application/opcua+json;type=DataValue to keep ` +
                `StatusCode and timestamps.`
        );
    }
}

export const theOpcuaByteStringCodec = new OpcuaByteStringCodec();
