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

import { suite, test } from "@testdeck/mocha";
import { APIKeySecurityScheme, BasicSecurityScheme, BearerSecurityScheme } from "@node-wot/td-tools";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { Request } from "node-fetch";
import {
    BasicCredential,
    BasicCredentialConfiguration,
    BearerCredential,
    BearerCredentialConfiguration,
    BasicKeyCredential,
    BasicKeyCredentialConfiguration,
    TuyaCustomBearer,
    TuyaCustomBearerCredentialConfiguration,
} from "./../src/credential";
import timekeeper from "timekeeper";
import { TuyaCustomBearerSecurityScheme } from "../src/http";

chai.should();
chai.use(chaiAsPromised);

@suite("Credetials auth test suite")
class CredentialTest {
    @test async "should sign in with basic"(): Promise<void> {
        const scheme: BasicSecurityScheme = {
            scheme: "basic",
            in: "header",
            name: "testHeader",
        };

        const config: BasicCredentialConfiguration = {
            username: "admin",
            password: "password",
        };

        const request = new Request("http://test.com/");

        const basic = new BasicCredential(config, scheme);
        const response = await basic.sign(request);

        response.headers
            .get(scheme.name)
            .should.be.equal("Basic " + Buffer.from(config.username + ":" + config.password).toString("base64"));
    }

    @test async "should sign in with bearer"(): Promise<void> {
        const scheme: BearerSecurityScheme = {
            scheme: "bearer",
            in: "header",
            name: "testHeader",
        };

        const config: BearerCredentialConfiguration = {
            token: "token",
        };

        const request = new Request("http://test.com/");

        const bearer = new BearerCredential(config, scheme);
        const response = await bearer.sign(request);

        response.headers.get(scheme.name).should.be.equal("Bearer " + config.token);
    }

    @test async "should sign in with basic key"(): Promise<void> {
        const scheme: APIKeySecurityScheme = {
            scheme: "apikey",
            in: "header",
            name: "testHeader",
        };

        const config: BasicKeyCredentialConfiguration = {
            apiKey: "apiKey",
        };

        const request = new Request("http://test.com/");

        const basic = new BasicKeyCredential(config, scheme);
        const response = await basic.sign(request);

        response.headers.get(scheme.name).should.be.equal(config.apiKey);
    }

    @test async "should sign in with TuyaCustomBearer"(): Promise<void> {
        timekeeper.freeze(new Date("2021-12-15T00:00:00.000Z"));

        class MockTuyaCustomBearer extends TuyaCustomBearer {
            protected async requestAndRefreshToken(refresh: boolean) {
                this.token = "AccessToken";
                this.refreshToken = "RefreshToken";
                this.expireTime = new Date(Date.now() + Date.now() * 1000);
            }
        }

        const sign = "B052CABF5F47E7AD3E1EDFFFD920E27FA7D44969F8082CA9FB94DE2315CC74EA";
        const credentialsConfig: TuyaCustomBearerCredentialConfiguration = {
            key: "key",
            secret: "secret",
        };
        const scheme: TuyaCustomBearerSecurityScheme = {
            scheme: "TuyaCustomBearer",
            baseUri: "base",
        };
        const request = new Request("http://test.com");
        const credentials = new MockTuyaCustomBearer(credentialsConfig, scheme);

        const response = await credentials.sign(request);
        timekeeper.reset();
        response.headers.get("sign").should.be.equal(sign);
    }
}
