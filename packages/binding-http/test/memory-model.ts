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

import { createDebugLogger } from "@node-wot/core";

import { Client, Token, User, Falsey, ClientCredentialsModel, PasswordModel } from "@node-oauth/oauth2-server";
const debug = createDebugLogger("binding-http", "memory-model");

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

    async validateScope?(user: User, client: Client, scope: string[]): Promise<string[] | Falsey> {
        return scope;
    }

    async generateAccessToken?(client: Client, user: User, scope: string[]): Promise<string> {
        return Buffer.from(Math.random().toString()).toString("base64").substr(10, 5);
    }

    async verifyScope(token: Token, scope: string | string[]): Promise<boolean> {
        return true;
    }

    dump(): void {
        debug(`Clients: ${this.clients}`);
        debug(`Tokens: ${this.tokens}`);
        debug(`Users: ${this.users}`);
    }

    /*
     * Get access token.
     */

    async getAccessToken(bearerToken: string): Promise<Token | Falsey> {
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

    async getClient(clientId: string, clientSecret: string): Promise<Client | Falsey> {
        const clients = this.clients.filter(function (client) {
            return client.id === clientId && (!clientSecret || client.clientSecret === clientSecret);
        });
        return clients.length ? clients[0] : false;
    }

    /**
     * Save token.
     */

    async saveToken(token: Token, client: Client, user: User): Promise<Token> {
        const { accessToken, accessTokenExpiresAt, refreshTokenExpiresAt, refreshToken } = token;
        this.tokens.push({
            accessToken,
            accessTokenExpiresAt,
            client,
            refreshToken,
            refreshTokenExpiresAt,
            user,
        });
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

    async getUserFromClient(client: Client): Promise<Falsey | User> {
        return this.users[0];
    }

    revokeToken(token: Token): boolean {
        return true;
    }

    expireAllTokens(): void {
        for (const token of this.tokens) {
            token.accessTokenExpiresAt = new Date(new Date().setHours(-1));
        }
    }
}
