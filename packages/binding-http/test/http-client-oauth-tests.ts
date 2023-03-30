/********************************************************************************
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
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

import * as https from "https";
import { suite, test } from "@testdeck/mocha";
import express from "express";
import { HttpClient } from "../src/http";
import { OAuth2SecurityScheme } from "@node-wot/td-tools";

import InMemoryModel from "./memory-model";
import { promisify } from "util";
import { readFileSync } from "fs";

import OAuthServer from "express-oauth-server";
import bodyParser from "body-parser";

@suite("HTTP oauth client implementation")
class HttpClientOAuthTest {
    private client: HttpClient;
    static model: InMemoryModel;
    static server: https.Server;

    static before(): Promise<void> {
        const app: express.Express = express();
        HttpClientOAuthTest.model = new InMemoryModel();

        const oauth = new OAuthServer({
            model: HttpClientOAuthTest.model,
            accessTokenLifetime: 1, // One minute; less is not possible
        });

        app.use(bodyParser.json());
        app.use("/resource", oauth.authenticate());
        app.use("/token", bodyParser.urlencoded({ extended: false }));
        app.use("/token", oauth.token());

        app.use("/resource", (req: express.Request, res: express.Response) => {
            res.send("Ok!");
        });

        return new Promise<void>((resolve) => {
            HttpClientOAuthTest.server = https
                .createServer(
                    {
                        key: readFileSync("./test/server.key"),
                        cert: readFileSync("./test/server.cert"),
                    },
                    app
                )
                .listen(3000, "127.0.0.1", resolve);
        });
    }

    static async after() {
        return await promisify(this.server.close.bind(this.server))();
    }

    before() {
        this.client = new HttpClient({ allowSelfSigned: true }, true);
    }

    async after() {
        await this.client.stop();
    }

    @test async "should authorize client with client flow"() {
        const scheme: OAuth2SecurityScheme = {
            scheme: "oauth2",
            flow: "client",
            token: "https://127.0.0.1:3000/token",
            scopes: ["test"],
        };
        this.client.setSecurity([scheme], { clientId: "thom", clientSecret: "nightworld" });
        const resource = await this.client.readResource({
            href: "https://127.0.0.1:3000/resource",
        });
        const body = await resource.toBuffer();
        body.toString("ascii").should.eql("Ok!");
    }

    @test async "should authorize client with resource owener flow"() {
        const scheme: OAuth2SecurityScheme = {
            scheme: "oauth2",
            flow: "password",
            token: "https://127.0.0.1:3000/token",
            scopes: ["test"],
        };
        this.client.setSecurity([scheme], {
            clientId: "thom",
            clientSecret: "nightworld",
            username: "thomseddon",
            password: "nightworld",
        });
        const resource = await this.client.readResource({
            href: "https://127.0.0.1:3000/resource",
        });
        const body = await resource.toBuffer();
        body.toString("ascii").should.eql("Ok!");
    }

    @test async "should refresh token"() {
        const scheme: OAuth2SecurityScheme = {
            scheme: "oauth2",
            flow: "client",
            token: "https://127.0.0.1:3000/token",
            scopes: ["test"],
        };
        const model = HttpClientOAuthTest.model;
        await model.expireAllTokens();
        this.client.setSecurity([scheme], { clientId: "thom", clientSecret: "nightworld" });
        const resource = await this.client.readResource({
            href: "https://127.0.0.1:3000/resource",
        });
        const body = await resource.toBuffer();
        body.toString("ascii").should.eql("Ok!");
    }

    @test async "should refresh token with resource owener flow"() {
        const scheme: OAuth2SecurityScheme = {
            scheme: "oauth2",
            flow: "password",
            token: "https://127.0.0.1:3000/token",
            scopes: ["test"],
        };
        const model = HttpClientOAuthTest.model;

        model.expireAllTokens();
        this.client.setSecurity([scheme], {
            clientId: "thom",
            clientSecret: "nightworld",
            username: "thomseddon",
            password: "nightworld",
        });
        const resource = await this.client.readResource({
            href: "https://127.0.0.1:3000/resource",
        });
        const body = await resource.toBuffer();
        body.toString("ascii").should.eql("Ok!");
    }
}
