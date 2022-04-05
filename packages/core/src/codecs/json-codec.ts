/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
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

import { ContentSerdes, ContentCodec } from "../content-serdes";
import { DataSchema, DataSchemaValue } from "wot-typescript-definitions";

/** default implementation offering JSON de-/serialisation */
export default class JsonCodec implements ContentCodec {
    private subMediaType: string;

    constructor(subMediaType?: string) {
        if (!subMediaType) {
            this.subMediaType = ContentSerdes.DEFAULT; // 'application/json'
        } else {
            this.subMediaType = subMediaType;
        }
    }

    getMediaType(): string {
        return this.subMediaType;
    }

    bytesToValue(bytes: Buffer, schema: DataSchema, parameters: { [key: string]: string }): DataSchemaValue {
        // console.debug(`JsonCodec parsing '${bytes.toString()}'`);

        let parsed;
        try {
            parsed = JSON.parse(bytes.toString());
        } catch (err) {
            if (err instanceof SyntaxError) {
                if (bytes.byteLength === 0) {
                    // empty payload -> void/undefined
                    parsed = undefined;
                } else {
                    // be relaxed about what is received -> string without quotes
                    parsed = bytes.toString();
                }
            } else {
                throw err;
            }
        }

        // TODO validate using schema

        // remove legacy wrapping and use RFC 7159
        // TODO remove once dropped from all PlugFest implementation
        if (parsed && parsed.value !== undefined) {
            console.warn("[core/json-codec]", `JsonCodec removing { value: ... } wrapper`);
            parsed = parsed.value;
        }
        return parsed;
    }

    valueToBytes(value: unknown, schema: DataSchema, parameters?: { [key: string]: string }): Buffer {
        // console.debug("JsonCodec serializing", value);
        let body = "";
        if (value !== undefined) {
            body = JSON.stringify(value);
        }
        return Buffer.from(body);
    }
}
