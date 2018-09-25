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

import { AddressInfo } from "net";

import * as TD from "@node-wot/td-tools";
import { ProtocolServer, ContentSerdes, ExposedThing, Helpers } from "@node-wot/core";

export default class HttpServer implements ProtocolServer {

  public readonly scheme: string = "http";

  private readonly PROPERTY_DIR = "properties";
  private readonly ACTION_DIR = "actions";
  private readonly EVENT_DIR = "events";

  private readonly port: number = 8080;
  private readonly address: string = undefined;
  private readonly server: http.Server = http.createServer((req, res) => { this.handleRequest(req, res) });
  private readonly things: Map<string, ExposedThing> = new Map<string, ExposedThing>();

  constructor(port?: number, address?: string) {
    if (port !== undefined) {
      this.port = port;
    }
    if (address !== undefined) {
      this.address = address;
    }
  }

  public start(): Promise<void> {
    console.info(`HttpServer starting on ${(this.address !== undefined ? this.address + ' ' : '')}port ${this.port}`);
    return new Promise<void>((resolve, reject) => {

      // long timeout for long polling
      this.server.setTimeout(60*60*1000, () => { console.info("HttpServer on port ${this.getPort()} timed out connection"); });
      // no keep-alive because NodeJS HTTP clients do not properly use same socket due to pooling
      this.server.keepAliveTimeout = 0;

      // start promise handles all errors until successful start
      this.server.once('error', (err: Error) => { reject(err); });
      this.server.once('listening', () => {
        // once started, console "handles" errors
        this.server.on('error', (err: Error) => {
          console.error(`HttpServer on port ${this.port} failed: ${err.message}`);
        });
        resolve();
      });
      this.server.listen(this.port, this.address);
    });
  }

  public stop(): Promise<void> {
    console.info(`HttpServer stopping on port ${this.getPort()}`);
    return new Promise<void>((resolve, reject) => {

      // stop promise handles all errors from now on
      this.server.once('error', (err: Error) => { reject(err); });
      this.server.once('close', () => { resolve(); });
      this.server.close();
    });
  }

  /** returns http.Server to be re-used by other HTTP-based bindings (e.g., WebSockets) */
  public getServer(): http.Server {
    return this.server;
  }

  /** returns server port number and indicates that server is running when larger than -1  */
  public getPort(): number {
    if (this.server.address() && typeof this.server.address() === "object") {
      return (<AddressInfo>this.server.address()).port;
    } else {
      // includes address() typeof "string" case, which is only for unix sockets
      return -1;
    }
  }
  
