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

import { createDebugLogger } from "@node-wot/core";
import * as TD from "@node-wot/td-tools";
import Url from "url-parse";
import { DataSchemaValue } from "wot-typescript-definitions";

const debug = createDebugLogger("binding-netconf", "netconf-codec");

interface PayloadNamespaces {
    payload: unknown;
    namespaces: Record<string, string>;
}

/** default implementation offering JSON de-/serialisation */
export default class NetconfCodec {
    getMediaType(): string {
        return "application/yang-data+xml";
    }

    bytesToValue(bytes: Buffer, schema: TD.DataSchema, parameters: { [key: string]: string }): DataSchemaValue {
        debug(`NetconfCodec parsing '${bytes.toString()}'`);

        try {
            let parsed = JSON.parse(bytes.toString());
            // get data reply
            const reply = parsed.rpc_reply.data;
            let leaf = schema;
            const form = leaf.forms[0];
            leaf = form.href.split("/").splice(-1, 1); // take the first one, since there is no difference for the leaf
            leaf = leaf[0].replace(/\[(.*?)\]/g, ""); // clean the leaf from possible values
            if (!leaf) {
                throw new Error(`The href specified in TD is missing the leaf node in the Xpath`);
            }
            const url = new Url(form.href);
            const xpathQuery = url.pathname;
            const tree = xpathQuery.split("/").map((value, index) => {
                const val = value.replace(/\[(.*?)\]/g, "").split(":");
                return val[1] ? val[1] : val[0];
            });
            let value = reply;
            for (const el of tree) {
                if (el === "") {
                    continue;
                }
                value = value[el];
            }
            const tmpSchema = schema;
            if (!("type" in tmpSchema)) {
                throw new Error(`TD is missing the schema type`);
            }
            if (tmpSchema.type === "object") {
                if (
                    tmpSchema.properties &&
                    tmpSchema["xml:container"] &&
                    tmpSchema.properties.xmlns &&
                    tmpSchema.properties.xmlns["xml:attribute"]
                ) {
                    // now check if it contains
                    parsed = {};
                    const xmlnsKey = Object.keys(value.$)[0];
                    parsed.xmlns = value.$[xmlnsKey];
                    parsed.value = value._.split(":")[1];
                }
            } else {
                parsed = value;
            }

            return parsed;
            // TODO check the schema!
        } catch (err) {
            if (err instanceof SyntaxError) {
                if (bytes.byteLength === 0) {
                    // empty payload -> void/undefined
                    return undefined;
                } else {
                    // be relaxed about what is received -> string without quotes
                    return bytes.toString();
                }
            } else {
                throw err;
            }
        }
    }

    valueToBytes(value: unknown, schema: TD.DataSchema, parameters?: { [key: string]: string }): Buffer {
        debug(`NetconfCodec serializing ${value}`);
        let body = "";
        if (value !== undefined) {
            const NSs = {};
            let leaf = schema.forms[0].href.split("/").splice(-1, 1); // take the first one, since there is no difference for the leaf
            leaf = leaf[0].replace(/\[(.*?)\]/g, ""); // clean the leaf from possible values
            if (!leaf) {
                throw new Error(`The href specified in TD is missing the leaf node in the Xpath`);
            }
            const tmpObj = this.getPayloadNamespaces(schema, value, NSs, false, leaf);
            body = JSON.stringify(tmpObj);
        }

        return Buffer.from(body);
    }

    private getPayloadNamespaces(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schema: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: any,
        namespaces: Record<string, string>,
        hasNamespace: boolean,
        leaf: string
    ): PayloadNamespaces {
        if (hasNamespace) {
            // expect to have xmlns
            const properties = schema.properties;
            if (!properties) {
                throw new Error(`Missing "properties" field in TD`);
            }
            let nsFound = false;
            let aliasNs = "";
            let value;
            for (const key in properties) {
                const el = properties[key];
                if (!payload[key]) {
                    throw new Error(`Payload is missing '${key}' field specified in TD`);
                }
                if (el["xml:attribute"] === true && payload[key]) {
                    // if (el.format && el.format === 'urn')
                    const ns = payload[key];
                    aliasNs = ns.split(":")[ns.split(":").length - 1];
                    namespaces[aliasNs] = payload[key];
                    nsFound = true;
                } else if (payload[key]) {
                    value = payload[key];
                }
            }
            if (!nsFound) {
                throw new Error(`Namespace not found in the payload`);
            } else {
                // change the payload in order to be parsed by the xpath2json library
                payload = { [leaf]: aliasNs + "\\" + ":" + value };
            }
            return { payload, namespaces }; // return objects
        }

        if (schema && schema.type && schema.type === "object" && schema.properties) {
            // nested object, go down
            let tmpObj: PayloadNamespaces;
            if (schema.properties && schema["xml:container"]) {
                // check the root level
                tmpObj = this.getPayloadNamespaces(schema, payload, namespaces, true, leaf); // root case
            } else {
                tmpObj = this.getPayloadNamespaces(schema.properties, payload, namespaces, false, leaf);
            }

            payload = tmpObj.payload;
            namespaces = { ...namespaces, ...tmpObj.namespaces };
        }

        // once here schema is properties
        for (const key in schema) {
            if ((schema[key].type && schema[key].type === "object") || hasNamespace) {
                // go down only if it is a nested object or it has a namespace
                let tmpHasNamespace = false;
                if (schema[key].properties && schema[key]["xml:container"]) {
                    tmpHasNamespace = true;
                }
                const tmpObj = this.getPayloadNamespaces(schema[key], payload[key], namespaces, tmpHasNamespace, leaf);
                payload[key] = tmpObj.payload;
                namespaces = { ...namespaces, ...tmpObj.namespaces };
            }
        }

        return { payload, namespaces }; // return objects
    }
}
