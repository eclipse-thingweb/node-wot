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

import { ProtocolServer, ResourceListener, ContentSerdes } from "@node-wot/core";
import { EventResourceListener } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";

export default class WebSocketServer implements ProtocolServer {

  public readonly scheme: string = "ws";
  private readonly port: number = 8081;
  private readonly ownServer: boolean = true;
  private readonly httpServer: http.Server;
  private readonly server: WebSocketServer;
  private running: boolean = false;
  private failed: boolean = false;

  private readonly resources: { [key: string]: ResourceListener } = {};
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

  public addResource(path: string, res: ResourceListener): boolean {
    if (this.resources[path] !== undefined) {
      console.warn(`WebSocketServer on port ${this.getPort()} already has ResourceListener '${path}' - skipping`);
      return false;
    } else if (res instanceof EventResourceListener) {
      console.debug(`WebSocketServer on port ${this.getPort()} adding resource '${path}'`);
      this.resources[path] = res;
      this.socketServers[path] = new WebSocket.Server({ noServer: true });
      this.socketServers[path].on('connection', (ws) => {
        let subscription = res.subscribe({
          next: (content) => {
            switch (content.mediaType) {
              case "application/json":
              case "text/plain":
                ws.send(content.body.toString());
                break;
              default:
                ws.send(content.body);
                break;
            }
          },
          complete: () => ws.close()
        });
        ws.on("close", () => { subscription.unsubscribe(); });
      });
      return true;
    } else {
      console.info("WebSocketServer skips non-Event resouce");
    }
  }

  public removeResource(path: string): boolean {
    // TODO debug-level
    console.log(`WebSocketServer on port ${this.getPort()} removing resource '${path}'`);
    delete this.resources[path];
    this.socketServers[path].close();
    delete this.socketServers[path];
    return true;
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
    if (this.httpServer.address()) {
      return this.httpServer.address().port;
    } else {
      return -1;
    }
  }


  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {

    res.on('finish', () => {
      console.log(`HttpServer on port ${this.getPort()} replied with ${res.statusCode} to ${req.socket.remoteAddress} port ${req.socket.remotePort}`);
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

    let requestUri = url.parse(req.url);
    let requestHandler = this.resources[requestUri.pathname];
    let contentTypeHeader: string | string[] = req.headers["content-type"];
    let mediaType: string = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;

    console.log(`HttpServer on port ${this.getPort()} received ${req.method} ${requestUri.pathname} from ${req.socket.remoteAddress} port ${req.socket.remotePort}`);
    
    // FIXME must be rejected with 415 Unsupported Media Type, guessing not allowed -> debug/testing flag
    if ((req.method === "PUT" || req.method === "POST") && (!mediaType || mediaType.length == 0)) {
      console.warn(`HttpServer on port ${this.getPort()} got no Media Type for ${req.method}`);
      mediaType = ContentSerdes.DEFAULT;
    }

    if (requestHandler === undefined) {
      res.writeHead(404);
      res.end("Not Found");

    } else if ( (req.method === "PUT" || req.method === "POST")
              && ContentSerdes.get().getSupportedMediaTypes().indexOf(ContentSerdes.get().isolateMediaType(mediaType))<0) {
      res.writeHead(415);
      res.end("Unsupported Media Type");

    } else {
      if (req.method === "GET" && (requestHandler.getType()==="Property" || requestHandler.getType()==="Asset" ||(requestHandler.getType()==="TD"))) {
        requestHandler.onRead()
          .then(content => {
            if (!content.mediaType) {
              console.warn(`HttpServer on port ${this.getPort()} got no Media Type from ${req.socket.remoteAddress} port ${req.socket.remotePort}`);
            } else {
              res.setHeader("Content-Type", content.mediaType);
            }
            res.writeHead(200);
            res.end(content.body);
          })
          .catch(err => {
            console.error(`HttpServer on port ${this.getPort()} got internal error on read '${requestUri.pathname}': ${err.message}`);
            res.writeHead(500);
            res.end(err.message);
          });

      } else if (req.method === "PUT" && requestHandler.getType()==="Property" || requestHandler.getType()==="Asset") {
        let body: Array<any> = [];
        req.on("data", (data) => { body.push(data) });
        req.on("end", () => {
          console.debug(`HttpServer on port ${this.getPort()} completed body '${body}'`);
          requestHandler.onWrite({ mediaType: mediaType, body: Buffer.concat(body) })
            .then(() => {
              res.writeHead(204);
              res.end("Changed");
            })
            .catch(err => {
              console.error(`HttpServer on port ${this.getPort()} got internal error on write '${requestUri.pathname}': ${err.message}`);
              res.writeHead(500);
              res.end(err.message);
            });
        });

      } else if (req.method === "POST" && requestHandler.getType()==="Action") {
        let body: Array<any> = [];
        req.on("data", (data) => { body.push(data) });
        req.on("end", () => {
          console.debug(`HttpServer on port ${this.getPort()} completed body '${body}'`);
          requestHandler.onInvoke({ mediaType: mediaType, body: Buffer.concat(body) })
            .then(content => {
              // Actions may have a void return (no output)
              if (content.body === null) {
                res.writeHead(204);
                res.end("Changed");
              } else {
                if (!content.mediaType) {
                  console.warn(`HttpServer on port ${this.getPort()} got no Media Type from '${requestUri.pathname}'`);
                } else {
                  res.setHeader('Content-Type', content.mediaType);
                }
                res.writeHead(200);
                res.end(content.body);
              }
            })
            .catch((err) => {
              console.error(`HttpServer on port ${this.getPort()} got internal error on invoke '${requestUri.pathname}': ${err.message}`);
              res.writeHead(500);
              res.end(err.message);
            });
        });

      } else if (requestHandler instanceof EventResourceListener) {
        res.setHeader("Connection", "Keep-Alive");
        // FIXME get supported content types from EventResourceListener
        res.setHeader("Content-Type", ContentSerdes.DEFAULT);
        res.writeHead(200);
        let subscription = requestHandler.subscribe({
          next: (content) => res.end(content.body),
          complete: () => res.end()
        });
        res.on("close", () => {
          console.warn(`HttpServer on port ${this.getPort()} lost Event connection`);
          subscription.unsubscribe();
        });
        res.on("finish", () => {
          console.warn(`HttpServer on port ${this.getPort()} closed Event connection`);
          subscription.unsubscribe();
        });
        res.setTimeout(60*60*1000, () => subscription.unsubscribe());

      } else if (req.method === "DELETE") {
        requestHandler.onUnlink()
          .then(() => {
            res.writeHead(204);
            res.end("Deleted");
          })
          .catch(err => {
            console.error(`HttpServer on port ${this.getPort()} got internal error on unlink '${requestUri.pathname}': ${err.message}`);
            res.writeHead(500);
            res.end(err.message);
          });

      } else {
        res.writeHead(405);
        res.end("Method Not Allowed");
      }
    }
  }
}
