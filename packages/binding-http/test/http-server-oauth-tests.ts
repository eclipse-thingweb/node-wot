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
import { suite, test, slow, timeout, skip, only, describe } from "mocha-typescript";
import { expect, should, assert } from "chai";
import * as express from 'express';
import { HttpServer, OAuth2ServerConfig } from "../src/http";
import { IntrospectionEndpoint, EndpointValidator } from "../src/oauth-token-validation";


should()
@suite("OAuth server token validation tests")
class OAuthServerTests{

    static before(){
        var app: express.Express = express();
        app.use((req)=>{

            return 
        })
    }

    @test async "should configure oauth"(){
        const method: IntrospectionEndpoint = {
            name: "introspection_endpoint",
            endpoint: "http://localhost:4242"
        }
        const authConfig: OAuth2ServerConfig = {
            scheme:"oauth",
            method: method,
        }
        const server = new HttpServer({
            security : authConfig
        })

        server["httpSecurityScheme"].should.be.equal("OAuth")
        server["oAuthValidator"].should.be.instanceOf(EndpointValidator)
    }
}