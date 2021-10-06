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
 * CoAP client based on coap by mcollina
 */

import * as url from "url";
import * as net from "net";

import { Subscription } from "rxjs/Subscription";

// for Security definition
import * as TD from "@node-wot/td-tools";

import { ProtocolClient, Content, ContentSerdes, ProtocolHelpers } from "@node-wot/core";
import {
    CoapForm,
    CoapRequestConfig,
    CoapOption,
    CoapMethodName,
    isSupportedCoapMethod,
    isValidCoapMethod,
} from "./coap";
import CoapServer from "./coap-server";
import { Readable } from "stream";
import coap = require("coap");

export default class CoapClient implements ProtocolClient {
    // FIXME coap Agent closes socket when no messages in flight -> new socket with every request
    private agent: any;
    private readonly agentOptions: any;

    constructor(server?: CoapServer) {
        // if server is passed, feed its socket into the CoAP agent for socket re-use
        this.agent = new coap.Agent(server ? { socket: server.getSocket() } : undefined);
        this.agentOptions = server ? { socket: server.getSocket() } : {};

        // WoT-specific content formats
        coap.registerFormat(ContentSerdes.JSON_LD, 2100);
    }

    public toString(): string {
        return "[CoapClient]";
    }

    public readResource(form: CoapForm): Promise<Content> {
        return new Promise<Content>((resolve, reject) => {
            const req = this.generateRequest(form, "GET");

            console.debug("[binding-coap]", `CoapClient sending ${req.statusCode} to ${form.href}`);

            req.on("response", (res: any) => {
                console.debug("[binding-coap]", `CoapClient received ${res.code} from ${form.href}`);
                console.debug("[binding-coap]", `CoapClient received Content-Format: ${res.headers["Content-Format"]}`);

                // FIXME does not work with blockwise because of node-coap
                let contentType = res.headers["Content-Format"];
                if (!contentType) contentType = form.contentType;

                resolve({ type: contentType, body: Readable.from(res.payload) });
            });
            req.on("error", (err: Error) => reject(err));
            req.end();
        });
    }

    public writeResource(form: CoapForm, content: Content): Promise<any> {
        return new Promise<void>((resolve, reject) => {
            ProtocolHelpers.readStreamFully(content.body)
                .then((buffer) => {
                    const req = this.generateRequest(form, "PUT");

                    // TODO set Content-FOrmat

                    console.debug("[binding-coap]", `CoapClient sending ${req.statusCode} to ${form.href}`);

                    req.on("response", (res: any) => {
                        console.debug("[binding-coap]", `CoapClient received ${res.code} from ${form.href}`);
                        console.debug("[binding-coap]", `CoapClient received headers: ${JSON.stringify(res.headers)}`);
                        resolve();
                    });
                    req.on("error", (err: Error) => reject(err));
                    req.setOption("Content-Format", content.type);
                    req.write(buffer);
                    req.end();
                })
                .catch(reject);
        });
    }

    public invokeResource(form: CoapForm, content?: Content): Promise<Content> {
        return new Promise<Content>(async (resolve, reject) => {
            const req = this.generateRequest(form, "POST");

            console.debug("[binding-coap]", `CoapClient sending ${req.statusCode} to ${form.href}`);

            req.on("response", (res: any) => {
                console.debug("[binding-coap]", `CoapClient received ${res.code} from ${form.href}`);
                console.debug("[binding-coap]", `CoapClient received Content-Format: ${res.headers["Content-Format"]}`);
                console.debug("[binding-coap]", `CoapClient received headers: ${JSON.stringify(res.headers)}`);
                const contentType = res.headers["Content-Format"];
                resolve({ type: contentType, body: Readable.from(res.payload) });
            });
            req.on("error", (err: Error) => reject(err));
            if (content && content.body) {
                let buffer = await ProtocolHelpers.readStreamFully(content.body);
                req.setOption("Content-Format", content.type);
                req.write(buffer);
            }
            req.end();
        });
    }

