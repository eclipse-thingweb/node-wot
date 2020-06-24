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
    model: model,
    accessTokenLifetime: 1
});

app.use(bodyParser.json());
app.use("/resource", app.oauth.authenticate());
app.use("/token", bodyParser.urlencoded({ extended: false }));
app.use("/token", app.oauth.token());

app.use("/resource", (req, res) => {
    res.send('Ok!')
})

https.createServer({
    key: fs.readFileSync('../privatekey.pem'),
    cert: fs.readFileSync('../certificate.pem')
}, app).listen(3000, "localhost", () => {
    console.log("listening")
})
