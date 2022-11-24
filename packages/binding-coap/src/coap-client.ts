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

/**
 * CoAP client based on coap by mcollina
 */

import * as url from "url";
import * as net from "net";

import { Subscription } from "rxjs/Subscription";

// for Security definition
import * as TD from "@node-wot/td-tools";

import { ProtocolClient, Content, ContentSerdes, createLoggers } from "@node-wot/core";
import { CoapForm, CoapOption, CoapMethodName, isSupportedCoapMethod, isValidCoapMethod } from "./coap";
import CoapServer from "./coap-server";
import { Readable } from "stream";
import {
    Agent,
    registerFormat,
    AgentOptions,
    CoapRequestParams,
    IncomingMessage,
    OutgoingMessage,
    ObserveReadStream,
} from "coap";

const { debug, warn } = createLoggers("binding-coap", "coap-client");

export default class CoapClient implements ProtocolClient {
    // FIXME coap Agent closes socket when no messages in flight -> new socket with every request
    private agent: Agent;
    private readonly agentOptions: AgentOptions;

    constructor(server?: CoapServer) {
        // if server is passed, feed its socket into the CoAP agent for socket re-use
        this.agent = new Agent(server ? { socket: server.getSocket() } : undefined);
        this.agentOptions = server ? { socket: server.getSocket() } : {};

        // WoT-specific content formats
        registerFormat(ContentSerdes.JSON_LD, 2100);
    }

    public toString(): string {
        return "[CoapClient]";
    }

    public async readResource(form: CoapForm): Promise<Content> {
        const req = await this.generateRequest(form, "GET");
        debug(`CoapClient sending ${req.statusCode} to ${form.href}`);
        return new Promise<Content>((resolve, reject) => {
            req.on("response", (res: ObserveReadStream) => {
                debug(`CoapClient received ${res.code} from ${form.href}`);
                debug(`CoapClient received Content-Format: ${res.headers["Content-Format"]}`);

                // FIXME does not work with blockwise because of node-coap
                let contentType = res.headers["Content-Format"] as string;
                if (!contentType) contentType = form.contentType;

                resolve(new Content(contentType, Readable.from(res.payload)));
            });
            req.on("error", (err: Error) => reject(err));
            req.end();
        });
    }

    public writeResource(form: CoapForm, content: Content): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            content
                .toBuffer()
                .then((buffer) => {
                    const req = this.generateRequest(form, "PUT");

                    // TODO set Content-FOrmat

                    debug(`CoapClient sending ${req.statusCode} to ${form.href}`);

                    req.on("response", (res: IncomingMessage) => {
                        debug(`CoapClient received ${res.code} from ${form.href}`);
                        debug(`CoapClient received headers: ${JSON.stringify(res.headers)}`);
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
        return new Promise<Content>((resolve, reject) => {
            const req = this.generateRequest(form, "POST");

            debug(`CoapClient sending ${req.statusCode} to ${form.href}`);

            req.on("response", (res: IncomingMessage) => {
                debug(`CoapClient received ${res.code} from ${form.href}`);
                debug(`CoapClient received Content-Format: ${res.headers["Content-Format"]}`);
                debug(`CoapClient received headers: ${JSON.stringify(res.headers)}`);
                const contentType = res.headers["Content-Format"] as string;
                resolve(new Content(contentType ?? "", Readable.from(res.payload)));
            });
            req.on("error", (err: Error) => reject(err));
            (async () => {
                if (content && content.body) {
                    const buffer = await content.toBuffer();
                    req.setOption("Content-Format", content.type);
                    req.write(buffer);
                }
                req.end();
            })();
        });
    }

    public unlinkResource(form: CoapForm): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const req = this.generateRequest(form, "GET", false);

            debug(`CoapClient sending ${req.statusCode} to ${form.href}`);

            req.on("response", (res: IncomingMessage) => {
                debug(`CoapClient received ${res.code} from ${form.href}`);
                debug(`CoapClient received headers: ${JSON.stringify(res.headers)}`);
                resolve();
            });
            req.on("error", (err: Error) => reject(err));
            req.end();
        });
    }

