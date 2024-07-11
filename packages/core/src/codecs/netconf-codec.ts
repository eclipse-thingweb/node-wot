/********************************************************************************
 * Copyright (c) 2020 Contributors to the Eclipse Foundation
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

const { debug } = createLoggers("core", "netconf-codec");

/** default implementation offering JSON de-/serialisation */
export default class NetconfCodec implements ContentCodec {
    getMediaType(): string {
        return "application/netconf";
    }

    bytesToValue(bytes: Buffer, schema?: DataSchema, parameters?: { [key: string]: string }): DataSchemaValue {
        debug(`NetconfCodec parsing '${bytes.toString()}'`);

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

        return parsed;
    }

    valueToBytes(value: unknown, schema?: DataSchema, parameters?: { [key: string]: string }): Buffer {
        debug("NetconfCodec serializing", value);
        let body = "";
        if (value !== undefined) {
            const NSs = {};
            // TODO: is value an object? how to treat numbers and strings?
            const tmpObj = this.getPayloadNamespaces(schema, value as Record<string, unknown>, NSs, false);
            body = JSON.stringify(tmpObj);
        }

        return Buffer.from(body);
    }

    private getPayloadNamespaces(
        schema: DataSchema | undefined,
        payload: Record<string, unknown>,
        NSs: Record<string, unknown>,
        hasNamespace: boolean
    ) {
        if (!schema) {
            throw new Error(`Missing "schema" field in TD`);
        }
        if (hasNamespace) {
            // expect to have xmlns
            const properties = schema.properties;
            if (properties == null) {
                throw new Error(`Missing "properties" field in TD`);
            }
            let nsFound = false;
            let aliasNs = "";
            let value;
            // TODO: Use correct type for el
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const [key, el] of Object.entries(properties) as [string, any]) {
                if (payload[key] == null) {
                    throw new Error(`Payload is missing '${key}' field specified in TD`);
                }
                if (el["nc:attribute"] === true && payload[key] != null) {
                    // if (el.format && el.format === 'urn')
                    const ns: string = payload[key] as string;
                    aliasNs = ns.split(":")[ns.split(":").length - 1];
                    NSs[aliasNs] = payload[key];
                    nsFound = true;
                } else if (payload[key] != null) {
                    value = payload[key];
                }
            }
            if (!nsFound) {
                throw new Error(`Namespace not found in the payload`);
            } else {
                // change the payload in order to be parsed by the xpath2json library
                return { payload: aliasNs + "\\" + ":" + value, NSs };
            }
        }

        if (schema?.type === "object" && schema.properties != null) {
            // nested object, go down
            let tmpObj;
            if (schema["nc:container"] != null) {
                // check the root level
                tmpObj = this.getPayloadNamespaces(schema, payload, NSs, true); // root case
            } else {
                tmpObj = this.getPayloadNamespaces(schema.properties, payload, NSs, false);
            }

            payload = tmpObj.payload as Record<string, unknown>;
            NSs = { ...NSs, ...tmpObj.NSs };
        }

        // once here schema is properties
        for (const key in schema) {
            if (schema[key].type === "object" || hasNamespace) {
                // go down only if it is a nested object or it has a namespace
                let tmpHasNamespace = false;
                if (schema[key].properties != null && schema[key]["nc:container"] != null) {
                    tmpHasNamespace = true;
                }
                const tmpObj = this.getPayloadNamespaces(
                    schema[key],
                    payload[key] as Record<string, unknown>,
                    NSs,
                    tmpHasNamespace
                );
                payload[key] = tmpObj.payload;
                NSs = { ...NSs, ...tmpObj.NSs };
            }
        }

        return { payload, NSs }; // return objects
    }
}
