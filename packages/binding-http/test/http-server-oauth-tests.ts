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
import { suite, test } from "@testdeck/mocha";
import { should, expect } from "chai";
import { HttpServer, OAuth2ServerConfig } from "../src/http";
import { IntrospectionEndpoint, EndpointValidator } from "../src/oauth-token-validation";
import Servient, { ExposedThing } from "@node-wot/core";
import fetch from "node-fetch";

class MockServient extends Servient {}

should();
@suite("OAuth server token validation tests")
class OAuthServerTests {
    private server!: HttpServer;
    async before() {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        console.debug = () => {};
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        console.warn = () => {};
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        console.info = () => {};

        const method: IntrospectionEndpoint = {
            name: "introspection_endpoint",
            endpoint: "http://localhost:4242",
        };
        const authConfig: OAuth2ServerConfig = {
            scheme: "oauth2",
            method,
        };
        this.server = new HttpServer({
            security: [authConfig],
        });

        await this.server.start(new MockServient());

        const testThing = new ExposedThing(new Servient(), {
            title: "TestOAuth",
            id: "test",
            securityDefinitions: {
                oauth2_sc: {
                    scheme: "oauth2",
                    flow: "code",
                    authorization: "https://example.com/authorization",
                    token: "https://example.com/token",
                    scopes: ["limited", "special"],
                },
            },
            security: ["oauth2_sc"],
            properties: {
                test: {
                    type: "string",
                },
            },
        });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        testThing.properties.test.forms = [];

        await this.server.expose(testThing);
    }

    async after() {
        await this.server.stop();
    }

    @test async "should configure oauth"() {
        /* eslint-disable dot-notation */
        this.server["supportedSecuritySchemes"].should.contain("oauth2");
        expect(this.server["oAuthValidator"]).to.be.instanceOf(EndpointValidator);
        /* eslint-enable dot-notation */
    }

    @test async "should call oauth validation"() {
        let called = false;

        /* eslint-disable dot-notation */
        expect(this.server["oAuthValidator"]).to.not.be.equal(undefined, "OAuth validator not set");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.server["oAuthValidator"]!.validate = async (token, scopes, clients) => {
            called = true;
            return true;
        };
        /* eslint-enable dot-notation */
        await fetch("http://localhost:8080/testoauth/properties/test");

        called.should.eql(true);
    }

    @test async "should send unauthorized if oauth validation fails"() {
        let called = false;

        /* eslint-disable dot-notation */
        expect(this.server["oAuthValidator"]).to.not.be.equal(undefined, "OAuth validator not set");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.server["oAuthValidator"]!.validate = async (token, scopes, clients) => {
            called = true;
            return false;
        };
        /* eslint-enable dot-notation */
        const response = await fetch("http://localhost:8080/testoauth/properties/test");

        called.should.eql(true);

        response.status.should.be.equal(401);
    }

    @test async "should send error if oauth validation throws"() {
        let called = false;

        /* eslint-disable dot-notation */
        expect(this.server["oAuthValidator"]).to.not.be.equal(undefined, "OAuth validator not set");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.server["oAuthValidator"]!.validate = async (token, scopes, clients) => {
            called = true;
            return false;
        };
        /* eslint-enable dot-notation */
        const response = await fetch("http://localhost:8080/testoauth/properties/test");

        called.should.eql(true);

        response.status.should.be.equal(401);
    }
}
