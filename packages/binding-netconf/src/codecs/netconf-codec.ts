/********************************************************************************
 * Copyright (c) 2020 - 2021 Contributors to the Eclipse Foundation
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
import * as Url from 'url-parse';

/** default implementation offering JSON de-/serialisation */
export default class NetconfCodec {
	getMediaType(): string {
		return 'application/yang-data+xml';
	}

	bytesToValue(bytes: Buffer, schema: TD.DataSchema, parameters: { [key: string]: string }): any {
		//console.debug(`NetconfCodec parsing '${bytes.toString()}'`);

		let parsed: any;
		try {
			parsed = JSON.parse(bytes.toString());
			//get data reply
			let reply = parsed.rpc_reply.data;
			let leaf = <any>schema;
			let form = leaf.forms[0];
			leaf = form.href.split('/').splice(-1, 1); //take the first one, since there is no difference for the leaf
			leaf = leaf[0].replace(/\[(.*?)\]/g, ''); //clean the leaf from possible values
			if (!leaf) {
				throw new Error(`The href specified in TD is missing the leaf node in the Xpath`);
			}
			let url = new Url(form.href);
			let xpath_query = url.pathname;
			let tree = xpath_query.split('/').map((value, index) => {
				let val = value.replace(/\[(.*?)\]/g, '').split(":");
				return val[1] ? val[1] : val[0];
			});
			let value: any = reply;
			for(let el of tree) {
				if(el === '') {
					continue;
				}
				value = value[el];
			}
			let tmp_schema = <any> schema;
			if(!("type" in tmp_schema)) {
				throw new Error(`TD is missing the schema type`);
			}
			if(tmp_schema.type === 'object') {
				if (tmp_schema.properties && tmp_schema["xml:container"] && tmp_schema.properties.xmlns && tmp_schema.properties.xmlns["xml:attribute"]) { //now check if it contains 
					parsed = {};
					let xmlns_key = Object.keys(value.$)[0];
					parsed.xmlns = value.$[xmlns_key];
					parsed.value = value['_'].split(":")[1];
				}
			} else {
				parsed = value;
			}
			//TODO check the schema!
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

		return parsed;
	}

	valueToBytes(value: any, schema: TD.DataSchema, parameters?: { [key: string]: string }): Buffer {

		//console.debug("NetconfCodec serializing", value);
		let body = "";
		if (value !== undefined) {
			let NSs = {};
			//let leaf = value.leaf;
			let leaf = <any>schema;
			leaf = leaf.forms[0].href.split('/').splice(-1, 1); //take the first one, since there is no difference for the leaf
			leaf = leaf[0].replace(/\[(.*?)\]/g, ''); //clean the leaf from possible values
			if (!leaf) {
				throw new Error(`The href specified in TD is missing the leaf node in the Xpath`);
			}
			let tmp_obj = this.getPayloadNamespaces(schema, value, NSs, false, leaf);
			body = JSON.stringify(tmp_obj);
		}

		return Buffer.from(body);
	}

	private getPayloadNamespaces(schema: any, payload: any, NSs: any, hasNamespace: boolean, leaf: string) {

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
				if (el["xml:attribute"] === true && payload[key]) { //if (el.format && el.format === 'urn')
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
				payload = { [leaf]: alias_ns + '\\' + ':' + value };
			}
			return { payload, NSs }; //return objects
		}

		if (schema && schema.type && schema.type === 'object' && schema.properties) { //nested object, go down
			let tmp_hasNamespace = false;
			let tmp_obj: any;
			if (schema.properties && schema["xml:container"]) { //check the root level
				tmp_obj = this.getPayloadNamespaces(schema, payload, NSs, true, leaf); //root case				
			} else {
				tmp_obj = this.getPayloadNamespaces(schema.properties, payload, NSs, false, leaf);
			}

			payload = tmp_obj.payload;
			NSs = { ...NSs, ...tmp_obj.NSs };
		}

		//once here schema is properties
		for (let key in schema) {
			if ((schema[key].type && schema[key].type === 'object') || hasNamespace) { //go down only if it is a nested object or it has a namespace
				let tmp_hasNamespace = false;
				if (schema[key].properties && schema[key]["xml:container"]) {
					tmp_hasNamespace = true;
				}
				let tmp_obj = this.getPayloadNamespaces(schema[key], payload[key], NSs, tmp_hasNamespace, leaf);
				payload[key] = tmp_obj.payload;
				NSs = { ...NSs, ...tmp_obj.NSs };
			}
		}

		return { payload, NSs }; //return objects
	}
}

function mapJsonToArray(obj: any) {
	if (typeof obj === 'object') {
		console.debug("[binding-netconf]",obj)
		for (let k in obj) {
			if (obj.hasOwnProperty(k)) {
				//recursive call to scan property
				mapJsonToArray(obj[k]);
			}
		}
	} else {
		//not an Object so obj[k] here is a value
		console.debug("[binding-netconf]",obj)
	};

}
