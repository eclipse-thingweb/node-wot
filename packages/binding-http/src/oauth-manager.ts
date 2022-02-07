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

import { OAuth2SecurityScheme } from "@node-wot/td-tools";
import ClientOAuth2 from "client-oauth2";
import { request, RequestOptions } from "https";
import { URL } from "url";
import { OAuthCredential } from "./credential";

function createRequestFunction(rejectUnauthorized: boolean) {
    // TODO: Does not work inside a browser
    return (
        method: string,
        url: string,
        body: string,
        headers: { [key: string]: string | string[] }
    ): Promise<{ status: number; body: string }> => {
        return new Promise((resolve, reject) => {
            const parsedURL = new URL(url);

            const options: RequestOptions = {
                method: method,
                host: parsedURL.hostname,
                port: parseInt(parsedURL.port),
                path: parsedURL.pathname + parsedURL.search,
                headers: headers,
            };

            options.rejectUnauthorized = rejectUnauthorized;
            const req = request(options);

            req.on("response", (response) => {
                response.setEncoding("utf8");
                const body: Array<unknown> = [];
                response.on("data", (data) => {
                    body.push(data);
                });
                response.on("end", () => {
                    resolve({
                        status: response.statusCode,
                        body: body.toString(),
                    });
                });
            });
            req.on("error", (er) => {
                reject(er);
            });

            req.write(body);

            req.end();
        });
    };
}
export interface OAuthClientConfiguration {
    clientId: string;
    clientSecret: string;
}
export interface OAuthResourceOwnerConfiguration extends OAuthClientConfiguration {
    username: string;
    password: string;
}

export default class OAuthManager {
    private tokenStore: Map<string, ClientOAuth2.Token> = new Map();
    handleClient(securityScheme: OAuth2SecurityScheme, credentials: OAuthClientConfiguration): OAuthCredential {
        const clientFlow: ClientOAuth2 = new ClientOAuth2(
            {
                clientId: credentials.clientId,
                clientSecret: credentials.clientSecret,
                accessTokenUri: securityScheme.token,
                scopes: securityScheme.scopes,
                body: {
                    // TODO: some server implementation may require client_id and secret inside
                    // the request body
                    // client_id: credentials.clientId,
                    //  client_secret: credentials.clientSecret
                },
            },
            createRequestFunction(false)
        );
        const token = clientFlow.credentials.getToken();
        return new OAuthCredential(token, clientFlow.credentials.getToken.bind(clientFlow.credentials));
    }

    handleResourceOwnerCredential(
        securityScheme: OAuth2SecurityScheme,
        credentials: OAuthResourceOwnerConfiguration
    ): OAuthCredential {
        const clientFlow: ClientOAuth2 = new ClientOAuth2(
            {
                clientId: credentials.clientId,
                clientSecret: credentials.clientSecret,
                accessTokenUri: securityScheme.token,
                scopes: securityScheme.scopes,
            },
            createRequestFunction(false)
        );
        const token = clientFlow.owner.getToken(credentials.username, credentials.password);

        return new OAuthCredential(token);
    }
}
