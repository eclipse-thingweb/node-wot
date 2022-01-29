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

import { suite, test } from "@testdeck/mocha";
import express from "express";
import { HttpClient } from "../src/http";
import * as https from "https";
import { BasicSecurityScheme } from "@node-wot/td-tools";
import { ProtocolHelpers } from "@node-wot/core";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { fail } from "assert";
import { readFileSync } from "fs";

chai.should();
chai.use(chaiAsPromised);

function mockService(req: express.Request, res: express.Response) {
    // -----------------------------------------------------------------------
    // authentication middleware

    const auth = { login: "admin", password: "password" }; // change this

    // parse login and password from headers
    const b64auth = (req.headers.authorization || "").split(" ")[1] || "";
    const [login, password] = Buffer.from(b64auth, "base64").toString().split(":");

    // Verify login and password are set and correct
    if (login && password && login === auth.login && password === auth.password) {
        // Access granted...
        res.write("Access granted");
        res.end();
        return;
    }

    // Access denied...
    res.set("WWW-Authenticate", 'Basic realm="401"'); // change this
    res.status(401).send("Authentication required."); // custom message

    // -----------------------------------------------------------------------
}
@suite("HTTP auth basic client implementation")
class HttpClientBasicTest {
    private client: HttpClient;

    private static server: https.Server;

    static async before(): Promise<void> {
        const app = express();
        app.use(mockService);

        return new Promise<void>((resolve) => {
            HttpClientBasicTest.server = https
                .createServer(
                    {
                        key: readFileSync("./test/server.key"),
                        cert: readFileSync("./test/server.cert"),
                    },
                    app
                )
                .listen(3001, "localhost", resolve);
        });
    }

    static async after(): Promise<void> {
        return new Promise<void>((resolve) => {
            HttpClientBasicTest.server.close(() => resolve());
        });
    }

    before() {
        this.client = new HttpClient({ allowSelfSigned: true }, true);
    }

    async after() {
        await this.client.stop();
    }

    @test async "should authorize client with basic"(): Promise<void> {
        const scheme: BasicSecurityScheme = {
            scheme: "basic",
            in: "header",
        };

        this.client.setSecurity([scheme], { username: "admin", password: "password" });
        const resource = await this.client.readResource({
            href: "https://localhost:3001",
        });
        const body = await ProtocolHelpers.readStreamFully(resource.body);
        body.toString("ascii").should.eql("Access granted");
    }

    @test async "should fail to authorize client with basic"(): Promise<void> {
        const scheme: BasicSecurityScheme = {
            scheme: "basic",
            in: "header",
        };

        this.client.setSecurity([scheme], { username: "other", password: "other" });
        try {
            await this.client.readResource({ href: "https://localhost:3001" });
        } catch (error) {
            error.message.should.eql("Client error: Unauthorized");
            return;
        }
        fail("should fail to authorize client with basic");
    }
}
