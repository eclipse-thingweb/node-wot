/********************************************************************************
 * Copyright (c) 2025 Contributors to the Eclipse Foundation
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
import { BinaryStream } from "node-opcua-binary-stream";
import { DataValue } from "node-opcua-data-value";

import { opcuaJsonEncodeDataValue, opcuaJsonDecodeDataValue, DataValueJSON } from "node-opcua-json";

export class OpcuaBinaryCodec implements ContentCodec {
    getMediaType(): string {
        return "application/opcua+octet-stream"; // see Ege
    }

    bytesToValue(bytes: Buffer, schema: DataSchema, parameters?: { [key: string]: string }): DataValueJSON {
        const binaryStream = new BinaryStream(bytes);
        const dataValue = new DataValue();
        dataValue.decode(binaryStream);
        return opcuaJsonEncodeDataValue(dataValue, true);
    }

    valueToBytes(
        dataValue: DataValueJSON | DataValue,
        schema: DataSchema,
        parameters?: { [key: string]: string }
    ): Buffer {
        dataValue = dataValue instanceof DataValue ? dataValue : opcuaJsonDecodeDataValue(dataValue);

        // remove unwanted properties
        dataValue.serverPicoseconds = 0;
        dataValue.sourcePicoseconds = 0;
        dataValue.serverTimestamp = null;

        const size = dataValue.binaryStoreSize();
        const stream = new BinaryStream(size);
        dataValue.encode(stream);
        const body = stream.buffer;
        return body;
    }
}
export const theOpcuaBinaryCodec = new OpcuaBinaryCodec();
