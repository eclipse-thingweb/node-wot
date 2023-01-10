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
 * HTTP client based on http
 */

import * as http from "http";
import * as https from "https";

import { Subscription } from "rxjs/Subscription";

import * as TD from "@node-wot/td-tools";
// for Security definition

import { ProtocolClient, Content, ProtocolHelpers, createLoggers } from "@node-wot/core";
import { HttpForm, HttpHeader, HttpConfig, HTTPMethodName, TuyaCustomBearerSecurityScheme } from "./http";
import fetch, { Request, RequestInit, Response } from "node-fetch";
import { Buffer } from "buffer";
import OAuthManager, { OAuthClientConfiguration, OAuthResourceOwnerConfiguration } from "./oauth-manager";
import {
    BasicCredential,
    Credential,
    BearerCredential,
    BasicKeyCredential,
    OAuthCredential,
    BasicCredentialConfiguration,
    BearerCredentialConfiguration,
    BasicKeyCredentialConfiguration,
    TuyaCustomBearer,
    TuyaCustomBearerCredentialConfiguration,
} from "./credential";
import { LongPollingSubscription, SSESubscription, InternalSubscription } from "./subscription-protocols";
import { Readable } from "stream";

const { debug, warn, error } = createLoggers("binding-http", "http-client-impl");

export default class HttpClient implements ProtocolClient {
    private readonly agent: http.Agent;
    private readonly provider: "https" | "http";
    private proxyRequest: Request = null;
    private allowSelfSigned = false;
    private oauth: OAuthManager;

    private credential: Credential = null;

    private activeSubscriptions = new Map<string, InternalSubscription>();

    constructor(config: HttpConfig = null, secure = false, oauthManager: OAuthManager = new OAuthManager()) {
        // config proxy by client side (not from TD)
        if (config !== null && config.proxy && config.proxy.href) {
            this.proxyRequest = new Request(HttpClient.fixLocalhostName(config.proxy.href));

            if (config.proxy.scheme === "basic") {
                if (
                    !Object.prototype.hasOwnProperty.call(config.proxy, "username") ||
                    !Object.prototype.hasOwnProperty.call(config.proxy, "password")
                )
                    warn("HttpClient client configured for basic proxy auth, but no username/password given");
                this.proxyRequest.headers.set(
                    "proxy-authorization",
                    "Basic " + Buffer.from(config.proxy.username + ":" + config.proxy.password).toString("base64")
                );
            } else if (config.proxy.scheme === "bearer") {
                if (!Object.prototype.hasOwnProperty.call(config.proxy, "token"))
                    warn("HttpClient client configured for bearer proxy auth, but no token given");
                this.proxyRequest.headers.set("proxy-authorization", "Bearer " + config.proxy.token);
            }
            // security for hop to proxy
            if (this.proxyRequest.protocol === "https") {
                secure = true;
            }

            debug(
                `HttpClient using ${secure ? "secure " : ""}proxy ${this.proxyRequest.hostname}:${
                    this.proxyRequest.port
                }`
            );
        }

        // config certificate checks
        if (config !== null && config.allowSelfSigned !== undefined) {
            this.allowSelfSigned = config.allowSelfSigned;
            warn(`HttpClient allowing self-signed/untrusted certificates -- USE FOR TESTING ONLY`);
        }

        // using one client impl for both HTTP and HTTPS
        this.agent = secure
            ? new https.Agent({
                  rejectUnauthorized: !this.allowSelfSigned,
              })
            : new http.Agent();

        this.provider = secure ? "https" : "http";
        this.oauth = oauthManager;
    }

    public toString(): string {
        return `[HttpClient]`;
    }

    public async readResource(form: HttpForm): Promise<Content> {
        const request = await this.generateFetchRequest(form, "GET");
        debug(`HttpClient (readResource) sending ${request.method} to ${request.url}`);

        const result = await this.fetch(request);

        this.checkFetchResponse(result);

        debug(`HttpClient received headers: ${JSON.stringify(result.headers.raw())}`);
        debug(`HttpClient received Content-Type: ${result.headers.get("content-type")}`);

        // in browsers node-fetch uses the native fetch, which returns a ReadableStream
        // not complaint with node. Therefore we have to force the conversion here.
        const body = ProtocolHelpers.toNodeStream(result.body as Readable);
        return new Content(result.headers.get("content-type"), body);
    }