  public expose(thing: ExposedThing): Promise<void> {

    let name = thing.name;

    if (this.things.has(name)) {
      name = Helpers.generateUniqueName(name);
    }

    if (this.getPort() !== -1) {

      console.log(`HttpServer on port ${this.getPort()} exposes '${thing.name}' as unique '/${name}'`);
      this.things.set(name, thing);

      // fill in binding data
      for (let address of Helpers.getAddresses()) {
        for (let type of ContentSerdes.get().getOfferedMediaTypes()) {
          let base: string = this.scheme + "://" + address + ":" + this.getPort() + "/" + encodeURIComponent(name);

          for (let propertyName in thing.properties) {
            let href = base + "/" + this.PROPERTY_DIR + "/" + encodeURIComponent(propertyName);
            thing.properties[propertyName].forms.push(new TD.Form(href, type));
            console.log(`HttpServer on port ${this.getPort()} assigns '${href}' to Property '${propertyName}'`);
          }
          
          for (let actionName in thing.actions) {
            let href = base + "/" + this.ACTION_DIR + "/" + encodeURIComponent(actionName);
            thing.actions[actionName].forms.push(new TD.Form(href, type));
            console.log(`HttpServer on port ${this.getPort()} assigns '${href}' to Action '${actionName}'`);
          }
          
          for (let eventName in thing.events) {
            let href = base + "/" + this.EVENT_DIR + "/" + encodeURIComponent(eventName);
            let form = new TD.Form(href, type);
            form.subProtocol = "LongPoll";
            thing.events[eventName].forms.push(form);
            console.log(`HttpServer on port ${this.getPort()} assigns '${href}' to Event '${eventName}'`);
          }
        } // media types
      } // addresses

    } // running

    return new Promise<void>((resolve, reject) => {
      resolve();
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    
    let requestUri = url.parse(req.url);

    console.log(`HttpServer on port ${this.getPort()} received '${req.method} ${requestUri.pathname}' from ${Helpers.toUriLiteral(req.socket.remoteAddress)}:${req.socket.remotePort}`);
    res.on("finish", () => {
      console.log(`HttpServer on port ${this.getPort()} replied with '${res.statusCode}' to ${Helpers.toUriLiteral(req.socket.remoteAddress)}:${req.socket.remotePort}`);
    });

    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Request-Method", "*");
    res.setHeader("Access-Control-Allow-Methods", "OPTIONS, HEAD, GET, POST, PUT, DELETE, PATCH");
    res.setHeader("Access-Control-Allow-Headers", "content-type, authorization, *");
    
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    let contentTypeHeader: string | string[] = req.headers["content-type"];
    let contentType: string = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;

    if (req.method === "PUT" || req.method === "POST") {
      if (!contentType) {
        // FIXME should be rejected with 400 Bad Request, as guessing is not good in M2M -> debug/testing flag to allow
        // FIXME would need to check if payload is present
        console.warn(`HttpServer on port ${this.getPort()} received no Content-Type from ${Helpers.toUriLiteral(req.socket.remoteAddress)}:${req.socket.remotePort}`);
        contentType = ContentSerdes.DEFAULT;
      } else if (ContentSerdes.get().getSupportedMediaTypes().indexOf(ContentSerdes.getMediaType(contentType))<0) {
        res.writeHead(415);
        res.end("Unsupported Media Type");
        return;
      }
    }

    // route request
    let segments = requestUri.pathname.split("/");

    if (segments[1] === "") {
      // no path -> list all Things
      res.setHeader("Content-Type", ContentSerdes.DEFAULT);
      res.writeHead(200);
      let list = [];
      for (let address of Helpers.getAddresses()) {
        // FIXME are Iterables really such a non-feature that I need array?
        for (let name of Array.from(this.things.keys())) {
          list.push(this.scheme + "://" + Helpers.toUriLiteral(address) + ":" + this.getPort() + "/" + encodeURIComponent(name));
        }
      }
      res.end(JSON.stringify(list));
      // resource found and response sent
      return;

    } else {
      // path -> select Thing
      let thing = this.things.get(segments[1]);
      if (thing) {

        if (segments.length === 2 || segments[2] === "") {
          // Thing root -> send TD
          if (req.method === "GET") {
            res.setHeader("Content-Type", ContentSerdes.TD);
            res.writeHead(200);
            res.end(JSON.stringify(thing));
          } else {
            res.writeHead(405);
            res.end("Method Not Allowed");
          }
          // resource found and response sent
          return;

        } else if (segments[2] === this.PROPERTY_DIR) {
          // sub-path -> select Property
          let property = thing.properties[segments[3]];
          if (property) {
            if (req.method === "GET") {
              property.read()
                .then((value) => {
                  let content = ContentSerdes.get().valueToContent(value, <any>property);
                  res.setHeader("Content-Type", content.contentType);
                  res.writeHead(200);
                  res.end(content.body);
                })
                .catch(err => {
                  console.error(`HttpServer on port ${this.getPort()} got internal error on read '${requestUri.pathname}': ${err.message}`);
                  res.writeHead(500);
                  res.end(err.message);
                });
            } else if (req.method === "PUT") {
              if (property.writable) {
                // load payload
                let body: Array<any> = [];
                req.on("data", (data) => { body.push(data) });
                req.on("end", () => {
                  console.debug(`HttpServer on port ${this.getPort()} completed body '${body}'`);
                  let value;
                  try {
                    value = ContentSerdes.get().contentToValue({ contentType: contentType, body: Buffer.concat(body) }, <any>property);
                  } catch(err) {
                    res.writeHead(400);
                    res.end("Invalid Data");
                    return;
                  }
                  property.write(value)
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
              } else {
                res.writeHead(400);
                res.end("Property Not Writable");
              }
            } else {
              res.writeHead(405);
              res.end("Method Not Allowed");
            }
            // resource found and response sent
            return;
          } // Property exists?

        } else if (segments[2] === this.ACTION_DIR) {
          // sub-path -> select Action
          let action = thing.actions[segments[3]];
          if (action) {
            if (req.method === "POST") {
              // load payload
              let body: Array<any> = [];
              req.on("data", (data) => { body.push(data) });
              req.on("end", () => {
                console.debug(`HttpServer on port ${this.getPort()} completed body '${body}'`);
                let input;
                try {
                  input = ContentSerdes.get().contentToValue({ contentType: contentType, body: Buffer.concat(body) }, action.input);
                } catch(err) {
                  res.writeHead(400);
                  res.end("Invalid Input Data");
                  return;
                }
                action.invoke(input)
                  .then((output) => {
                    if (output) {
                      let content = ContentSerdes.get().valueToContent(output, action.output);
                      res.setHeader("Content-Type", content.contentType);
                      res.writeHead(200);
                      res.end(content.body);
                    } else {
                      res.writeHead(200);
                      res.end();
                    }
                  })
                  .catch(err => {
                    console.error(`HttpServer on port ${this.getPort()} got internal error on invoke '${requestUri.pathname}': ${err.message}`);
                    res.writeHead(500);
                    res.end(err.message);
                  });
              });
            } else {
              res.writeHead(405);
              res.end("Method Not Allowed");
            }
            // resource found and response sent
            return;
          } // Action exists?

        } else if (segments[2] === this.EVENT_DIR) {
          // sub-path -> select Event
          let event = thing.events[segments[3]];
          if (event) {
            if (req.method === "GET") {
              // FIXME must decide on Content-Type here, not on next()
              res.setHeader("Content-Type", ContentSerdes.DEFAULT);
              res.writeHead(200);
              let subscription = event.subscribe(
                (content) => {
                  // send event data
                  res.end(content.body);
                },
                () => res.end(),
                () => res.end()
              );
              res.on("finish", () => {
                console.debug(`HttpServer on port ${this.getPort()} closed Event connection`);
                subscription.unsubscribe();
              });
              res.setTimeout(60*60*1000, () => subscription.unsubscribe());
            } else {
              res.writeHead(405);
              res.end("Method Not Allowed");
            }
            // resource found and response sent
            return;
          } // Event exists?
        }
      } // Thing exists?
    }

    // resource not found
    res.writeHead(404);
    res.end("Not Found");
  }
}
