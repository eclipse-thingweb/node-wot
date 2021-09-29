/********************************************************************************
 * Copyright (c) 2018 - 2021 Contributors to the Eclipse Foundation
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
 * CoAPS client based on node-coap-client by AlCalzone
 */

import * as url from "url";
import * as TD from "@node-wot/td-tools";

import { Subscription } from "rxjs/Subscription";

import { ProtocolClient, Content } from "@node-wot/core";
import { CoapForm, CoapMethodName, isValidCoapMethod, isSupportedCoapMethod } from "./coap";
const coaps = require("node-coap-client").CoapClient;

export default class CoapsClient implements ProtocolClient {
    // FIXME coap Agent closes socket when no messages in flight -> new socket with every request
    private authorization: any;

    public toString(): string {
        return "[CoapsClient]";
    }

    public readResource(form: CoapForm): Promise<Content> {
        return new Promise<Content>((resolve, reject) => {
            this.generateRequest(form, "GET")
                .then((res: any) => {
                    console.debug("[binding-coap]", `CoapsClient received ${res.code} from ${form.href}`);

                    // FIXME node-coap-client does not support options
                    let contentType; // = res.format[...]
                    if (!contentType) contentType = form.contentType;

                    resolve({ type: contentType, body: res.payload });
                })
                .catch((err: any) => {
                    reject(err);
                });
        });
    }

    public writeResource(form: CoapForm, content: Content): Promise<any> {
        return new Promise<void>((resolve, reject) => {
            this.generateRequest(form, "PUT", content)
                .then((res: any) => {
                    console.debug("[binding-coap]", `CoapsClient received ${res.code} from ${form.href}`);

                    resolve();
                })
                .catch((err: any) => {
                    reject(err);
                });
        });
    }

    public invokeResource(form: CoapForm, content?: Content): Promise<Content> {
        return new Promise<Content>((resolve, reject) => {
            this.generateRequest(form, "POST", content)
                .then((res: any) => {
                    console.debug("[binding-coap]", `CoapsClient received ${res.code} from ${form.href}`);

                    // FIXME node-coap-client does not support options
                    let contentType; // = res.format[...]
                    if (!contentType) contentType = form.contentType;

                    resolve({ type: contentType, body: res.payload });
                })
                .catch((err: any) => {
                    reject(err);
                });
        });
    }

    public unlinkResource(form: CoapForm): Promise<any> {
        return new Promise<void>((resolve, reject) => {
            this.generateRequest(form, "DELETE")
                .then((res: any) => {
                    console.debug("[binding-coap]", `CoapsClient received ${res.code} from ${form.href}`);
                    console.debug("[binding-coap]", `CoapsClient received headers: ${JSON.stringify(res.format)}`);
                    resolve();
                })
                .catch((err: any) => {
                    reject(err);
                });
        });
    }

    public subscribeResource(
        form: CoapForm,
        next: (value: any) => void,
        error?: (error: any) => void,
        complete?: () => void
    ): Promise<Subscription> {
        return new Promise<Subscription>((resolve, reject) => {
            let requestUri = url.parse(form.href.replace(/$coaps/, "https"));
            coaps.setSecurityParams(requestUri.hostname, this.authorization);

            coaps
                .observe(form.href, "GET", next)
                .then(() => {
                    resolve(
                        new Subscription(() => {
                            coaps.stopObserving(form.href);
                            complete();
                        })
                    );
                })
                .catch((err: any) => {
                    error(err);
                    reject(err);
                });
        });
    }

    public start(): boolean {
        return true;
    }

    public stop(): boolean {
        // FIXME coap does not provide proper API to close Agent
        return true;
    }

    public setSecurity(metadata: Array<TD.SecurityScheme>, credentials?: any): boolean {
        if (metadata === undefined || !Array.isArray(metadata) || metadata.length === 0) {
            console.warn("[binding-coap]", `CoapsClient received empty security metadata`);
            return false;
        }

        const security: TD.SecurityScheme = metadata[0];

        if (security.scheme === "psk") {
            this.authorization = { psk: {} };
            this.authorization.psk[credentials.identity] = credentials.psk;
        } else if (security.scheme === "apikey") {
            console.error("[binding-coap]", `CoapsClient cannot use Apikey: Not implemented`);
            return false;
        } else {
            console.error("[binding-coap]", `CoapsClient cannot set security scheme '${security.scheme}'`);
            console.dir(metadata);
            return false;
        }

        // TODO: node-coap-client does not support proxy / options in general :o
        /*
    if (security.proxyURI) {
      if (this.proxyOptions !== null) {
        console.info(`HttpClient overriding client-side proxy with security proxyURI '${security.proxyURI}`);
      }

      this.proxyOptions = this.uriToOptions(security.proxyURI);

      if (metadata.proxyauthorization == "Basic") {
        this.proxyOptions.headers = {};
        this.proxyOptions.headers['Proxy-Authorization'] = "Basic " + Buffer.from(credentials.username + ":" + credentials.password).toString('base64');
      } else if (metadata.proxyauthorization == "Bearer") {
        this.proxyOptions.headers = {};
        this.proxyOptions.headers['Proxy-Authorization'] = "Bearer " + credentials.token;
      }
    }
    */

        console.debug("[binding-coap]", `CoapsClient using security scheme '${security.scheme}'`);
        return true;
    }

    private determineRequestMethod(formMethod: CoapMethodName, defaultMethod: string) {
        if (isSupportedCoapMethod(formMethod)) {
            return formMethod;
        } else if (isValidCoapMethod(formMethod)) {
            console.debug(
                `[binding-coap] Method ${formMethod} is not supported yet.`,
                `Using default method ${defaultMethod} instead.`
            );
        } else {
            console.debug(
                `[binding-coap] Unknown method ${formMethod} found.`,
                `Using default method ${defaultMethod} instead.`
            );
        }

        return defaultMethod;
    }

    private generateRequest(form: CoapForm, defaultMethod: CoapMethodName, content?: Content): any {
        // url only works with http*
        const requestUri = new URL(form.href.replace(/$coaps/, "https"));
        coaps.setSecurityParams(requestUri.hostname, this.authorization);

        let method;

        if (form["cov:methodName"] != null) {
            const formMethodName = form["cov:methodName"];
            console.debug(`[binding-coap] CoapClient got Form "methodName" ${formMethodName}`);
            method = this.determineRequestMethod(formMethodName, defaultMethod);
        } else {
            method = defaultMethod;
        }

        console.debug("[binding-coap]", `CoapsClient sending ${method} to ${form.href}`);
        const req = coaps.request(
            form.href /* string */,
            method.toLowerCase() /* "get" | "post" | "put" | "delete" */,
            content ? content.body : undefined /* Buffer */
        );

        return req;
    }
}
