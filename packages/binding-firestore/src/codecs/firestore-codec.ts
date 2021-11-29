/********************************************************************************
 * Copyright (c) 2021 Contributors to the Eclipse Foundation
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

import * as TD from "@node-wot/td-tools";
import { Buffer } from "buffer";

let textDecoder;
try {
    const util = require("util");
    textDecoder = new util.TextDecoder("utf-8");
} catch (err) {
    textDecoder = new TextDecoder("utf-8");
}

export default class FirestoreCodec {
    getMediaType(): string {
        return "application/firestore";
    }

    bytesToValue(bytes: Buffer, schema: TD.DataSchema, parameters: { [key: string]: string }): any {
        let parsed: any;
        if (bytes) {
            if (bytes["type"] === "Buffer" && bytes["data"]) {
                parsed = textDecoder.decode(new Uint8Array(bytes["data"]));
            } else {
                parsed = bytes.toString();
            }
            if (!schema) return parsed;
            if (schema.type === "boolean") {
                if (parsed === "true" || parsed === "false") {
                    parsed = JSON.parse(parsed);
                }
                parsed = Boolean(parsed);
            } else if (schema.type === "number" || schema.type === "integer") {
                parsed = Number(parsed);
            } else if (schema.type === "object" || schema.type === "array") {
                if (parsed === "") {
                    parsed = null;
                } else {
                    parsed = JSON.parse(parsed);
                }
            }
        }
        return parsed;
    }

    valueToBytes(value: any, schema: TD.DataSchema, parameters?: { [key: string]: string }): Buffer {
        let body = "";
        if (value !== null && value !== undefined) {
            if (schema && (schema.type === "object" || schema.type === "array")) {
                body = JSON.stringify(value);
            } else {
                body = String(value);
            }
        }
        return Buffer.from(body);
    }
}
