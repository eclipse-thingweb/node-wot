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

/**
 * HTTP Server based on http
 */

import * as http from "http";
import * as https from "https";
import * as url from "url";
import * as fs from "fs";
import * as net from "net";

import * as WebSocket from "ws";
import { AddressInfo } from "net";

import {
    ProtocolServer,
    Servient,
    ExposedThing,
    ContentSerdes,
    Helpers,
    Content,
    Form,
    createLoggers,
} from "@node-wot/core";
import { HttpServer, HttpConfig } from "@node-wot/binding-http";
import slugify from "slugify";

const { debug, info, error } = createLoggers("binding-websockets", "ws-server");

export default class WebSocketServer implements ProtocolServer {
    public readonly scheme: string;
    public readonly PROPERTY_DIR: string = "properties";
    public readonly ACTION_DIR: string = "actions";
    public readonly EVENT_DIR: string = "events";
    private readonly port: number = 8081;
    private readonly address?: string = undefined;
    private readonly ownServer: boolean = true;
    private readonly httpServer: http.Server | https.Server;

    private readonly thingNames: Set<string> = new Set<string>();
    private readonly thingPaths: Map<string, unknown> = new Map<string, unknown>();
    private readonly socketServers: { [key: string]: WebSocket.Server } = {};

    constructor(serverOrConfig: HttpServer | HttpConfig = {}) {
        // FIXME instanceof did not work reliably
        if (serverOrConfig instanceof HttpServer && typeof serverOrConfig.getServer === "function") {
            this.ownServer = false;
            this.httpServer = serverOrConfig.getServer();
            this.port = serverOrConfig.getPort();
            this.scheme = serverOrConfig.scheme === "https" ? "wss" : "ws";
        } else if (typeof serverOrConfig === "object") {
            const config: HttpConfig = <HttpConfig>serverOrConfig;
            // HttpConfig
            if (config.port !== undefined) {
                this.port = config.port;
            }
            if (config.address !== undefined) {
                this.address = config.address;
            }

            // TLS
            if (config.serverKey != null && config.serverCert != null) {
                const options = {
                    key: fs.readFileSync(config.serverKey),
                    cert: fs.readFileSync(config.serverCert),
                };
                this.scheme = "wss";
                this.httpServer = https.createServer(options);
            } else {
                this.scheme = "ws";
                this.httpServer = http.createServer();
            }
        } else {
            throw new Error(`WebSocketServer constructor argument must be HttpServer, HttpConfig, or undefined`);
        }
    }

    public start(servient: Servient): Promise<void> {
        debug(`WebSocketServer starting on ${this.address !== undefined ? this.address + " " : ""}port ${this.port}`);
        return new Promise<void>((resolve, reject) => {
            // handle incoming WebSocket connections
            this.httpServer.on("upgrade", (request, socket, head) => {
                const pathname = new url.URL(request.url ?? "", `${this.scheme}://${request.headers.host}`).pathname;

                const socketServer = this.socketServers[pathname];

                if (socketServer != null) {
                    socketServer.handleUpgrade(request, socket as net.Socket /* fix me */, head, (ws) => {
                        socketServer.emit("connection", ws, request);
                    });
                } else {
                    socket.destroy();
                }
            });

            if (this.ownServer) {
                this.httpServer.once("error", (err: Error) => {
                    reject(err);
                });
                this.httpServer.once("listening", () => {
                    // once started, console "handles" errors
                    this.httpServer.on("error", (err: Error) => {
                        error(`WebSocketServer on port ${this.port} failed: ${err.message}`);
                    });
                    resolve();
                });
                this.httpServer.listen(this.port, this.address);
            } else {
                resolve();
            }
        });
    }

    public stop(): Promise<void> {
        debug(`WebSocketServer stopping on port ${this.port}`);
        return new Promise<void>((resolve, reject) => {
            for (const socketServer of Object.values(this.socketServers)) {
                socketServer.close();
            }

            // stop promise handles all errors from now on
            if (this.ownServer) {
                debug("WebSocketServer stopping own HTTP server");
                this.httpServer.once("error", (err: Error) => {
                    reject(err);
                });
                this.httpServer.once("close", () => {
                    resolve();
                });
                this.httpServer.close();
            }
        });
    }

    public getPort(): number {
        if (this.httpServer.address() != null && typeof this.httpServer.address() === "object") {
            return (<AddressInfo>this.httpServer.address()).port;
        } else {
            // includes typeof "string" case, which is only for unix sockets
            return -1;
        }
    }