    public unlinkResource(form: CoapForm): Promise<any> {
        return new Promise<void>((resolve, reject) => {
            let req = this.generateRequest(form, "GET", false);

            console.debug("[binding-coap]", `CoapClient sending ${req.statusCode} to ${form.href}`);

            req.on("response", (res: any) => {
                console.debug("[binding-coap]", `CoapClient received ${res.code} from ${form.href}`);
                console.debug("[binding-coap]", `CoapClient received headers: ${JSON.stringify(res.headers)}`);
                resolve();
            });
            req.on("error", (err: Error) => reject(err));
            req.end();
        });
    }

    public subscribeResource(
        form: CoapForm,
        next: (value: any) => void,
        error?: (error: any) => void,
        complete?: () => void
    ): Promise<Subscription> {
        return new Promise<Subscription>((resolve, reject) => {
            let req = this.generateRequest(form, "GET", true);

            console.debug("[binding-coap]", `CoapClient sending ${req.statusCode} to ${form.href}`);

            req.on("response", (res: any) => {
                console.debug("[binding-coap]", `CoapClient received ${res.code} from ${form.href}`);
                console.debug("[binding-coap]", `CoapClient received Content-Format: ${res.headers["Content-Format"]}`);

                // FIXME does not work with blockwise because of node-coap
                let contentType = res.headers["Content-Format"];
                if (!contentType) contentType = form.contentType;

                res.on("data", (data: any) => {
                    next({ type: contentType, body: Readable.from(res.payload) });
                });

                resolve(
                    new Subscription(() => {
                        res.close();
                        if (complete) complete();
                    })
                );
            });

            req.on("error", (err: any) => {
                error(err);
            });

            req.end();
        });
    }

    public start(): boolean {
        return true;
    }

    public stop(): boolean {
        // FIXME coap does not provide proper API to close Agent
        return true;
    }

    public setSecurity = (metadata: Array<TD.SecurityScheme>): boolean => true;

    private uriToOptions(uri: string): CoapRequestConfig {
        const requestUri = url.parse(uri);
        const agentOptions = this.agentOptions;
        agentOptions.type = net.isIPv6(requestUri.hostname) ? "udp6" : "udp4";
        this.agent = new coap.Agent(agentOptions);

        const options: CoapRequestConfig = {
            agent: this.agent,
            hostname: requestUri.hostname,
            port: requestUri.port ? parseInt(requestUri.port, 10) : 5683,
            pathname: requestUri.pathname,
            query: requestUri.query,
            observe: false,
            multicast: false,
            confirmable: true,
        };

        // TODO auth

        return options;
    }

    private determineRequestMethod(formMethod: CoapMethodName, defaultMethod: string) {
        if (isSupportedCoapMethod(formMethod)) {
            return formMethod;
        } else if (isValidCoapMethod(formMethod)) {
            // TODO: Merge with condition above when a new version of node-coap is
            //       released
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

    private generateRequest(form: CoapForm, defaultMethod: CoapMethodName, observable = false): any {
        const options: CoapRequestConfig = this.uriToOptions(form.href);

        if (form["cov:methodName"] != null) {
            const formMethodName = form["cov:methodName"];
            console.debug(`[binding-coap] CoapClient got Form "methodName" ${formMethodName}`);
            options.method = this.determineRequestMethod(formMethodName, defaultMethod);
        } else {
            options.method = defaultMethod;
        }

        options.observe = observable;

        const req = this.agent.request(options);

        // apply form data
        if (typeof form.contentType === "string") {
            console.debug("[binding-coap]", "CoapClient got Form 'contentType'", form.contentType);
            req.setOption("Accept", form.contentType);
        }
        if (Array.isArray(form["cov:options"])) {
            console.debug("[binding-coap]", "CoapClient got Form 'options'", form["cov:options"]);
            const options = form["cov:options"] as Array<CoapOption>;
            for (const option of options) {
                req.setOption(option["cov:optionName"], option["cov:optionValue"]);
            }
        } else if (typeof form["cov:options"] === "object") {
            console.warn("[binding-coap]", "CoapClient got Form SINGLE-ENTRY 'options'", form["cov:options"]);
            const option = form["cov:options"] as CoapOption;
            req.setHeader(option["cov:optionName"], option["cov:optionValue"]);
        }

        return req;
    }
}
