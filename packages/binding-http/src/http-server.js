"use strict";
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
exports.__esModule = true;
/**
 * HTTP Server based on http
 */
var http = require("http");
var url = require("url");
var core_1 = require("@node-wot/core");
var core_2 = require("@node-wot/core");
var HttpServer = /** @class */ (function () {
    function HttpServer(port, address) {
        var _this = this;
        this.scheme = "http";
        this.port = 8080;
        this.address = undefined;
        this.server = http.createServer(function (req, res) { _this.handleRequest(req, res); });
        this.running = false;
        this.failed = false;
        this.resources = {};
        if (port !== undefined) {
            this.port = port;
        }
        if (address !== undefined) {
            this.address = address;
        }
    }
    HttpServer.prototype.addResource = function (path, res) {
        if (this.resources[path] !== undefined) {
            console.warn("HttpServer on port " + this.getPort() + " already has ResourceListener '" + path + "' - skipping");
            return false;
        }
        else {
            // TODO debug-level
            console.log("HttpServer on port " + this.getPort() + " adding resource '" + path + "'");
            this.resources[path] = res;
            return true;
        }
    };
    HttpServer.prototype.removeResource = function (path) {
        // TODO debug-level
        console.log("HttpServer on port " + this.getPort() + " removing resource '" + path + "'");
        return delete this.resources[path];
    };
    HttpServer.prototype.start = function () {
        var _this = this;
        console.info("HttpServer starting on " + (this.address !== undefined ? this.address + ' ' : '') + "port " + this.port);
        return new Promise(function (resolve, reject) {
            // long timeout for long polling
            _this.server.setTimeout(60 * 60 * 1000, function () { console.info("HttpServer on port ${this.getPort()} timed out connection"); });
            // no keep-alive because NodeJS HTTP clients do not properly use same socket due to pooling
            _this.server.keepAliveTimeout = 0;
            // start promise handles all errors until successful start
            _this.server.once('error', function (err) { reject(err); });
            _this.server.once('listening', function () {
                // once started, console "handles" errors
                _this.server.on('error', function (err) {
                    console.error("HttpServer on port " + _this.port + " failed: " + err.message);
                });
                resolve();
            });
            _this.server.listen(_this.port, _this.address);
        });
    };
    HttpServer.prototype.stop = function () {
        var _this = this;
        console.info("HttpServer stopping on port " + this.getPort());
        return new Promise(function (resolve, reject) {
            // stop promise handles all errors from now on
            _this.server.once('error', function (err) { reject(err); });
            _this.server.once('close', function () { resolve(); });
            _this.server.close();
        });
    };
    HttpServer.prototype.getPort = function () {
        if (this.server.address()) {
            return this.server.address().port;
        }
        else {
            return -1;
        }
    };
    HttpServer.prototype.handleRequest = function (req, res) {
        var _this = this;
        res.on('finish', function () {
            console.log("HttpServer on port " + _this.getPort() + " replied with " + res.statusCode + " to " + req.socket.remoteAddress + " port " + req.socket.remotePort);
        });
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Request-Method', '*');
        res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, HEAD, GET, POST, PUT, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, *');
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        var requestUri = url.parse(req.url);
        var requestHandler = this.resources[requestUri.pathname];
        var contentTypeHeader = req.headers["content-type"];
        var mediaType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;
        console.log("HttpServer on port " + this.getPort() + " received " + req.method + " " + requestUri.pathname + " from " + req.socket.remoteAddress + " port " + req.socket.remotePort);
        // FIXME must be rejected with 415 Unsupported Media Type, guessing not allowed -> debug/testing flag
        if ((req.method === "PUT" || req.method === "POST") && (!mediaType || mediaType.length == 0)) {
            console.warn("HttpServer on port " + this.getPort() + " got no Media Type for " + req.method);
            mediaType = core_1.ContentSerdes.DEFAULT;
        }
        if (requestHandler === undefined) {
            res.writeHead(404);
            res.end("Not Found");
        }
        else if ((req.method === "PUT" || req.method === "POST")
            && core_1.ContentSerdes.get().getSupportedMediaTypes().indexOf(core_1.ContentSerdes.get().isolateMediaType(mediaType)) < 0) {
            res.writeHead(415);
            res.end("Unsupported Media Type");
        }
        else {
            if (req.method === "GET" && (requestHandler.getType() === "Property" || requestHandler.getType() === "Asset" || (requestHandler.getType() === "TD"))) {
                requestHandler.onRead()
                    .then(function (content) {
                    if (!content.mediaType) {
                        console.warn("HttpServer on port " + _this.getPort() + " got no Media Type from " + req.socket.remoteAddress + " port " + req.socket.remotePort);
                    }
                    else {
                        res.setHeader("Content-Type", content.mediaType);
                    }
                    res.writeHead(200);
                    res.end(content.body);
                })["catch"](function (err) {
                    console.error("HttpServer on port " + _this.getPort() + " got internal error on read '" + requestUri.pathname + "': " + err.message);
                    res.writeHead(500);
                    res.end(err.message);
                });
            }
            else if (req.method === "PUT" && requestHandler.getType() === "Property" || requestHandler.getType() === "Asset") {
                var body_1 = [];
                req.on("data", function (data) { body_1.push(data); });
                req.on("end", function () {
                    console.debug("HttpServer on port " + _this.getPort() + " completed body '" + body_1 + "'");
                    requestHandler.onWrite({ mediaType: mediaType, body: Buffer.concat(body_1) })
                        .then(function () {
                        res.writeHead(204);
                        res.end("Changed");
                    })["catch"](function (err) {
                        console.error("HttpServer on port " + _this.getPort() + " got internal error on write '" + requestUri.pathname + "': " + err.message);
                        res.writeHead(500);
                        res.end(err.message);
                    });
                });
            }
            else if (req.method === "POST" && requestHandler.getType() === "Action") {
                var body_2 = [];
                req.on("data", function (data) { body_2.push(data); });
                req.on("end", function () {
                    console.debug("HttpServer on port " + _this.getPort() + " completed body '" + body_2 + "'");
                    requestHandler.onInvoke({ mediaType: mediaType, body: Buffer.concat(body_2) })
                        .then(function (content) {
                        // Actions may have a void return (no output)
                        if (content.body === null) {
                            res.writeHead(204);
                            res.end("Changed");
                        }
                        else {
                            if (!content.mediaType) {
                                console.warn("HttpServer on port " + _this.getPort() + " got no Media Type from '" + requestUri.pathname + "'");
                            }
                            else {
                                res.setHeader('Content-Type', content.mediaType);
                            }
                            res.writeHead(200);
                            res.end(content.body);
                        }
                    })["catch"](function (err) {
                        console.error("HttpServer on port " + _this.getPort() + " got internal error on invoke '" + requestUri.pathname + "': " + err.message);
                        res.writeHead(500);
                        res.end(err.message);
                    });
                });
            }
            else if (requestHandler instanceof core_2.EventResourceListener) {
                // NOTE: Using Keep-Alive does not work well with NodeJS HTTP client because of socket pooling :/
                // FIXME get supported content types from EventResourceListener
                res.setHeader("Content-Type", core_1.ContentSerdes.DEFAULT);
                res.writeHead(200);
                var subscription_1 = requestHandler.subscribe({
                    next: function (content) {
                        // send event data
                        res.end(content.body);
                    },
                    complete: function () { return res.end(); }
                });
                res.on("finish", function () {
                    console.debug("HttpServer on port " + _this.getPort() + " closed Event connection");
                    subscription_1.unsubscribe();
                });
                res.setTimeout(60 * 60 * 1000, function () { return subscription_1.unsubscribe(); });
            }
            else if (req.method === "DELETE") {
                requestHandler.onUnlink()
                    .then(function () {
                    res.writeHead(204);
                    res.end("Deleted");
                })["catch"](function (err) {
                    console.error("HttpServer on port " + _this.getPort() + " got internal error on unlink '" + requestUri.pathname + "': " + err.message);
                    res.writeHead(500);
                    res.end(err.message);
                });
            }
            else {
                res.writeHead(405);
                res.end("Method Not Allowed");
            }
        }
    };
    return HttpServer;
}());
exports["default"] = HttpServer;
