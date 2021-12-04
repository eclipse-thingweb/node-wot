/********************************************************************************
 * Copyright (c) 2018 - 2020 Contributors to the Eclipse Foundation
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

interface Client {
    clientId: string;
    clientSecret: string;
    redirectUris: string[];
    grants: string[];
}

interface User {
    id: string;
    username: string;
    password: string;
}

interface Token {
    accessToken: string;
    accessTokenExpiresAt?: number;
    client?: Client;
    refreshToken: string;
    refreshTokenExpiresAt?: number;
    user?: User;
}

/**
 * oAuth server logic. See https://oauth2-server.readthedocs.io/en/latest/model/overview.html
 */
export default class InMemoryModel {
    clients: Client[];
    tokens: Token[];
    users: User[];
    /**
     *
     */
    constructor() {
        this.clients = [
            {
                clientId: "thom",
                clientSecret: "nightworld",
                redirectUris: [""],
                grants: ["client_credentials", "password", "refresh_token"],
            },
        ];
        this.tokens = [];
        this.users = [{ id: "123", username: "thomseddon", password: "nightworld" }];
    }

    dump(): void {
        console.log("clients", this.clients);
        console.log("tokens", this.tokens);
        console.log("users", this.users);
    }

    /*
     * Get access token.
     */

    getAccessToken(bearerToken: string): Token | false {
        const tokens = this.tokens.filter(function (token) {
            return token.accessToken === bearerToken;
        });

        return tokens.length ? tokens[0] : false;
    }

    /**
     * Get refresh token.
     */

    getRefreshToken(bearerToken: string): Token | false {
        const tokens = this.tokens.filter(function (token) {
            return token.refreshToken === bearerToken;
        });

        return tokens.length ? tokens[0] : false;
    }

    /**
     * Get client.
     */

    getClient(clientId: string, clientSecret: string): Client | false {
        const clients = this.clients.filter(function (client) {
            return client.clientId === clientId && (!clientSecret || client.clientSecret === clientSecret);
        });

        return clients.length ? clients[0] : false;
    }

    /**
     * Save token.
     */

    saveToken(token: Token, client: Client, user: User): Token {
        const { accessToken, accessTokenExpiresAt, refreshTokenExpiresAt, refreshToken } = token;
        this.tokens.push({
            accessToken: accessToken,
            accessTokenExpiresAt: accessTokenExpiresAt,
            client: client,
            refreshToken: refreshToken,
            refreshTokenExpiresAt: refreshTokenExpiresAt,
            user: user,
        });
        return this.tokens[this.tokens.length - 1];
    }

    /*
     * Get user.
     */

    getUser(username: string, password: string): User | false {
        const users = this.users.filter(function (user) {
            return user.username === username && user.password === password;
        });

        return users.length ? users[0] : false;
    }

    getUserFromClient(client: string): User {
        return this.users[0];
    }

    saveAuthorizationCode(): void {
        return undefined;
    }

    revokeToken(token: Token): boolean {
        return true;
    }

    expireAllTokens(): void {
        for (const token of this.tokens) {
            token.accessTokenExpiresAt = Date.now();
        }
    }
}
