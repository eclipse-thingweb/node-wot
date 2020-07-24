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

var fs = require('fs')
import { suite, test } from "mocha-typescript";
import * as express from 'express';
import { HttpClient } from "../src/http";
import * as https from 'https'
import { BasicSecurityScheme } from "@node-wot/td-tools";
import * as chai from 'chai';
import * as chaiAsPromised from "chai-as-promised";
import { promisify } from "util";

chai.should();
chai.use(chaiAsPromised)

@suite("HTTP auth basic client implementation")
class HttpClientBasicTest {

    private client: HttpClient;
    
    private static server: https.Server;
    static before() {
        const app = express();
        app.use((req:any, res:any, next:any) => {

            // -----------------------------------------------------------------------
            // authentication middleware

            const auth = { login: "admin", password: "password" } // change this

            // parse login and password from headers
            const b64auth = (req.headers.authorization || '').split(' ')[1] || ''
            const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':')

            // Verify login and password are set and correct
            if (login && password && login === auth.login && password === auth.password) {
                // Access granted...
                res.end()
                return
            }

            // Access denied...
            res.set('WWW-Authenticate', 'Basic realm="401"') // change this
            res.status(401).send('Authentication required.') // custom message

            // -----------------------------------------------------------------------

        })
        
        return new Promise((resolve)=>{
            HttpClientBasicTest.server = https.createServer({
                key: fs.readFileSync('./test/server.key'),
                cert: fs.readFileSync('./test/server.cert')
            }, app).listen(3001, "localhost", resolve)
        })
       

    }

    before() {
        this.client = new HttpClient({ allowSelfSigned: true }, true)
    }

    static after() {
        return promisify(HttpClientBasicTest.server.close)
    }

    @test async "should authorize client with basic"() {
        const scheme: BasicSecurityScheme = {
            scheme : "basic",
            in: "header"
        }

        this.client.setSecurity([scheme], {"username": "admin","password": "password" })
        return this.client.readResource({
            href: "https://localhost:3001"
        })

    }
    @test async "should fail to authorize client with basic"() {
        const scheme: BasicSecurityScheme = {
            scheme : "basic",
            in: "header"
        }

        this.client.setSecurity([scheme], {"username": "other","password": "other" })
        return this.client.readResource({href: "https://localhost:3001"}).should.be.rejected

    }

}