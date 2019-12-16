/*******************************************************************************
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

/**
 * Netconf protocol binding
 */
import { ProtocolClient, Content } from "@node-wot/core"
import { NetconfForm } from "./netconf";
import * as TD from "@node-wot/td-tools";
import * as AsyncNodeNetcon from './async-node-netconf';
import * as Url from 'url-parse';


let DEFAULT_TARGET = 'candidate'


export default class NetconfClient implements ProtocolClient {
	private client: AsyncNodeNetcon.Client;
	private credentials: any;
	constructor() {
		this.client = new AsyncNodeNetcon.Client();
		this.credentials = null;
	}

	public toString() {
		return "[NetconfClient]";
	}

	public async readResource(form: NetconfForm, schema?: TD.BaseSchema): Promise<Content> {
		let url = new Url(form.href);
		let ip_address = url.hostname;
		let port = parseInt(url.port);
		let xpath_query = url.pathname;
		let method = form["nc:method"] ? form["nc:method"] : "GET-CONFIG"; //default method
		let NSs = form["nc:NSs"] || {};
		let target = form["nc:target"] || DEFAULT_TARGET;

		let contentType = "application/json";

		if (this.client.getRouter() === null) {
			try {
				await this.client.initializeRouter(ip_address, port, this.credentials);
				await this.client.openRouter();
			} catch (err) {
				console.log(err);
				throw err;
			}
		}

		let result: any;
		try {
			result = await this.client.rpc(xpath_query, method, NSs, target);
			result = JSON.stringify(result);
		} catch (err) {
			console.log(err);
			throw err;
		}

		return new Promise<Content>((resolve, reject) => {
			resolve({ type: contentType, body: Buffer.from(result) });
		});
	}

	public async writeResource(form: NetconfForm, content: Content, schema?: TD.BaseSchema): Promise<any> {

		let payload: any = JSON.parse((content.body).toString());
		let url = new Url(form.href);
		let ip_address = url.hostname;
		let port = parseInt(url.port);
		let xpath_query = url.pathname;
		let method = form["nc:method"] ? form["nc:method"] : "EDIT-CONFIG";
		let NSs = form["nc:NSs"] || {};
		let target = form["nc:target"] || DEFAULT_TARGET;

		let contentType = "application/json";
		if (this.client.getRouter() === null) {
			try {
				await this.client.initializeRouter(ip_address, port, this.credentials);
				await this.client.openRouter();
			} catch (err) {
				console.log(err);
				throw err;
			}
		}
		let result: any;
		let tmp_schema = <any>schema;
		let tmp_obj = this.getPayloadNamespaces(tmp_schema, payload, NSs, false);
		payload = tmp_obj.payload;
		NSs = tmp_obj.NSs;
		try {
			result = await this.client.rpc(xpath_query, method, NSs, target, payload);
			result = JSON.stringify(result);
		} catch (err) {
			console.log(err);
			throw err;
		}
		return new Promise<any>((resolve, reject) => {
			resolve();
		});
	}

	public async invokeResource(form: NetconfForm, content: Content, input?: TD.DataSchema, output?: TD.DataSchema): Promise<any> {

		let payload: any = JSON.parse((content.body).toString());
		let url = new Url(form.href);
		let ip_address = url.hostname;
		let port = parseInt(url.port);
		let xpath_query = url.pathname;
		let method = form["nc:method"] ? form["nc:method"] : "RPC";
		let NSs = form["nc:NSs"] || {};
		let target = form["nc:target"] || DEFAULT_TARGET;
		let result: any;

		if (this.client.getRouter() === null) {
			try {
				await this.client.initializeRouter(ip_address, port, this.credentials);
				await this.client.openRouter();
			} catch (err) {
				console.log(err);
				throw err;
			}

		}
		try {
			let tmp_schema = <any>input;
			let tmp_obj = this.getPayloadNamespaces(tmp_schema, payload, NSs, false);
			payload = tmp_obj.payload;
			NSs = tmp_obj.NSs;
			result = await this.client.rpc(xpath_query, method, NSs, target, payload);
			result = JSON.stringify(result);
		} catch (err) {
			console.log(err);
			throw err;
		}

		let contentType = "application/json";
		return new Promise<Object>((resolve, reject) => {
			resolve({ type: contentType, body: result });
		});
	}

	public unlinkResource(form: NetconfForm): Promise<any> {
		return new Promise<Object>((resolve, reject) => {
			reject(new Error(`NetconfClient does not implement unlink`));
		});
	}

	public subscribeResource(form: NetconfForm, next: ((value: any) => void), error?: (error: any) => void, complete?: () => void): any {
		error(new Error(`NetconfClient does not implement subscribe`));
		return null;
	}

	public start(): boolean {
		return true;
	}

	public stop(): boolean {
		return true;
	}

	public setSecurity(metadata: Array<TD.SecurityScheme>, credentials?: any): boolean {

		if (metadata === undefined || !Array.isArray(metadata) || metadata.length == 0) {
			console.warn(`NetconfClient without security`);
			return false;
		}
		if (!credentials || (!(credentials.password) && !(credentials.privateKey))) {
			throw new Error(`Both password and privateKey missing inside credentials`);
		}

		this.credentials = credentials;
		return true;
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

		if (schema.type && schema.type === 'object' && schema.properties) { //nested object, go down
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
			if ((schema[key].type && schema[key].type === 'object') || hasNamespace) { //go down only if it a nested object or it has a namespace
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