    public subscribeResource(
        form: CoapForm,
        next: (value: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ): Promise<Subscription> {
        return new Promise<Subscription>((resolve, reject) => {
            const req = this.generateRequest(form, "GET", true);

            debug(`CoapClient sending ${req.statusCode} to ${form.href}`);

            req.on("response", (res: ObserveReadStream) => {
                debug(`CoapClient received ${res.code} from ${form.href}`);
                debug(`CoapClient received Content-Format: ${res.headers["Content-Format"]}`);

                // FIXME does not work with blockwise because of node-coap
                let contentType = res.headers["Content-Format"];
                if (!contentType) contentType = form.contentType;

                res.on("data", (data: Buffer) => {
                    next(new Content(`${contentType}`, Readable.from(res.payload)));
                });

                resolve(
                    new Subscription(() => {
                        res.close();
                        if (complete) complete();
                    })
                );
            });

            req.on("error", (err: Error) => {
                if (error) {
                    error(err);
                }
            });

            req.end();
        });
    }

    public async start(): Promise<void> {
        // do nothing
    }

    public async stop(): Promise<void> {
        this.agent.close();
    }

    public setSecurity = (metadata: Array<TD.SecurityScheme>): boolean => true;

    private uriToOptions(uri: string): CoapRequestParams {
        // eslint-disable-next-line node/no-deprecated-api
        const requestUri = url.parse(uri);
        const agentOptions = this.agentOptions;
        agentOptions.type = net.isIPv6(requestUri.hostname ?? "") ? "udp6" : "udp4";
        this.agent = new Agent(agentOptions);

        const options: CoapRequestParams = {
            agent: this.agent,
            hostname: requestUri.hostname || "",
            port: requestUri.port ? parseInt(requestUri.port, 10) : 5683,
            pathname: requestUri.pathname || "",
            query: requestUri.query || "",
            observe: false,
            multicast: false,
            confirmable: true,
        };

        // TODO auth

        return options;
    }

    private determineRequestMethod(formMethod: CoapMethodName, defaultMethod: CoapMethodName): CoapMethodName {
        if (isSupportedCoapMethod(formMethod)) {
            return formMethod;
        } else if (isValidCoapMethod(formMethod)) {
            // TODO: Merge with condition above when a new version of node-coap is
            //       released
            debug(`Method ${formMethod} is not supported yet. Using default method ${defaultMethod} instead.`);
        } else {
            debug(`Unknown method ${formMethod} found. Using default method ${defaultMethod} instead.`);
        }

        return defaultMethod;
    }

    private generateRequest(form: CoapForm, defaultMethod: CoapMethodName, observable = false): OutgoingMessage {
        const options: CoapRequestParams = this.uriToOptions(form.href);

        if (form["cov:methodName"] != null) {
            const formMethodName = form["cov:methodName"];
            debug(`CoapClient got Form "methodName" ${formMethodName}`);
            options.method = this.determineRequestMethod(formMethodName, defaultMethod);
        } else {
            options.method = defaultMethod;
        }

        options.observe = observable;

        const req = this.agent.request(options);

        // apply form data
        if (typeof form.contentType === "string") {
            debug("CoapClient got Form 'contentType'", form.contentType);
            req.setOption("Accept", form.contentType);
        }
        if (Array.isArray(form["cov:options"])) {
            debug("CoapClient got Form 'options'", form["cov:options"]);
            const options = form["cov:options"] as Array<CoapOption>;
            for (const option of options) {
                req.setOption(option["cov:optionName"], option["cov:optionValue"]);
            }
        } else if (typeof form["cov:options"] === "object") {
            warn("CoapClient got Form SINGLE-ENTRY 'options'", form["cov:options"]);
            const option = form["cov:options"] as CoapOption;
            req.setHeader(option["cov:optionName"], option["cov:optionValue"]);
        }

        return req;
    }
}
