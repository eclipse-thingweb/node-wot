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

import { ContentCodec } from "../content-serdes";
import { DataSchema, DataSchemaValue } from "wot-typescript-definitions";

export default class TextCodec implements ContentCodec {
    private subMediaType: string;

    constructor(subMediaType?: string) {
        if (!subMediaType) {
            this.subMediaType = "text/plain";
        } else {
            this.subMediaType = subMediaType;
        }
    }

    getMediaType(): string {
        return this.subMediaType;
    }

    bytesToValue(bytes: Buffer, schema: DataSchema, parameters: { [key: string]: string }): DataSchemaValue {
        // console.debug(`TextCodec parsing '${bytes.toString()}'`);

        const parsed = bytes.toString(parameters.charset as BufferEncoding);

        // TODO apply schema to convert string to real type

        return parsed;
    }

    valueToBytes(value: unknown, schema: DataSchema, parameters?: { [key: string]: string }): Buffer {
        // console.debug(`TextCodec serializing '${value}'`);
        let body = "";
        if (value !== undefined) {
            body = value.toString();
        }

        // type BufferEncoding = "ascii" | "utf8" | "utf-8" | "utf16le" | "ucs2" | "ucs-2" | "base64" | "latin1" | "binary" | "hex";
        let be: BufferEncoding;
        if (parameters && parameters.charset) {
            switch (parameters.charset) {
                case "ascii":
                    be = "ascii";
                    break;
                case "utf8":
                    be = "utf8";
                    break;
                case "utf-8":
                    be = "utf-8";
                    break;
                case "utf16le":
                    be = "utf16le";
                    break;
                case "ucs2":
                    be = "ucs2";
                    break;
                case "ucs-2":
                    be = "ucs-2";
                    break;
                case "base64":
                    be = "base64";
                    break;
                case "latin1":
                    be = "latin1";
                    break;
                case "binary":
                    be = "binary";
                    break;
                case "hex":
                    be = "hex";
                    break;
            }
        }

        if (be) {
            return Buffer.from(body, be);
        } else {
            return Buffer.from(body);
        }
    }
}
