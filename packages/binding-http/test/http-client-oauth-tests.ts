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

const OAuthServer = require("express-oauth-server")
var bodyParser = require('body-parser');
import * as https from 'https'

var fs = require('fs')
import { suite, test } from "mocha-typescript";
import * as express from 'express';
import { HttpClient, HttpsClientFactory, HttpServer } from "../src/http";
import { OAuth2SecurityScheme } from "@node-wot/td-tools";

import Memory from "./memory-model";
import { promisify } from 'util';

@suite("HTTP oauth client implementation")
class HttpClientOAuthTest {
    
    private client:HttpClient;
    static model:any;
    static server:https.Server
    static before(){
        var app:any = express();
        HttpClientOAuthTest.model = new Memory()
        
        app.oauth = new OAuthServer({
            model: HttpClientOAuthTest.model,
            accessTokenLifetime: 1 // One minute; less is not possible
        });
        
        app.use(bodyParser.json());
        app.use("/resource", app.oauth.authenticate());
        app.use("/token",bodyParser.urlencoded({ extended: false }));
        app.use("/token",app.oauth.token());
        
        app.use("/resource",(req:any, res:any) => {
            res.send('Ok!')
        })

        return new Promise((resolve)=>{
            HttpClientOAuthTest.server = https.createServer({
                key: fs.readFileSync('./test/server.key'),
                cert: fs.readFileSync('./test/server.cert')
            }, app).listen(3000, "localhost", resolve)
        })
    }   

    static after(){
        return promisify(HttpClientOAuthTest.server.close)
    }

    before(){
        this.client = new HttpClient({ allowSelfSigned: true},true)
    }

    after(){
        this.client.stop()
    }

    @test async "should authorize client with client_credentials flow"(){
        const scheme:OAuth2SecurityScheme = {
            scheme: "oauth2",
            flow:"client_credentials",
            token: "https://localhost:3000/token",
            scopes: ["test"]
        }
        this.client.setSecurity([scheme], { clientId: "thom", clientSecret:"nightworld"})
        return this.client.readResource({
            href: "https://localhost:3000/resource"
        })

    }
    @test async "should authorize client with resource owener flow"(){
        const scheme:OAuth2SecurityScheme = {
            scheme: "oauth2",
            flow:"password",
            token: "https://localhost:3000/token",
            scopes: ["test"]
        }
        this.client.setSecurity([scheme], { clientId: "thom", clientSecret: "nightworld", username: 'thomseddon', password: 'nightworld'})
        return this.client.readResource({
            href: "https://localhost:3000/resource"
        })

    }
   @test async "should refresh token"(){
        const scheme:OAuth2SecurityScheme = {
            scheme: "oauth2",
            flow:"client_credentials",
            token: "https://localhost:3000/token",
            scopes: ["test"]
        }
        HttpClientOAuthTest.model.expireAllTokens()
        await this.client.setSecurity([scheme], { clientId: "thom", clientSecret:"nightworld"})
        await sleep(1000)
        return this.client.readResource({
            href: "https://localhost:3000/resource"
        })

    }
    @test async "should refresh token with resource owener flow"() {
        const scheme: OAuth2SecurityScheme = {
            scheme: "oauth2",
            flow: "password",
            token: "https://localhost:3000/token",
            scopes: ["test"]
        }

        HttpClientOAuthTest.model.expireAllTokens()
        this.client.setSecurity([scheme], { clientId: "thom", clientSecret: "nightworld", username: 'thomseddon', password: 'nightworld' })
        await sleep(1000)
        return this.client.readResource({
            href: "https://localhost:3000/resource"
        })

    }
}



function sleep(ms:number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}