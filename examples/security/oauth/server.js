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
