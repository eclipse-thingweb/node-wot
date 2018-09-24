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
import * as url from "url";

import * as WebSocket from "ws";
import { AddressInfo } from "net";

import * as TD from "@node-wot/td-tools";
import { ProtocolServer, ContentSerdes, ExposedThing, Helpers } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";

export default class WebSocketServer implements ProtocolServer {

  public readonly scheme: string = "ws";
  public readonly EVENT_DIR: string = "events";
  private readonly port: number = 8081;
  private readonly ownServer: boolean = true;
  private readonly httpServer: http.Server;
  private running: boolean = false;
  private failed: boolean = false;

  private readonly thingNames: Set<string> = new Set<string>();
  private readonly socketServers: { [key: string]: WebSocket.Server } = {};

  constructor(portOrServer?: number | HttpServer) {
    if (typeof portOrServer==="number") {
      this.port = portOrServer;
      this.httpServer = http.createServer();
    } else if (typeof portOrServer==="object") {
      this.ownServer = false;
      this.httpServer = portOrServer.getServer();
      this.port = portOrServer.getPort();
    } else {
      throw new Error(`WebSocketServer constructor argument must be number, http.Server, or undefined`);
    }
  }

  public start(): Promise<void> {
    console.info(`WebSocketServer starting on port ${this.port}`);
    return new Promise<void>((resolve, reject) => {

      if (this.ownServer) {
        this.httpServer.once('error', (err: Error) => { reject(err); });
        this.httpServer.once('listening', () => {
          // once started, console "handles" errors
          this.httpServer.on('error', (err: Error) => {
            console.error(`WebSocketServer on port ${this.port} failed: ${err.message}`);
            resolve();
          });
        });
        this.httpServer.listen(this.port);
      }

      this.httpServer.on('upgrade', (request, socket, head) => {
        const pathname = url.parse(request.url).pathname;

        let socketServer = this.socketServers[pathname];

        if (socketServer) {
          socketServer.handleUpgrade(request, socket, head, (ws) => {
            socketServer.emit('connection', ws, request);
          });
        } else {
          socket.destroy();
        }
      });
      if (!this.ownServer) resolve();
    });
  }

  public stop(): Promise<void> {
    console.info(`WebSocketServer stopping on port ${this.port}`);
    return new Promise<void>((resolve, reject) => {

      // stop promise handles all errors from now on
      if (this.ownServer) {
        this.httpServer.once('error', (err: Error) => { reject(err); });
        this.httpServer.once('close', () => { resolve(); });
        this.httpServer.close();
      } else {
        for (let path in this.socketServers) {
          this.socketServers[path].close();
        }
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

    let name = thing.name;

    if (this.thingNames.has(name)) {
      name = Helpers.generateUniqueName(name);
    }

    if (this.getPort() !== -1) {

      console.log(`WebSocketServer on port ${this.getPort()} exposes '${thing.name}' as unique '/${name}/*'`);

      // TODO clean-up on destroy
      this.thingNames.add(name);
    
      // TODO more efficient routing to ExposedThing without ResourceListeners in each server
      for (let eventName in thing.events) {
        let path = "/" + encodeURIComponent(name) + "/" + this.EVENT_DIR + "/" + encodeURIComponent(eventName);
        
        console.debug(`WebSocketServer on port ${this.getPort()} adding socketServer for '${path}'`);
        this.socketServers[path] = new WebSocket.Server({ noServer: true });
        this.socketServers[path].on('connection', (ws, req) => {
          console.log(`WebSocketServer on port ${this.getPort()} received connection for '${path}' from ${Helpers.toUriLiteral(req.connection.remoteAddress)}:${req.connection.remotePort}`);
          let subscription = thing.events[eventName].subscribe(
            (content) => {
              switch (content.contentType) {
                case "application/json":
                case "text/plain":
                  ws.send(content.body.toString());
                  break;
                default:
                  ws.send(content.body);
                  break;
              }
            },
            (err: Error) => ws.close(-1, err.message),
            () => ws.close(0, "Completed")
          );
          ws.on("close", () => {
            subscription.unsubscribe();
            console.log(`WebSocketServer on port ${this.getPort()} closed connection for '${path}' from ${Helpers.toUriLiteral(req.connection.remoteAddress)}:${req.connection.remotePort}`);
          });
        });

        for (let address of Helpers.getAddresses()) {
            let href = this.scheme + "://" + address + ":" + this.getPort() + path;
            thing.events[eventName].forms.push(new TD.Form(href, ContentSerdes.DEFAULT));
            console.log(`WebSocketServer on port ${this.getPort()} assigns '${href}' to Event '${eventName}'`);
        }
      }
    }
    return new Promise<void>((resolve, reject) => {
      resolve();
    });
  }
}
