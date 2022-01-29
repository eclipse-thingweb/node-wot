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

import * as TD from "@node-wot/td-tools";
import Url from "url-parse";

/** default implementation offering JSON de-/serialisation */
export default class NetconfCodec {
    getMediaType(): string {
        return "application/yang-data+xml";
    }

    bytesToValue(bytes: Buffer, schema: TD.DataSchema, parameters: { [key: string]: string }): any {
        // console.debug(`NetconfCodec parsing '${bytes.toString()}'`);

        let parsed: any;
        try {
            parsed = JSON.parse(bytes.toString());
            // get data reply
            const reply = parsed.rpc_reply.data;
            let leaf = <any>schema;
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
            let value: any = reply;
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
            // TODO check the schema!
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

    valueToBytes(value: any, schema: TD.DataSchema, parameters?: { [key: string]: string }): Buffer {
        // console.debug("NetconfCodec serializing", value);
        let body = "";
        if (value !== undefined) {
            const NSs = {};
            // let leaf = value.leaf;
            let leaf = <any>schema;
            leaf = leaf.forms[0].href.split("/").splice(-1, 1); // take the first one, since there is no difference for the leaf
            leaf = leaf[0].replace(/\[(.*?)\]/g, ""); // clean the leaf from possible values
            if (!leaf) {
                throw new Error(`The href specified in TD is missing the leaf node in the Xpath`);
            }
            const tmpObj = this.getPayloadNamespaces(schema, value, NSs, false, leaf);
            body = JSON.stringify(tmpObj);
        }

        return Buffer.from(body);
    }

    private getPayloadNamespaces(schema: any, payload: any, NSs: any, hasNamespace: boolean, leaf: string) {
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
                    NSs[aliasNs] = payload[key];
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
            return { payload, NSs }; // return objects
        }

        if (schema && schema.type && schema.type === "object" && schema.properties) {
            // nested object, go down
            const tmpHasNamespace = false;
            let tmpObj: any;
            if (schema.properties && schema["xml:container"]) {
                // check the root level
                tmpObj = this.getPayloadNamespaces(schema, payload, NSs, true, leaf); // root case
            } else {
                tmpObj = this.getPayloadNamespaces(schema.properties, payload, NSs, false, leaf);
            }

            payload = tmpObj.payload;
            NSs = { ...NSs, ...tmpObj.NSs };
        }

        // once here schema is properties
        for (const key in schema) {
            if ((schema[key].type && schema[key].type === "object") || hasNamespace) {
                // go down only if it is a nested object or it has a namespace
                let tmpHasNamespace = false;
                if (schema[key].properties && schema[key]["xml:container"]) {
                    tmpHasNamespace = true;
                }
                const tmpObj = this.getPayloadNamespaces(schema[key], payload[key], NSs, tmpHasNamespace, leaf);
                payload[key] = tmpObj.payload;
                NSs = { ...NSs, ...tmpObj.NSs };
            }
        }

        return { payload, NSs }; // return objects
    }
}

export function mapJsonToArray(obj: any): void {
    if (typeof obj === "object") {
        console.debug("[binding-netconf]", obj);
        for (const k in obj) {
            if (Object.prototype.hasOwnProperty.call(k)) {
                // recursive call to scan property
                mapJsonToArray(obj[k]);
            }
        }
    } else {
        // not an Object so obj[k] here is a value
        console.debug("[binding-netconf]", obj);
    }
}