    public expose(thing: ExposedThing): Promise<void> {
        let urlPath = slugify(thing.title, { lower: true });
        urlPath = Helpers.generateUniqueName(urlPath, new Set(this.thingNames.keys()));

        if (this.getPort() !== -1) {
            debug(`WebSocketServer on port ${this.getPort()} exposes '${thing.title}' as unique '/${urlPath}/*'`);

            this.thingNames.add(urlPath);
            this.thingPaths.set(thing.id, urlPath);

            // TODO more efficient routing to ExposedThing without ResourceListeners in each server

            for (const [propertyName, property] of Object.entries(thing.properties)) {
                const path =
                    "/" +
                    encodeURIComponent(urlPath) +
                    "/" +
                    this.PROPERTY_DIR +
                    "/" +
                    encodeURIComponent(propertyName);

                // Populate forms related to the property
                for (const address of Helpers.getAddresses()) {
                    const href = `${this.scheme}://${address}:${this.getPort()}${path}`;
                    const form = new Form(href, ContentSerdes.DEFAULT);
                    const ops = [];

                    const writeOnly: boolean = property.writeOnly ?? false;
                    const readOnly: boolean = property.readOnly ?? false;

                    if (!writeOnly) {
                        ops.push("readproperty", "observeproperty", "unobserveproperty");
                    }
                    if (!readOnly) {
                        ops.push("writeproperty");
                    }
                    form.op = ops;
                    thing.properties[propertyName].forms.push(form);
                    debug(`WebSocketServer on port ${this.getPort()} assigns '${href}' to Property '${propertyName}'`);
                }

                debug(`WebSocketServer on port ${this.getPort()} adding socketServer for '${path}'`);
                this.socketServers[path] = new WebSocket.Server({ noServer: true });
                this.socketServers[path].on("connection", (ws, req) => {
                    debug(
                        `WebSocketServer on port ${this.getPort()} received connection for '${path}' from ${Helpers.toUriLiteral(
                            req.socket.remoteAddress
                        )}:${req.socket.remotePort}`
                    );

                    const observeListener = async (content: Content) => {
                        debug(`WebSocketServer on port ${this.getPort()} publishing to property '${propertyName}' `);

                        for await (const chunk of content.body) {
                            ws.send(chunk);
                        }
                    };

                    const writeOnly: boolean = property.writeOnly ?? false;
                    if (writeOnly) {
                        for (let formIndex = 0; formIndex < thing.properties[propertyName].forms.length; formIndex++) {
                            thing
                                .handleObserveProperty(propertyName, observeListener, { formIndex })
                                .catch((err: Error) => ws.close(-1, err.message));
                        }
                    }

                    ws.on("close", () => {
                        for (let formIndex = 0; formIndex < thing.properties[propertyName].forms.length; formIndex++) {
                            thing.handleUnobserveProperty(propertyName, observeListener, { formIndex });
                        }
                        debug(
                            `WebSocketServer on port ${this.getPort()} closed connection for '${path}' from ${Helpers.toUriLiteral(
                                req.socket.remoteAddress
                            )}:${req.socket.remotePort}`
                        );
                    });
                });
            }

            for (const [actionName, action] of Object.entries(thing.actions)) {
                const path =
                    "/" + encodeURIComponent(urlPath) + "/" + this.ACTION_DIR + "/" + encodeURIComponent(actionName);

                for (const address of Helpers.getAddresses()) {
                    const href = `${this.scheme}://${address}:${this.getPort()}${path}`;
                    const form = new Form(href, ContentSerdes.DEFAULT);
                    form.op = ["invokeaction"];
                    action.forms.push(form);
                    debug(`WebSocketServer on port ${this.getPort()} assigns '${href}' to Action '${actionName}'`);
                }
            }

            for (const [eventName, event] of Object.entries(thing.events)) {
                const path =
                    "/" + encodeURIComponent(urlPath) + "/" + this.EVENT_DIR + "/" + encodeURIComponent(eventName);

                // Populate forms related to the event
                for (const address of Helpers.getAddresses()) {
                    const href = `${this.scheme}://${address}:${this.getPort()}${path}`;
                    const form = new Form(href, ContentSerdes.DEFAULT);
                    form.op = "subscribeevent";
                    event.forms.push(form);
                    debug(`WebSocketServer on port ${this.getPort()} assigns '${href}' to Event '${eventName}'`);
                }

                debug(`WebSocketServer on port ${this.getPort()} adding socketServer for '${path}'`);
                this.socketServers[path] = new WebSocket.Server({ noServer: true });
                this.socketServers[path].on("connection", (ws, req) => {
                    debug(
                        `WebSocketServer on port ${this.getPort()} received connection for '${path}' from ${Helpers.toUriLiteral(
                            req.socket.remoteAddress
                        )}:${req.socket.remotePort}`
                    );

                    const eventListener = async (content: Content) => {
                        for await (const chunk of content.body) {
                            ws.send(chunk);
                        }
                    };

                    for (let formIndex = 0; formIndex < event.forms.length; formIndex++) {
                        thing
                            .handleSubscribeEvent(eventName, eventListener, { formIndex })
                            .catch((err: Error) => ws.close(-1, err.message));
                    }

                    ws.on("close", () => {
                        for (let formIndex = 0; formIndex < event.forms.length; formIndex++) {
                            thing.handleUnsubscribeEvent(eventName, eventListener, { formIndex });
                        }
                        debug(
                            `WebSocketServer on port ${this.getPort()} closed connection for '${path}' from ${Helpers.toUriLiteral(
                                req.socket.remoteAddress
                            )}:${req.socket.remotePort}`
                        );
                    });
                });
            }
        }
        return new Promise<void>((resolve, reject) => {
            resolve();
        });
    }

    public destroy(thingId: string): Promise<boolean> {
        debug(`WebSocketServer on port ${this.getPort()} destroying thingId '${thingId}'`);
        return new Promise<boolean>((resolve, reject) => {
            let removedThing = false;
            for (const name of Array.from(this.thingPaths.keys())) {
                const thingPath = this.thingPaths.get(name) as string;
                removedThing = this.thingNames.delete(thingPath);
            }
            if (removedThing) {
                info(`WebSocketServer successfully destroyed '${thingId}'`);
            } else {
                info(`WebSocketServer failed to destroy thing with thingId '${thingId}'`);
            }
            resolve(removedThing !== undefined);
        });
    }
}
