/********************************************************************************
 * Copyright (c) 2018 - 2021 Contributors to the Eclipse Foundation
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
 * Fujitsu Bridge that connects to remote proxy by acting like a WoT Server
 */

import * as url from "url";
import * as WebSocket from "ws";

import * as TD from "@node-wot/td-tools";
import { ProtocolServer, Servient, ExposedThing, ContentSerdes, Content } from "@node-wot/core";


export default class FujitsuServer implements ProtocolServer {

  public readonly scheme: string = "ws";
  private readonly remote: string;
  private websocket: WebSocket;

  private readonly things: Map<string, ExposedThing> = new Map<string, ExposedThing>();

  constructor(remoteURI: string) {

    let parsed = url.parse(remoteURI);

    if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
      throw new Error(`FujitsuServer requires WebSocket URI ('ws' or 'wss')`);
    }
    if (parsed.host === "") {
      throw new Error(`FujitsuServer requires WebSocket URI (no host given)`);
    }
    
    this.remote = remoteURI;
  }

  public start(servient: Servient): Promise<void> {
    console.info("[binding-fujitsu]",`FujitsuServer starting for ${this.remote}`);
    return new Promise<void>((resolve, reject) => {

      this.websocket = new WebSocket(this.remote);
      
      this.websocket.once("error", (err: Error) => { reject(err); });
      this.websocket.once("open", () => {
        console.debug("[binding-fujitsu]",`FujitsuServer for ${this.remote} connected`);
        this.websocket.ping();
        // once started, console "handles" errors
        this.websocket.on("error", (err: Error) => {
          console.error("[binding-fujitsu]",`FujitsuServer for ${this.remote} failed: ${err.message}`);
        });
        resolve();
      });
      this.websocket.on("message", (data) => {
        this.handle(data);
      });
    });
  }

  public stop(): Promise<void> {
    console.info("[binding-fujitsu]",`WebSocketServer stopping for ${this.remote}`);
    return new Promise<void>((resolve, reject) => {

      // stop promise handles all errors from now on
      this.websocket.once("error", (err: Error) => { reject(err); });
      this.websocket.once("close", () => { resolve(); });

      for (let id in this.things) {
        this.websocket.send(JSON.stringify({
          version: "rev07June2018",
          type: "UNREGISTER",
          hardwareID: id
        }));
        this.things.delete(id);
      }

      this.websocket.close();
    });
  }

  public getPort(): number {
    // do not show in TD
    return -1;
  }

  public expose(thing: ExposedThing): Promise<void> {

    console.debug("[binding-fujitsu]",`FujitsuServer for ${this.remote} exposes '${thing.title}'`);
    this.things.set(thing.id, thing);

    // create a copy for Fujitsu-specific href handles
    let thingCopy = JSON.parse(JSON.stringify(thing));

    for (let propertyName in thingCopy.properties) {
      thingCopy.properties[propertyName].forms = [new TD.Form(propertyName, ContentSerdes.DEFAULT)];
      console.debug("[binding-fujitsu]",`FujitsuServer for ${this.remote} assigns '${propertyName}' to Property '${propertyName}'`);
    }
    for (let actionName in thingCopy.actions) {
      thingCopy.actions[actionName].forms = [new TD.Form(actionName, ContentSerdes.DEFAULT)];
      console.debug("[binding-fujitsu]",`FujitsuServer for ${this.remote} assigns '${actionName}' to Action '${actionName}'`);
    }
    for (let eventName in thingCopy.events) {
      thingCopy.events[eventName].forms = [new TD.Form(eventName, ContentSerdes.DEFAULT)];
      console.debug("[binding-fujitsu]",`FujitsuServer for ${this.remote} assigns '${eventName}' to Action '${eventName}'`);
    }

    return new Promise<void>((resolve, reject) => {
      let message = JSON.stringify({
        version: "rev07June2018",
        type: "REGISTER",
        hardwareID: encodeURIComponent(thing.id),
        thingDescription: TD.serializeTD(thingCopy)
      });
      this.websocket.send(message, (err) => {
        if (err) {
          console.error("[binding-fujitsu]",`FujitsuServer for ${this.remote} failed to register '${thing.title}' as '${thing.id}': ${err.message}`);
          reject(err);
        } else {
          console.debug("[binding-fujitsu]",`FujitsuServer for ${this.remote} registered '${thing.title}' as '${thing.id}'`);
          resolve();
        }
      });
    });
  }

  public destroy(thingId: string): Promise<boolean> {
    console.debug("[binding-fujitsu]", `FujitsuServer on port ${this.getPort()} destroying thingId '${thingId}'`);
    return new Promise<boolean>((resolve, reject) => {
      let removedThing: ExposedThing = undefined;
      for (let name of Array.from(this.things.keys())) {
        let expThing = this.things.get(name);
        if (expThing?.id === thingId) {
          this.things.delete(name);
          removedThing = expThing;
        }
      }
      if (removedThing) {
        console.info("[binding-fujitsu]", `FujitsuServer succesfully destroyed '${removedThing.title}'`);
      } else {
        console.info("[binding-fujitsu]", `FujitsuServer failed to destroy thing with thingId '${thingId}'`)
      }
      resolve(removedThing != undefined);
    });
  }

  private handle(data: any) {

    console.debug("[binding-fujitsu]",`FujitsuServer for ${this.remote} received '${data}'`);

    let message = JSON.parse(data);

    if (message.type === "REQUEST") {

      // select Thing based on "id" field
      let thing = this.things.get(decodeURIComponent(message.deviceID));
      if (thing) {

        if (message.method === "GET") {
          let property = thing.properties[message.href];
          if (property) {
          //   property.read()
            thing.readProperty(message.href)
              .then((value) => { 
                let content = ContentSerdes.get().valueToContent(value, <any>property)
                this.reply(message.requestID, message.deviceID, content);
              })
              .catch((err: Error) => { console.error("[binding-fujitsu]",`FujitsuServer for ${this.remote} cannot read '${message.href}' of Thing '${thing.id}': ${err.message}`); });
          }
        } else if (message.method === "PUT") {
          let property = thing.properties[message.href];
          if (property) {
            let value;
            try {
              value = ContentSerdes.get().contentToValue({ type: message.mediaType, body: Buffer.from(message.entity, "base64") }, <any>property);
            } catch(err) {
              console.warn("[binding-fujitsu]",`FujitsuServer for ${this.remote} received invalid data for Property '${message.href}'`);
              // FIXME: no error message format defined in Fujitsu binding
              return;
            }
            property.write(value)
              .then(() => {
                this.reply(message.requestID, message.deviceID);
              })
              .catch((err: Error) => { console.error("[binding-fujitsu]",`FujitsuServer for ${this.remote} cannot write '${message.href}' of Thing '${thing.id}': ${err.message}`); });
          }
        } else if (message.method === "POST") {
          let action = thing.actions[message.href];
          if (action) {
            let input;
            try {
              input = ContentSerdes.get().contentToValue({ type: message.mediaType, body: Buffer.from(message.entity, "base64") }, action.input);
            } catch(err) {
              console.warn("[binding-fujitsu]",`FujitsuServer for ${this.remote} received invalid data for Action '${message.href}'`);
              // FIXME: no error message format defined in Fujitsu binding
              return;
            }
            thing.invokeAction(message.href)
            // action.invoke(input)
              .then((output) => {
                let content;
                if (output) {
                  content = ContentSerdes.get().valueToContent(output, action.output);
                }
                this.reply(message.requestID, message.deviceID, content);
              })
              .catch((err: Error) => { console.error("[binding-fujitsu]",`FujitsuServer for ${this.remote} cannot invoke '${message.href}' of Thing '${thing.id}': ${err.message}`); });
          }
        } else {
          console.warn("[binding-fujitsu]",`FujitsuServer for ${this.remote} received invalid method '${message.method}'`);
          this.replyClientError(message.requestID, message.deviceID, "Method Not Allowed");
          return;
        }

      } else {
        console.warn("[binding-fujitsu]",`FujitsuServer for ${this.remote} received invalid Thing ID '${decodeURIComponent(message.deviceID)}'`);
        this.replyClientError(message.requestID, message.deviceID, "Not Found");
        return;
      } // thing exists?

    } else {
      console.warn("[binding-fujitsu]",`FujitsuServer for ${this.remote} received invalid message type '${message.type}'`);
    } // request?

    // FIXME: no error message format defined in Fujitsu binding
  }

  private reply(requestID: string, thingID: string, content?: Content) {
    let response: any = {
        type: "RESPONSE",
        requestID: requestID,
        deviceID: thingID
      };
    
    if (content) {
      response.mediaType = content.type;
      response.buffer = content.body.toString();
    } else {
      response.buffer = "";
    }

    this.websocket.send(JSON.stringify(response), (err) => {
      if (err) {
        console.error("[binding-fujitsu]",`FujitsuServer for ${this.remote} failed to reply to '${requestID}' for '${thingID}': ${err.message}`);
      } else {
        console.debug("[binding-fujitsu]",`FujitsuServer for ${this.remote} replied to '${requestID}' ${content ? "with payload" : ""}`);
      }
    });
  }

  private replyClientError(requestID: string, thingID: string, diagnosticMessage?: string) {
    this.replyError(false, requestID, thingID, diagnosticMessage);
  }
  private replyServerError(requestID: string, thingID: string, diagnosticMessage?: string) {
    this.replyError(true, requestID, thingID, diagnosticMessage);
  }

  private replyError(server: boolean, requestID: string, thingID: string, diagnosticMessage?: string) {
    let response: any = {
      type: "RESPONSE",
      requestID: requestID,
      deviceID: thingID
    };
    
    if (diagnosticMessage) {
      response.buffer = Buffer.from(diagnosticMessage).toString("base64");
    }

    this.websocket.send(JSON.stringify(response), (err) => {
      if (err) {
        console.error("[binding-fujitsu]",`FujitsuServer for ${this.remote} failed to error '${requestID}' for '${thingID}': ${err.message}`);
      } else {
        console.debug("[binding-fujitsu]",`FujitsuServer for ${this.remote} errored '${requestID}' ${diagnosticMessage ? "with message" : ""}`);
      }
    });
  }
}
