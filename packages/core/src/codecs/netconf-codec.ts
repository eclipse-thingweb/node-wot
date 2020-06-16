/********************************************************************************
 * Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
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
import * as TD from "@node-wot/td-tools";

/** default implementation offering JSON de-/serialisation */
export default class NetconfCodec implements ContentCodec {
  getMediaType(): string {
    return 'application/netconf';
  }

  bytesToValue(bytes: Buffer, schema: TD.DataSchema, parameters: { [key: string]: string }): any {
    //console.debug(`NetconfCodec parsing '${bytes.toString()}'`);

    let parsed: any;
    try {
      parsed = JSON.parse(bytes.toString());
    } catch (err) {
      if (err instanceof SyntaxError) {
        if (bytes.byteLength == 0) {
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
	  console.warn("[core]",`NetconfCodec removing { value: ... } wrapper`);
      parsed = parsed.value;
    }
    return parsed;
  }

  valueToBytes(value: any, schema: TD.DataSchema, parameters?: { [key: string]: string }): Buffer {

    //console.debug("NetconfCodec serializing", value);
    let body = "";
    if (value !== undefined) {
      let NSs = {};
		  let tmp_obj = this.getPayloadNamespaces(schema, value, NSs, false);
      body = JSON.stringify(tmp_obj);
    }

    return Buffer.from(body);
  }

  private getPayloadNamespaces(schema: any, payload: any, NSs: any, hasNamespace: boolean) {


		if (hasNamespace) { //expect to have xmlns
			let properties = schema.properties;
			if (!properties) {
				throw new Error(`Missing "properties" field in TD`);
			}
			let ns_found = false;
			let alias_ns = '';
			let value;
			for (let key in properties) {

				let el = properties[key];
				if (!(payload[key])) {
					throw new Error(`Payload is missing '${key}' field specified in TD`);
				}
				if (el["nc:attribute"] === true && payload[key]) { //if (el.format && el.format === 'urn')
					let ns = payload[key];
					alias_ns = ns.split(':')[ns.split(':').length - 1];
					NSs[alias_ns] = payload[key];
					ns_found = true;
				} else if (payload[key]) {
					value = payload[key];
				}

			}
			if (!ns_found) {
				throw new Error(`Namespace not found in the payload`);
			} else { //change the payload in order to be parsed by the xpath2json library
				payload = alias_ns + '\\' + ':' + value;
			}
			return { payload, NSs }; //return objects
		}

		if (schema && schema.type && schema.type === 'object' && schema.properties) { //nested object, go down
			let tmp_hasNamespace = false;
			let tmp_obj: any;
			if (schema.properties && schema["nc:container"]) { //check the root level
				tmp_obj = this.getPayloadNamespaces(schema, payload, NSs, true); //root case				
			} else {
				tmp_obj = this.getPayloadNamespaces(schema.properties, payload, NSs, false);
			}

			payload = tmp_obj.payload;
			NSs = { ...NSs, ...tmp_obj.NSs };
		}

		//once here schema is properties
		for (let key in schema) {
			if ((schema[key].type && schema[key].type === 'object') || hasNamespace) { //go down only if it is a nested object or it has a namespace
				let tmp_hasNamespace = false;
				if (schema[key].properties && schema[key]["nc:container"]) {
					tmp_hasNamespace = true;
				}
				let tmp_obj = this.getPayloadNamespaces(schema[key], payload[key], NSs, tmp_hasNamespace);
				payload[key] = tmp_obj.payload;
				NSs = { ...NSs, ...tmp_obj.NSs };
			}
		}

		return { payload, NSs }; //return objects
	}
}
