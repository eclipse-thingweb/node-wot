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
/**
 * A simple oAuth test server
 */
const OAuthServer = require('express-oauth-server')
const bodyParser = require('body-parser');
const https = require('https');
const fs = require('fs')
const express = require('express')
const Memory = require('./memory-model');

var app = express();

const model = new Memory()

app.oauth = new OAuthServer({
    model: model
});

app.use(bodyParser.json());
app.use("/introspect", bodyParser.urlencoded({ extended: false }));
app.use("/introspect", (req,res,next)=>{
    if (req.method !== "POST" || !req.is("application/x-www-form-urlencoded")) {
        return res.status(400).end()
    }

    // rewrite body authenticate method is not compliant to https://tools.ietf.org/html/rfc7662
    const token = req.body.token
    delete req.body.token
    req.body.access_token = token
    console.log("Body changed,")
    next()
})

app.use("/introspect", async(req, res, next) => { 
    return app.oauth.authenticate()(req,res,next)
    
    
});
app.use("/introspect",(req,res)=>{
    const token = res.locals.oauth.token
    console.log("Token was",token? "Ok": "not Ok")
    res.json({
        active : !!token,
        scope: token.client.grants.join(" "),
        client_id: token.client.clientId
    }).end()
})

app.use("/token", bodyParser.urlencoded({ extended: false }));
app.use("/token", app.oauth.token());

app.use("/resource", (req, res) => {
    console.log("qui?")
    res.send('Ok!')
})

https.createServer({
    key: fs.readFileSync('../privatekey.pem'),
    cert: fs.readFileSync('../certificate.pem')
}, app).listen(3000, "localhost", () => {
    console.log("listening")
})  
