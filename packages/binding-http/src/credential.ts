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

import { Token } from "client-oauth2";
import fetch, { Request } from "node-fetch";
import { BasicSecurityScheme, APIKeySecurityScheme, BearerSecurityScheme } from "@node-wot/core";
import * as crypto from "crypto";
import * as queryString from "query-string";
import { TuyaCustomBearerSecurityScheme } from "./http";

export abstract class Credential {
    abstract sign(request: Request): Promise<Request>;
}

export interface BasicCredentialConfiguration {
    username: string;
    password: string;
}
export class BasicCredential extends Credential {
    private readonly username: string;
    private readonly password: string;
    private readonly options?: BasicSecurityScheme;
    /**
     *
     */
    constructor({ username, password }: BasicCredentialConfiguration, options?: BasicSecurityScheme) {
        super();
        if (username === undefined || password === undefined || username === null || password === null) {
            throw new Error(`No Basic credentials for Thing`);
        }

        this.username = username;
        this.password = password;
        this.options = options;
    }

    async sign(request: Request): Promise<Request> {
        const result = request.clone();
        let headerName = "authorization";
        if (this.options !== undefined && this.options.in === "header" && this.options.name !== undefined) {
            headerName = this.options.name;
        }
        result.headers.set(headerName, "Basic " + Buffer.from(this.username + ":" + this.password).toString("base64"));
        return result;
    }
}
export interface BearerCredentialConfiguration {
    token: string;
}
export class BearerCredential extends Credential {
    private readonly token: string;
    private readonly options: BearerSecurityScheme;
    constructor({ token }: BearerCredentialConfiguration, options: BearerSecurityScheme) {
        super();
        if (token === undefined || token === null) {
            throw new Error(`No Bearer credentials for Thing`);
        }

        this.token = token;
        this.options = options;
    }

    async sign(request: Request): Promise<Request> {
        const result = request.clone();
        let headerName = "authorization";
        if (this.options.in === "header" && this.options.name !== undefined) {
            headerName = this.options.name;
        }
        result.headers.set(headerName, "Bearer " + this.token);
        return result;
    }
}
export interface BasicKeyCredentialConfiguration {
    apiKey: string;
}
export class BasicKeyCredential extends Credential {
    private readonly apiKey: string;
    private readonly options: APIKeySecurityScheme;

    constructor({ apiKey }: BasicKeyCredentialConfiguration, options: APIKeySecurityScheme) {
        super();
        if (apiKey === undefined || apiKey === null) {
            throw new Error(`No API key credentials for Thing`);
        }

        this.apiKey = apiKey;
        this.options = options;
    }

    async sign(request: Request): Promise<Request> {
        const result = request.clone();

        let headerName = "authorization";
        if (this.options.in === "header" && this.options.name !== undefined) {
            headerName = this.options.name;
        }
        result.headers.append(headerName, this.apiKey);

        return result;
    }
}

export class OAuthCredential extends Credential {
    private token: Token | Promise<Token>;
    private readonly refresh?: () => Promise<Token>;

    /**
     *
     * @param tokenRequest oAuth2 token instance
     * @param refresh use a custom refresh function
     */
    constructor(token: Token | Promise<Token>, refresh?: () => Promise<Token>) {
        super();
        this.token = token;
        this.refresh = refresh;
        this.token = token;
    }

    async sign(request: Request): Promise<Request> {
        if (this.token instanceof Promise) {
            const tokenRequest = this.token as Promise<Token>;
            this.token = await tokenRequest;
        }

        let tempRequest = { url: request.url, headers: {} };

        tempRequest = this.token.sign(tempRequest);

        const mergeHeaders = new Request(request, tempRequest);

        return mergeHeaders;
    }

    async refreshToken(): Promise<OAuthCredential> {
        if (this.token instanceof Promise) {
            throw new Error("Uninitialized token. You have to call sing before refresh");
        }

        let newToken;
        if (this.refresh) {
            newToken = await this.refresh();
        } else {
            newToken = await this.token.refresh();
        }
        return new OAuthCredential(newToken, this.refresh);
    }
}

