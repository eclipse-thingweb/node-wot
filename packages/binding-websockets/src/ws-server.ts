/********************************************************************************
 * Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
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

import * as WebSocket from "ws";
import { AddressInfo } from "net";

import * as TD from "@node-wot/td-tools";
import { ProtocolServer, Servient, ExposedThing, ContentSerdes, Helpers, Content } from "@node-wot/core";
import { HttpServer, HttpConfig } from "@node-wot/binding-http";

export default class WebSocketServer implements ProtocolServer {

  public readonly scheme: string;
  public readonly EVENT_DIR: string = "events";
  private readonly port: number = 8081;
  private readonly address: string = undefined;
  private readonly ownServer: boolean = true;
  private readonly httpServer: http.Server | https.Server;

  private readonly thingNames: Set<string> = new Set<string>();
  private readonly socketServers: { [key: string]: WebSocket.Server } = {};

  constructor(serverOrConfig: HttpServer | HttpConfig = {} ) {
    // FIXME instanceof did not work reliably
    if (serverOrConfig instanceof HttpServer && (typeof serverOrConfig.getServer === "function")) {
      this.ownServer = false;
      this.httpServer = serverOrConfig.getServer();
      this.port = serverOrConfig.getPort();
      this.scheme = serverOrConfig.scheme === "https" ? "wss" : "ws";

    } else if (typeof serverOrConfig === "object") {
      let config: HttpConfig = <HttpConfig>serverOrConfig;
      // HttpConfig
      if (config.port !== undefined) {
        this.port = config.port;
      }
      if (config.address !== undefined) {
        this.address = config.address;
      }
  
      // TLS
      if (config.serverKey && config.serverCert) {
        let options: any = {};
        options.key = fs.readFileSync(config.serverKey);
        options.cert = fs.readFileSync(config.serverCert);
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
    console.debug("[binding-websockets]",`WebSocketServer starting on ${(this.address !== undefined ? this.address + ' ' : '')}port ${this.port}`);
    return new Promise<void>((resolve, reject) => {

      // handle incoming WebScoket connections
      this.httpServer.on("upgrade", (request, socket, head) => {
        const pathname = url.parse(request.url).pathname;

        let socketServer = this.socketServers[pathname];

        if (socketServer) {
          socketServer.handleUpgrade(request, socket, head, (ws) => {
            socketServer.emit("connection", ws, request);
          });
        } else {
          socket.destroy();
        }
      });

      if (this.ownServer) {
        this.httpServer.once("error", (err: Error) => { reject(err); });
        this.httpServer.once("listening", () => {
          // once started, console "handles" errors
          this.httpServer.on("error", (err: Error) => {
            console.error("[binding-websockets]",`WebSocketServer on port ${this.port} failed: ${err.message}`);
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
    console.debug("[binding-websockets]",`WebSocketServer stopping on port ${this.port}`);
    return new Promise<void>((resolve, reject) => {
      for (let path in this.socketServers) {
        this.socketServers[path].close();
      }

      // stop promise handles all errors from now on
      if (this.ownServer) {
        console.debug("[binding-websockets]",`WebSocketServer stopping own HTTP server`);
        this.httpServer.once('error', (err: Error) => { reject(err); });
        this.httpServer.once('close', () => { resolve(); });
        this.httpServer.close();
      }
    });
  }

  public getPort(): number {
    if (this.httpServer.address() && typeof this.httpServer.address() === "object") {
      return (<AddressInfo>this.httpServer.address()).port;
    } else {
      // includes typeof "string" case, which is only for unix sockets
      return -1;
    }
  }

  public expose(thing: ExposedThing): Promise<void> {

    let slugify = require('slugify');
    let urlPath = slugify(thing.title, {lower: true});

    if (this.thingNames.has(urlPath)) {
      urlPath = Helpers.generateUniqueName(urlPath);
    }

    if (this.getPort() !== -1) {

      console.debug("[binding-websockets]",`WebSocketServer on port ${this.getPort()} exposes '${thing.title}' as unique '/${urlPath}/*'`);

      // TODO clean-up on destroy
      this.thingNames.add(urlPath);
    
      // TODO more efficient routing to ExposedThing without ResourceListeners in each server
      for (let eventName in thing.events) {
        let path = "/" + encodeURIComponent(urlPath) + "/" + this.EVENT_DIR + "/" + encodeURIComponent(eventName);
        
        console.debug("[binding-websockets]",`WebSocketServer on port ${this.getPort()} adding socketServer for '${path}'`);
        this.socketServers[path] = new WebSocket.Server({ noServer: true });
        this.socketServers[path].on('connection', (ws, req) => {
          console.debug("[binding-websockets]",`WebSocketServer on port ${this.getPort()} received connection for '${path}' from ${Helpers.toUriLiteral(req.connection.remoteAddress)}:${req.connection.remotePort}`);
          thing.subscribeEvent(eventName,
          // let subscription = thing.events[eventName].subscribe(
            (data) => {
              let content;
              try {
                content = ContentSerdes.get().valueToContent(data, thing.events[eventName].data);
              } catch(err) {
                console.warn("[binding-websockets]",`HttpServer on port ${this.getPort()} cannot process data for Event '${eventName}: ${err.message}'`);
                ws.close(-1, err.message)
                return;
              }

              switch (content.type) {
                case "application/json":
                case "text/plain":
                  ws.send(content.body.toString());
                  break;
                default:
                  ws.send(content.body);
                  break;
              }
            }
            // ,
            // (err: Error) => ws.close(-1, err.message),
            // () => ws.close(0, "Completed")
          )
          .then(() => ws.close(0, "Completed"))
          .catch((err: Error) => ws.close(-1, err.message));
          ws.on("close", () => {
            thing.unsubscribeEvent(eventName)
            // subscription.unsubscribe();
            console.debug("[binding-websockets]",`WebSocketServer on port ${this.getPort()} closed connection for '${path}' from ${Helpers.toUriLiteral(req.connection.remoteAddress)}:${req.connection.remotePort}`);
          });
        });

        for (let address of Helpers.getAddresses()) {
            let href = this.scheme + "://" + address + ":" + this.getPort() + path;
            let form = new TD.Form(href, ContentSerdes.DEFAULT);
            form.op = "subscribeevent";
            thing.events[eventName].forms.push(form);
          console.debug("[binding-websockets]",`WebSocketServer on port ${this.getPort()} assigns '${href}' to Event '${eventName}'`);
        }
      }
    }
    return new Promise<void>((resolve, reject) => {
      resolve();
    });
  }
}
