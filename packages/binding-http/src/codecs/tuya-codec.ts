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

import { ContentCodec } from "@node-wot/core";
import * as TD from "@node-wot/td-tools";
import { DataSchemaValue } from "wot-typescript-definitions";

export default class HttpTuyaCodec implements ContentCodec {
    getMediaType(): string {
        return "application/json+tuya";
    }

    bytesToValue(bytes: Buffer, schema: TD.DataSchema, parameters: { [key: string]: string }): DataSchemaValue {
        const parsedBody = JSON.parse(bytes.toString());
        if (!parsedBody.success) throw new Error(parsedBody.msg ? parsedBody.msg : JSON.stringify(parsedBody));
        for (const key in parsedBody.result) {
            if (parsedBody.result[key].code === schema["tuya:PropertyName"]) {
                return parsedBody.result[key].value;
            }
        }
        throw new Error("Property not found");
    }

    valueToBytes(value: unknown, schema: TD.DataSchema, parameters?: { [key: string]: string }): Buffer {
        const obj = {
            commands: [
                {
                    code: schema["tuya:PropertyName"],
                    value: value,
                },
            ],
        };
        const body = JSON.stringify(obj);
        return Buffer.from(body);
    }
}
