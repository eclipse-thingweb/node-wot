/********************************************************************************
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
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

import { ContentCodec } from "../content-serdes";
import { DataSchema, DataSchemaValue } from "wot-typescript-definitions";
import { createLoggers } from "../logger";
import { decode, encode } from "cbor";

const { debug } = createLoggers("core", "cbor-codec");

// TODO: Add support for custom tag encoding/decoding

/** Codec for CBOR de-/serialisation. */
export default class CborCodec implements ContentCodec {
    private subMediaType: string;

    constructor(subMediaType?: string) {
        this.subMediaType = subMediaType ?? "application/cbor";
    }

    getMediaType(): string {
        return this.subMediaType;
    }

    bytesToValue(bytes: Buffer, schema?: DataSchema, parameters?: { [key: string]: string }): DataSchemaValue {
        debug(`CborCodec parsing '${bytes.toString()}'`);

        try {
            return decode(bytes);
        } catch (err) {
            if (bytes.byteLength === 0) {
                return null;
            }

            throw err;
        }
    }

    valueToBytes(value: unknown, schema?: DataSchema, parameters?: { [key: string]: string }): Buffer {
        debug("CborCodec serializing", value);

        if (value === undefined) {
            return Buffer.alloc(0);
        }

        return encode(value);
    }
}