    public async writeResource(form: HttpForm, content: Content): Promise<void> {
        const request = await this.generateFetchRequest(form, "PUT", {
            headers: [["content-type", content.type]],
            body: content.body,
        });

        debug(
            `HttpClient (writeResource) sending ${request.method} with '${request.headers.get("Content-Type")}' to ${
                request.url
            }`
        );
        const result = await this.fetch(request);

        debug(`HttpClient received ${result.status} from ${result.url}`);

        this.checkFetchResponse(result);

        debug(`HttpClient received headers: ${JSON.stringify(result.headers.raw())}`);
    }

    public subscribeResource(
        form: HttpForm,
        next: (value: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ): Promise<Subscription> {
        return new Promise<Subscription>((resolve, reject) => {
            let internalSubscription: InternalSubscription;
            if (form.subprotocol === undefined || form.subprotocol === "longpoll") {
                // longpoll or subprotocol is not defined default is longpoll
                internalSubscription = new LongPollingSubscription(form, this);
            } else if (form.subprotocol === "sse") {
                // server sent events
                internalSubscription = new SSESubscription(form);
            }

            internalSubscription
                .open(next, error, complete)
                .then(() => {
                    this.activeSubscriptions.set(form.href, internalSubscription);
                    resolve(
                        new Subscription(() => {
                            internalSubscription.close();
                        })
                    );
                })
                .catch((err) => reject(err));
        });
    }

    public async invokeResource(form: HttpForm, content?: Content): Promise<Content> {
        const headers = content ? [["content-type", content.type]] : [];

        const request = await this.generateFetchRequest(form, "POST", {
            headers: headers,
            body: content?.body,
        });

        debug(
            `HttpClient (invokeResource) sending ${request.method} ${
                content ? "with '" + request.headers.get("Content-Type") + "' " : " "
            }to ${request.url}`
        );

        const result = await this.fetch(request);

        debug(`HttpClient received ${result.status} from ${request.url}`);
        debug(`HttpClient received Content-Type: ${result.headers.get("content-type")}`);

        this.checkFetchResponse(result);

        // in browsers node-fetch uses the native fetch, which returns a ReadableStream
        // not complaint with node. Therefore we have to force the conversion here.
        const body = ProtocolHelpers.toNodeStream(result.body as Readable);
        return new Content(result.headers.get("content-type"), body);
    }

    public async unlinkResource(form: HttpForm): Promise<void> {
        debug(`HttpClient (unlinkResource) ${form.href}`);
        const internalSub = this.activeSubscriptions.get(form.href);

        if (internalSub) {
            this.activeSubscriptions.get(form.href).close();
        } else {
            warn(`HttpClient cannot unlink ${form.href} no subscription found`);
        }
    }

    public async start(): Promise<void> {
        // do nothing
    }

    public async stop(): Promise<void> {
        // When running in browser mode, Agent.destroy() might not exist.
        if (this.agent && this.agent.destroy) this.agent.destroy();
    }

    public setSecurity(metadata: Array<TD.SecurityScheme>, credentials?: unknown): boolean {
        if (metadata === undefined || !Array.isArray(metadata) || metadata.length === 0) {
            warn("HttpClient without security");
            return false;
        }

        // TODO support for multiple security schemes
        const security: TD.SecurityScheme = metadata[0];
        switch (security.scheme) {
            case "basic": {
                const securityBasic: TD.BasicSecurityScheme = <TD.BasicSecurityScheme>security;

                this.credential = new BasicCredential(credentials as BasicCredentialConfiguration, securityBasic);
                break;
            }
            case "bearer": {
                const securityBearer: TD.BearerSecurityScheme = <TD.BearerSecurityScheme>security;

                this.credential = new BearerCredential(credentials as BearerCredentialConfiguration, securityBearer);
                break;
            }
            case "apikey": {
                const securityAPIKey: TD.APIKeySecurityScheme = <TD.APIKeySecurityScheme>security;

                this.credential = new BasicKeyCredential(
                    credentials as BasicKeyCredentialConfiguration,
                    securityAPIKey
                );
                break;
            }
            case "oauth2": {
                const securityOAuth: TD.OAuth2SecurityScheme = <TD.OAuth2SecurityScheme>security;

                if (securityOAuth.flow === "client") {
                    securityOAuth.flow = "client_credentials";
                    this.credential = this.oauth.handleClient(securityOAuth, credentials as OAuthClientConfiguration);
                } else if (securityOAuth.flow === "password") {
                    this.credential = this.oauth.handleResourceOwnerCredential(
                        securityOAuth,
                        credentials as OAuthResourceOwnerConfiguration
                    );
                }

                break;
            }
            case "TuyaCustomBearer": {
                this.credential = new TuyaCustomBearer(
                    credentials as TuyaCustomBearerCredentialConfiguration,
                    security as TuyaCustomBearerSecurityScheme
                );
                break;
            }
            case "nosec":
                break;
            default:
                error(`HttpClient cannot set security scheme '${security.scheme}'. ${metadata}`);
                return false;
        }

        if (security.proxy) {
            if (this.proxyRequest !== null) {
                debug(`HttpClient overriding client-side proxy with security proxy '${security.proxy}`);
            }

            this.proxyRequest = new Request(HttpClient.fixLocalhostName(security.proxy));

            // TODO support for different credentials at proxy and server (e.g., credentials.username vs credentials.proxy.username)
            if (security.scheme === "basic") {
                const basicCredential: BasicCredentialConfiguration = credentials as BasicCredentialConfiguration;
                if (
                    basicCredential === undefined ||
                    basicCredential.username === undefined ||
                    basicCredential.password === undefined
                ) {
                    throw new Error(`No Basic credentials for Thing`);
                }

                this.proxyRequest.headers.set(
                    "proxy-authorization",
                    "Basic " + Buffer.from(basicCredential.username + ":" + basicCredential.password).toString("base64")
                );
            } else if (security.scheme === "bearer") {
                const tokenCredentials: BearerCredentialConfiguration = credentials as BearerCredentialConfiguration;
                if (credentials === undefined || tokenCredentials.token === undefined) {
                    throw new Error(`No Bearer credentials for Thing`);
                }
                this.proxyRequest.headers.set("proxy-authorization", "Bearer " + tokenCredentials.token);
            }
        }

        debug(`HttpClient using security scheme '${security.scheme}'`);
        return true;
    }

    protected async generateFetchRequest(
        form: HttpForm,
        defaultMethod: HTTPMethodName,
        additionalOptions: RequestInit = {}
    ): Promise<Request> {
        const requestInit: RequestInit = additionalOptions;

        const url = HttpClient.fixLocalhostName(form.href);

        requestInit.method = form["htv:methodName"] ? form["htv:methodName"] : defaultMethod;

        requestInit.headers = requestInit.headers ?? [];
        requestInit.headers = requestInit.headers as string[][];

        if (Array.isArray(form["htv:headers"])) {
            debug(`HttpClient got Form 'headers' ${form["htv:headers"]}`);

            const headers = form["htv:headers"] as Array<HttpHeader>;
            for (const option of headers) {
                requestInit.headers.push([option["htv:fieldName"], option["htv:fieldValue"]]);
            }
        } else if (typeof form["htv:headers"] === "object") {
            debug(`HttpClient got Form SINGLE-ENTRY 'headers' ${form["htv:headers"]}`);

            const option = form["htv:headers"] as HttpHeader;
            requestInit.headers.push([option["htv:fieldName"], option["htv:fieldValue"]]);
        }

        requestInit.agent = this.agent;

        let request = this.proxyRequest ? new Request(this.proxyRequest, requestInit) : new Request(url, requestInit);

        // Sign the request using client credentials
        if (this.credential) {
            request = await this.credential.sign(request);
        }

        if (this.proxyRequest) {
            const parsedBaseURL = new URL(url);
            request.url = request.url + parsedBaseURL.pathname;

            debug(`HttpClient proxy request URL: ${request.url}`);

            request.headers.set("host", parsedBaseURL.hostname);
        }

        return request;
    }

    private async fetch(request: Request, content?: Content) {
        const result = await fetch(request, { body: content?.body });

        if (HttpClient.isOAuthTokenExpired(result, this.credential)) {
            this.credential = await (this.credential as OAuthCredential).refreshToken();
            return await fetch(await this.credential.sign(request));
        }

        return result;
    }

    private checkFetchResponse(response: Response) {
        const statusCode = response.status;

        if (statusCode < 200) {
            throw new Error(
                `HttpClient received ${statusCode} and cannot continue (not implemented, open GitHub Issue)`
            );
        } else if (statusCode < 300) {
            // No error
        } else if (statusCode < 400) {
            throw new Error(
                `HttpClient received ${statusCode} and cannot continue (not implemented, open GitHub Issue)`
            );
        } else if (statusCode < 500) {
            throw new Error(`Client error: ${response.statusText}`);
        } else {
            throw new Error(`Server error: ${response.statusText}`);
        }
    }

    private static isOAuthTokenExpired(result: Response, credential: Credential) {
        return result.status === 401 && credential instanceof OAuthCredential;
    }

    private static fixLocalhostName(url: string) {
        const localhostPresent = /^(https?:)?(\/\/)?(?:[^@\n]+@)?(www\.)?(localhost)/gm;

        if (localhostPresent.test(url)) {
            warn("LOCALHOST FIX");
            return url.replace(localhostPresent, "$1$2127.0.0.1");
        }

        return url;
    }
}
