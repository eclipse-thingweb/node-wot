/********************************************************************************
 * Copyright (c) 2018 Contributors to the Eclipse Foundation
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

import { PasswordModel, ClientCredentialsModel, Callback, Token, Falsey, Client, User } from "oauth2-server";

/**
 * oAuth server logic. See https://oauth2-server.readthedocs.io/en/latest/model/overview.html
 */
export default class InMemoryModel implements ClientCredentialsModel, PasswordModel {
    clients: Client[];
    tokens: Token[];
    users: User[];
    tokenGen = 0;
    /**
     *
     */
    constructor() {
        this.clients = [
            {
                id: "thom",
                clientSecret: "nightworld",
                redirectUris: [""],
                grants: ["client_credentials", "password", "refresh_token"],
            },
        ];
        this.tokens = [];
        this.users = [{ id: "123", username: "thomseddon", password: "nightworld" }];
    }

    async validateScope?(
        user: User,
        client: Client,
        scope: string | string[],
        callback?: Callback<string | false | 0>
    ): Promise<string | false | 0 | string[]> {
        if (callback) {
            callback(null, scope.toString());
        }

        return scope;
    }

    async generateAccessToken?(
        client: Client,
        user: User,
        scope: string | string[],
        callback?: Callback<string>
    ): Promise<string> {
        if (callback) {
            callback(null, Buffer.from(Math.random().toString()).toString("base64").substr(10, 5));
        }
        return Buffer.from(Math.random().toString()).toString("base64").substr(10, 5);
    }

    async verifyScope(token: Token, scope: string | string[], callback?: Callback<boolean>): Promise<boolean> {
        if (callback) {
            callback(null, true);
        }
        return true;
    }

    dump(): void {
        console.log("clients", this.clients);
        console.log("tokens", this.tokens);
        console.log("users", this.users);
    }

    /*
     * Get access token.
     */

    async getAccessToken(bearerToken: string, callback: Callback<Token>): Promise<Token | Falsey> {
        const tokens = this.tokens.filter(function (token) {
            return token.accessToken === bearerToken;
        });
        if (callback) {
            callback(null, tokens[0]);
        }

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

    async getClient(
        clientId: string,
        clientSecret: string,
        callback?: Callback<Falsey | Client>
    ): Promise<Client | Falsey> {
        const clients = this.clients.filter(function (client) {
            return client.id === clientId && (!clientSecret || client.clientSecret === clientSecret);
        });
        if (callback) {
            callback(null, clients.length ? clients[0] : false);
        }
        return clients.length ? clients[0] : false;
    }

    /**
     * Save token.
     */

    async saveToken(token: Token, client: Client, user: User, callback?: Callback<Token>): Promise<Token> {
        const { accessToken, accessTokenExpiresAt, refreshTokenExpiresAt, refreshToken } = token;
        this.tokens.push({
            accessToken: accessToken,
            accessTokenExpiresAt: accessTokenExpiresAt,
            client: client,
            refreshToken: refreshToken,
            refreshTokenExpiresAt: refreshTokenExpiresAt,
            user: user,
        });
        if (callback) {
            callback(null, this.tokens[this.tokens.length - 1]);
        }
        return this.tokens[this.tokens.length - 1];
    }

    /*
     * Get user.
     */

    async getUser(username: string, password: string): Promise<User | Falsey> {
        const users = this.users.filter(function (user) {
            return user.username === username && user.password === password;
        });

        return users.length ? users[0] : false;
    }

    async getUserFromClient(client: Client, callback?: Callback<Falsey | User>): Promise<Falsey | User> {
        if (callback) {
            callback(null, this.users[0]);
        }
        return this.users[0];
    }

    revokeToken(token: Token): boolean {
        return true;
    }

    expireAllTokens(): void {
        for (const token of this.tokens) {
            token.accessTokenExpiresAt = new Date();
        }
    }
}