export interface TuyaCustomBearerCredentialConfiguration {
    key: string;
    secret: string;
}

interface TokenResponse {
    success?: boolean;
    result?: {
        access_token?: string;
        refresh_token?: string;
        expire_time?: number;
    };
}

export class TuyaCustomBearer extends Credential {
    protected key: string;
    protected secret: string;
    protected baseUri: string;
    protected token?: string;
    protected refreshToken?: string;
    protected expireTime?: Date;

    constructor(credentials: TuyaCustomBearerCredentialConfiguration, scheme: TuyaCustomBearerSecurityScheme) {
        super();
        this.key = credentials.key;
        this.secret = credentials.secret;
        this.baseUri = scheme.baseUri;
    }

    async sign(request: Request): Promise<Request> {
        const isTokenExpired: boolean = this.isTokenExpired();
        if (this.token === undefined || this.token === "" || isTokenExpired)
            await this.requestAndRefreshToken(isTokenExpired);

        const url: string = request.url;
        const body = request.body?.read().toString();
        const method = request.method;
        const headers = this.getHeaders(true, request.headers.raw(), body, url, method);
        Object.assign(headers, request.headers.raw());
        return new Request(url, { method, body: body !== "" ? body : undefined, headers });
    }

    protected async requestAndRefreshToken(refresh: boolean): Promise<void> {
        const headers = this.getHeaders(false, {});
        const request = {
            headers,
            method: "GET",
        };
        let url = `${this.baseUri}/token?grant_type=1`;
        if (refresh) {
            url = `${this.baseUri}/token/${this.refreshToken}`;
        }
        const data: TokenResponse = await (await fetch(url, request)).json();
        const success = data.success ?? false;

        if (success) {
            this.token = data.result?.access_token;
            this.refreshToken = data.result?.refresh_token;

            const expireTime = data.result?.expire_time;
            if (expireTime != null) {
                this.expireTime = new Date(Date.now() + expireTime * 1000);
            }
        } else {
            throw new Error("token fetch failed");
        }
    }

    private getHeaders(NormalRequest: boolean, headers: unknown, body?: string, url?: string, method?: string) {
        const requestTime = Date.now().toString();
        const replaceUri = this.baseUri.replace("/v1.0", "");
        const _url = url?.replace(replaceUri, "");
        const sign = this.requestSign(NormalRequest, requestTime, body, _url, method);
        return {
            t: requestTime,
            client_id: this.key,
            sign_method: "HMAC-SHA256",
            sign,
            access_token: this.token ?? "",
        };
    }

    private requestSign(
        NormalRequest: boolean,
        requestTime: string,
        body?: string,
        path = "",
        method?: string
    ): string {
        const bodyHash = crypto
            .createHash("sha256")
            .update(body ?? "")
            .digest("hex");
        let signUrl = "/v1.0/token?grant_type=1";
        const headerString = "";
        let useToken = "";
        const _method = method ?? "GET";
        if (NormalRequest) {
            useToken = this.token ?? "";
            const pathQuery = queryString.parse(path.split("?")[1]);
            let query: Record<string, string> = {};
            query = Object.assign(query, pathQuery);
            const sortedQuery: { [k: string]: string } = {};
            Object.keys(query)
                .sort()
                .forEach((i) => {
                    sortedQuery[i] = query[i];
                });
            const qs = queryString.stringify(sortedQuery);
            signUrl = decodeURIComponent(qs ? `${path.split("?")[0]}?${qs}` : path);
        }
        const endStr = [this.key, useToken, requestTime, [_method, bodyHash, headerString, signUrl].join("\n")].join(
            ""
        );
        const sign = crypto.createHmac("sha256", this.secret).update(endStr).digest("hex").toUpperCase();
        return sign;
    }

    private isTokenExpired(): boolean {
        return this.expireTime ? Date.now() > this.expireTime.getTime() : false;
    }
}
