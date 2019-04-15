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
 * CoAP client based on coap by mcollina
 */

let coap = require("coap");
import * as url from "url";

import { Subscription } from "rxjs/Subscription";

// for Security definition
import * as WoT from "wot-typescript-definitions";

import { ProtocolClient, Content, ContentSerdes } from "@node-wot/core";
import { CoapForm, CoapRequestConfig, CoapOption } from "./coap";
import CoapServer from "./coap-server";

export default class CoapClient implements ProtocolClient {

  // FIXME coap Agent closes socket when no messages in flight -> new socket with every request
  private readonly agent: any;

  constructor(server?: CoapServer) {
    // if server is passed, feed its socket into the CoAP agent for socket re-use
    this.agent = new coap.Agent(server ? { socket: server.getSocket() } : undefined);
    
    // WoT-specific content formats
    coap.registerFormat(ContentSerdes.JSON_LD, 2100);
    // TODO also register content fromat with IANA
    // from experimental range for now
    coap.registerFormat(ContentSerdes.TD, 65100);
    // TODO need hook from ContentSerdes for runtime data formats
  }

  public toString(): string {
    return "[CoapClient]";
  }

  public readResource(form: CoapForm): Promise<Content> {
    return new Promise<Content>((resolve, reject) => {

      let req = this.generateRequest(form, "GET");

      console.log(`CoapClient sending ${req.statusCode} to ${form.href}`);

      req.on("response", (res: any) => {
        console.log(`CoapClient received ${res.code} from ${form.href}`);
        console.debug(`CoapClient received Content-Format: ${res.headers["Content-Format"]}`);
        
        // FIXME does not work with blockwise because of node-coap
        let contentType = res.headers["Content-Format"];
        if (!contentType) contentType = form.contentType;
        
        resolve({ type: contentType, body: res.payload });
      });
      req.on("error", (err: Error) => reject(err));
      req.end();
    });
  }

  public writeResource(form: CoapForm, content: Content): Promise<any> {
    return new Promise<void>((resolve, reject) => {

      let req = this.generateRequest(form, "PUT");

      // TODO set Content-FOrmat

      console.log(`CoapClient sending ${req.statusCode} to ${form.href}`);

      req.on("response", (res: any) => {
        console.log(`CoapClient received ${res.code} from ${form.href}`);
        console.debug(`CoapClient received headers: ${JSON.stringify(res.headers)}`);
        resolve();
      });
      req.on("error", (err: Error) => reject(err));
      req.setOption("Content-Format", content.type);
      req.write(content.body);
      req.end();
    });
  }

  public invokeResource(form: CoapForm, content?: Content): Promise<Content> {
    return new Promise<Content>((resolve, reject) => {

      let req = this.generateRequest(form, "POST");

      console.log(`CoapClient sending ${req.statusCode} to ${form.href}`);

      req.on("response", (res: any) => {
        console.log(`CoapClient received ${res.code} from ${form.href}`);
        console.debug(`CoapClient received Content-Format: ${res.headers["Content-Format"]}`);
        console.debug(`CoapClient received headers: ${JSON.stringify(res.headers)}`);
        let contentType = res.headers["Content-Format"];
        resolve({ type: contentType, body: res.payload });
      });
      req.on("error", (err: Error) => reject(err));
      if (content) {
        req.setOption("Content-Format", content.type);
        req.write(content.body);
      }
      req.end();
    });
  }

  public unlinkResource(form: CoapForm): Promise<any> {
    return new Promise<void>((resolve, reject) => {

      let req = this.generateRequest(form, "DELETE");

      console.log(`CoapClient sending ${req.statusCode} to ${form.href}`);

      req.on("response", (res: any) => {
        console.log(`CoapClient received ${res.code} from ${form.href}`);
        console.debug(`CoapClient received headers: ${JSON.stringify(res.headers)}`);
        resolve();
      });
      req.on("error", (err: Error) => reject(err));
      req.end();
    });
  }

  public subscribeResource(form: CoapForm, next: ((value: any) => void), error?: (error: any) => void, complete?: () => void): any {
    let req = this.generateRequest(form, "GET", true);

    console.log(`CoapClient sending ${req.statusCode} to ${form.href}`);

    req.on("response", (res: any) => {
      console.log(`CoapClient received ${res.code} from ${form.href}`);
      console.debug(`CoapClient received Content-Format: ${res.headers["Content-Format"]}`);

      // FIXME does not work with blockwise because of node-coap
      let contentType = res.headers["Content-Format"];
      if (!contentType) contentType = form.contentType;

      res.on('data', (data: any) => {
        next({ type: contentType, body: res.payload });
      });
    });

    req.on("error", (err: any) => error(err));

    req.end();

    return new Subscription( () => {} );
  }

  public start(): boolean {
    return true;
  }

  public stop(): boolean {
    // FIXME coap does not provide proper API to close Agent
    return true;
  }
  public setSecurity = (metadata: Array<WoT.Security>) => true;

  private uriToOptions(uri: string): CoapRequestConfig {
    let requestUri = url.parse(uri);
    let options: CoapRequestConfig = {
      agent: this.agent,
      hostname: requestUri.hostname,
      port: parseInt(requestUri.port, 10),
      pathname: requestUri.pathname,
      query: requestUri.query,
      observe: false,
      multicast: false,
      confirmable: true
    };

    // TODO auth

    return options;
  }

  private generateRequest(form: CoapForm, dflt: string, observable: boolean = false): any {

    let options: CoapRequestConfig = this.uriToOptions(form.href);

    options.method = dflt;

    if (typeof form["coap:methodCode"] === "number") {
      console.log("CoapClient got Form 'methodCode'", form["coap:methodCode"]);
      switch (form["coap:methodCode"]) {
        case 1: options.method = "GET"; break;
        case 2: options.method = "POST"; break;
        case 3: options.method = "PUT"; break;
        case 4: options.method = "DELETE"; break;
        default: console.warn("CoapClient got invalid 'methodCode', using default", options.method);
      }
    }
    options.observe = observable;

    let req = this.agent.request(options);

    // apply form data
    if (typeof form.contentType === "string") {
      console.log("CoapClient got Form 'contentType'", form.contentType);
      req.setOption("Accept", form.contentType);
    }
    if (Array.isArray(form["coap:options"])) {
      console.log("CoapClient got Form 'options'", form["coap:options"]);
      let options = form["coap:options"] as Array<CoapOption>;
      for (let option of options) {
        req.setOption(option["coap:optionCode"], option["coap:optionValue"]);
      }
    } else if (typeof form["coap:options"] === "object") {
      console.warn("CoapClient got Form SINGLE-ENTRY 'options'", form["coap:options"]);
      let option = form["coap:options"] as CoapOption;
      req.setHeader(option["coap:optionCode"], option["coap:optionValue"]);
    }

    return req;
  }
}
