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

const coaps = require("node-coap-client").CoapClient;
import * as url from "url";

import { Subscription } from 'rxjs/Subscription';

import { ProtocolClient, Content } from "@node-wot/core";
import { CoapForm } from "./coap";

export default class CoapsClient implements ProtocolClient {

  // FIXME coap Agent closes socket when no messages in flight -> new socket with every request
  private authorization: any;

  constructor() {
    // Intentionally blank
  }

  public toString(): string {
    return "[CoapsClient]";
  }

  public readResource(form: CoapForm): Promise<Content> {
    return new Promise<Content>((resolve, reject) => {

      this.generateRequest(form, "get").then( (res: any) => {
        console.log(`CoapsClient received ${res.code} from ${form.href}`);
        console.debug(`CoapsClient received headers: ${JSON.stringify(res.format)}`);
        resolve({ body: res.payload, contentType: form.mediaType });
      })
      .catch( (err: any) => { reject(err) });
    });
  }

  public writeResource(form: CoapForm, content: Content): Promise<any> {
    return new Promise<void>((resolve, reject) => {

      this.generateRequest(form, "put", content).then( (res: any) => {
        console.log(`CoapsClient received ${res.code} from ${form.href}`);
        console.debug(`CoapsClient received headers: ${JSON.stringify(res.format)}`);
        resolve();
      })
      .catch( (err: any) => { reject(err) });
    });
  }

  public invokeResource(form: CoapForm, content?: Content): Promise<Content> {
    return new Promise<Content>((resolve, reject) => {

      this.generateRequest(form, "post", content).then( (res: any) => {
        console.log(`CoapsClient received ${res.code} from ${form.href}`);
        console.debug(`CoapsClient received headers: ${JSON.stringify(res.format)}`);
        resolve({ body: res.payload, contentType: form.mediaType });
      })
      .catch( (err: any) => { reject(err) });
    });
  }

  public unlinkResource(form: CoapForm): Promise<any> {
    return new Promise<void>((resolve, reject) => {

      this.generateRequest(form, "delete").then( (res: any) => {
        console.log(`CoapsClient received ${res.code} from ${form.href}`);
        console.debug(`CoapsClient received headers: ${JSON.stringify(res.format)}`);
        resolve();
      })
      .catch( (err: any) => { reject(err) });
    });
  }

  public subscribeResource(form: CoapForm, next: ((value: any) => void), error?: (error: any) => void, complete?: () => void): any {
    error(new Error(`CoapClient does not implement subscribe`));
    return null;
  }

  public start(): boolean {
    return true;
  }

  public stop(): boolean {
    // FIXME coap does not provide proper API to close Agent
    return true;
  }
  public setSecurity(metadata: Array<WoT.Security>, credentials?: any): boolean {

    if (metadata === undefined || !Array.isArray(metadata) || metadata.length == 0) {
      console.warn(`CoapsClient received empty security metadata`);
      return false;
    }

    let security: WoT.Security = metadata[0];

    if (security.scheme === "psk") {
      this.authorization = { psk: { } };
      this.authorization.psk[credentials.identity] = credentials.psk;

    } else if (security.scheme === "apikey") {
      console.error(`CoapsClient cannot use Apikey: Not implemented`);
      return false;

    } else {
      console.error(`CoapsClient cannot set security scheme '${security.scheme}'`);
      console.dir(metadata);
      return false;
    }

    // TODO: node-coap-client does not support proxy / options in general :o
    /*
    if (security.proxyURI) {
      if (this.proxyOptions !== null) {
        console.info(`HttpClient overriding client-side proxy with security proxyURI '${security.proxyURI}`);
      }

      this.proxyOptions = this.uriToOptions(security.proxyURI);

      if (metadata.proxyauthorization == "Basic") {
        this.proxyOptions.headers = {};
        this.proxyOptions.headers['Proxy-Authorization'] = "Basic " + Buffer.from(credentials.username + ":" + credentials.password).toString('base64');
      } else if (metadata.proxyauthorization == "Bearer") {
        this.proxyOptions.headers = {};
        this.proxyOptions.headers['Proxy-Authorization'] = "Bearer " + credentials.token;
      }
    }
    */

    console.log(`CoapsClient using security scheme '${security.scheme}'`);
    return true;
  }

  private generateRequest(form: CoapForm, dflt: string, content?: Content): any {
    
    let requestUri = url.parse(form.href.replace(/$coaps/, "https"));
    
    coaps.setSecurityParams(requestUri.hostname, this.authorization );

    let method: string = dflt;

    if (typeof form["coap:methodCode"] === "number") {
      console.log("CoapsClient got Form 'methodCode'", form["coap:methodCode"]);
      switch (form["coap:methodCode"]) {
        case 1: method = "get"; break;
        case 2: method = "post"; break;
        case 3: method = "put"; break;
        case 4: method = "delete"; break;
        default: console.warn("CoapsClient got invalid 'methodCode', using default", method);
      }
    }

    console.log(`CoapsClient sending ${method} to ${form.href}`);
    let req = coaps.request(
        form.href /* string */,
        method /* "get" | "post" | "put" | "delete" */,
        content ? content.body : undefined /* Buffer */
    );

    return req;
  }
}
