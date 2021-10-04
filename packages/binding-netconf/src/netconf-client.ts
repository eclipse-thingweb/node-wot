/*******************************************************************************
 * Copyright (c) 2019 - 2021 Contributors to the Eclipse Foundation
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
import { ProtocolClient, Content, ContentSerdes } from "@node-wot/core";
import { NetconfForm } from "./netconf";
import { SecurityScheme } from "wot-thing-description-types";
import * as AsyncNodeNetcon from "./async-node-netconf";
import * as Url from "url-parse";
import { Readable } from "stream";
import { ProtocolHelpers } from "@node-wot/core";

let DEFAULT_TARGET = "candidate";

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

    public async readResource(form: NetconfForm): Promise<Content> {
        let url = new Url(form.href);
        let ip_address = url.hostname;
        let port = parseInt(url.port);
        let xpath_query = url.pathname;
        let method = form["nc:method"] ? form["nc:method"] : "GET-CONFIG"; //default method
        let NSs = form["nc:NSs"] || {};
        let target = form["nc:target"] || DEFAULT_TARGET;

        let contentType = "application/yang-data+xml";

        if (this.client.getRouter() === null) {
            try {
                await this.client.initializeRouter(ip_address, port, this.credentials);
                await this.client.openRouter();
            } catch (err) {
                this.client.deleteRouter();
                throw err;
            }
        }

        let result: any;
        try {
            result = await this.client.rpc(xpath_query, method, NSs, target);
            result = JSON.stringify(result);
        } catch (err) {
            throw err;
        }

        return new Promise<Content>((resolve, reject) => {
            resolve({ type: contentType, body: Readable.from(Buffer.from(result)) });
        });
    }

    public async writeResource(form: NetconfForm, content: Content): Promise<any> {
        const body = await ProtocolHelpers.readStreamFully(content.body);
        let payload: any = content ? JSON.parse(body.toString()) : {};
        let url = new Url(form.href);
        let ip_address = url.hostname;
        let port = parseInt(url.port);
        let xpath_query = url.pathname;
        let method = form["nc:method"] ? form["nc:method"] : "EDIT-CONFIG";
        let NSs = form["nc:NSs"] || {};
        let target = form["nc:target"] || DEFAULT_TARGET;

        let contentType = "application/yang-data+xml";
        if (this.client.getRouter() === null) {
            try {
                await this.client.initializeRouter(ip_address, port, this.credentials);
                await this.client.openRouter();
            } catch (err) {
                this.client.deleteRouter();
                throw err;
            }
        }
        let result: any;

        NSs = { ...NSs, ...payload.NSs };
        payload = payload.payload;
        try {
            result = await this.client.rpc(xpath_query, method, NSs, target, payload);
            result = JSON.stringify(result);
        } catch (err) {
            throw err;
        }
        return new Promise<any>((resolve, reject) => {
            resolve(undefined);
        });
    }

    public async invokeResource(form: NetconfForm, content: Content): Promise<any> {
        const body = await ProtocolHelpers.readStreamFully(content.body);
        let payload: any = content ? JSON.parse(body.toString()) : {};
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
                this.client.deleteRouter();
                throw err;
            }
        }
        try {
            NSs = { ...NSs, ...payload.NSs };
            payload = payload.payload;
            result = await this.client.rpc(xpath_query, method, NSs, target, payload);
            result = JSON.stringify(result);
        } catch (err) {
            console.debug("[binding-netconf]", err);
            throw err;
        }

        let contentType = "application/yang-data+xml";
        return new Promise<Object>((resolve, reject) => {
            resolve({ type: contentType, body: result });
        });
    }

    public unlinkResource(form: NetconfForm): Promise<any> {
        return new Promise<Object>((resolve, reject) => {
            reject(new Error(`NetconfClient does not implement unlink`));
        });
    }

    public subscribeResource(
        form: NetconfForm,
        next: (value: any) => void,
        error?: (error: any) => void,
        complete?: () => void
    ): any {
        error(new Error(`NetconfClient does not implement subscribe`));
        return null;
    }

    public start(): boolean {
        return true;
    }

    public stop(): boolean {
        return true;
    }

    public setSecurity(metadata: Array<SecurityScheme>, credentials?: any): boolean {
        if (metadata === undefined || !Array.isArray(metadata) || metadata.length == 0) {
            console.warn("[binding-netconf]", `NetconfClient without security`);
            return false;
        }
        if (!credentials || (!credentials.password && !credentials.privateKey)) {
            throw new Error(`Both password and privateKey missing inside credentials`);
        }

        this.credentials = credentials;
        return true;
    }
}
