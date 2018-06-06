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
 * HTTP client based on http
 */

import * as http from "http";
import * as https from "https";
import * as url from "url";

import { ProtocolClient, Content } from "@node-wot/core";
import { HttpForm, HttpHeader, HttpConfig } from "./http";

export default class HttpClient implements ProtocolClient {

  private readonly agent: http.Agent;
  private readonly provider: any;
  private proxyOptions: http.RequestOptions = null;
  private authorization: string = null;
  private allowSelfSigned: boolean = false;

  constructor(config: HttpConfig = null, secure = false) {

    // config proxy by client side (not from TD)
    if (config!==null && config.proxy && config.proxy.href) {
      this.proxyOptions = this.uriToOptions(config.proxy.href);
      if (config.proxy.authorization === "Basic") {
        if (!config.proxy.username || !config.proxy.password) console.warn(`HttpClient client configured for Basic proxy auth, but no username/password given`);
        this.proxyOptions.headers = {};
        this.proxyOptions.headers['Proxy-Authorization'] = "Basic " + new Buffer(config.proxy.username + ":" + config.proxy.password).toString('base64');
      } else if (config.proxy.authorization === "Bearer") {
        if (!config.proxy.token) console.warn(`HttpClient client configured for Bearer proxy auth, but no token given`);
        this.proxyOptions.headers = {};
        this.proxyOptions.headers['Proxy-Authorization'] = "Bearer " + config.proxy.token;
      }
      // security for hop to proxy
      if (this.proxyOptions.protocol === "https") {
        secure = true;
      }
      console.info(`HttpClient using ${secure ? "secure " : ""}proxy ${this.proxyOptions.hostname}:${this.proxyOptions.port}`);
    }

    // config certificate checks
    if (config!==null && config.allowSelfSigned!==undefined) {
      this.allowSelfSigned = config.allowSelfSigned;
      console.warn(`HttpClient allowing self-signed/untrusted certificates -- USE FOR TESTING ONLY`);
    }

    // using one client impl for both HTTP and HTTPS
    this.agent = secure ? new https.Agent({ keepAlive: true, }) : new http.Agent({ keepAlive: true });
    this.provider = secure ? https : http;
  }

  private getContentType(res: http.IncomingMessage): string {
    let header: string | string[] = res.headers['content-type']; // note: node http uses lower case here
    if (Array.isArray(header)) {
      // this should never be the case as only cookie headers are returned as array
      // but anyways...
      return (header.length > 0) ? header[0] : "";
    } else {
      return header;
    }
  }

  public toString(): string {
    return `[HttpClient]`;
  }

  public readResource(form: HttpForm): Promise<Content> {
    return new Promise<Content>((resolve, reject) => {

      let req = this.generateRequest(form, "GET");

      console.log(`HttpClient sending ${req.method} to ${form.href}`);

      req.on("response", (res: https.IncomingMessage) => {
        console.log(`HttpClient received ${res.statusCode} from ${form.href}`);
        let mediaType: string = this.getContentType(res);
        //console.log(`HttpClient received Content-Type: ${mediaType}`);
        //console.log(`HttpClient received headers: ${JSON.stringify(res.headers)}`);
        let body: Array<any> = [];
        res.on('data', (data) => { body.push(data) });
        res.on('end', () => {
          resolve({ mediaType: mediaType, body: Buffer.concat(body) });
        });
      });
      req.on("error", (err: any) => reject(err));
      req.end();
    });
  }

  public writeResource(form: HttpForm, content: Content): Promise<any> {
    return new Promise<void>((resolve, reject) => {

      let req = this.generateRequest(form, "PUT");

      req.setHeader("Content-Type", content.mediaType);
      req.setHeader("Content-Length", content.body.byteLength);

      console.log(`HttpClient sending ${req.method} with '${req.getHeader("Content-Type")}' to ${form.href}`);

      req.on("response", (res: https.IncomingMessage) => {
        console.log(`HttpClient received ${res.statusCode} from ${form.href}`);
        //console.log(`HttpClient received headers: ${JSON.stringify(res.headers)}`);
        // Although 204 without payload is expected, data must be read 
        // to complete request (http blocks socket otherwise)
        // TODO might have response on write for future HATEOAS concept
        let body: Array<any> = [];
        res.on('data', (data) => { body.push(data) });
        res.on('end', () => {
          resolve();
        });
      });
      req.on('error', (err: any) => reject(err));
      req.write(content.body);
      req.end();
    });
  }

  public invokeResource(form: HttpForm, content?: Content): Promise<Content> {
    return new Promise<Content>((resolve, reject) => {

      let req = this.generateRequest(form, "POST");

      if (content) {
        req.setHeader("Content-Type", content.mediaType);
        req.setHeader("Content-Length", content.body.byteLength);
      }

      console.log(`HttpClient sending ${req.method} with '${req.getHeader("Content-Type")}' to ${form.href}`);

      req.on("response", (res: https.IncomingMessage) => {
        console.log(`HttpClient received ${res.statusCode} from ${form.href}`);
        let mediaType: string = this.getContentType(res);
        //console.log(`HttpClient received Content-Type: ${mediaType}`);
        //console.log(`HttpClient received headers: ${JSON.stringify(res.headers)}`);
        let body: Array<any> = [];
        res.on('data', (data) => { body.push(data) });
        res.on('end', () => {
          resolve({ mediaType: mediaType, body: Buffer.concat(body) });
        });
      });
      req.on("error", (err: any) => reject(err));
      if (content) {
        req.write(content.body);
      }
      req.end();
    });
  }

  public unlinkResource(form: HttpForm): Promise<any> {
    return new Promise<void>((resolve, reject) => {
      let options: http.RequestOptions = this.uriToOptions(form.href);

      options.method = 'DELETE';

      let req = this.provider.request(options);
      this.generateRequest(form, req);

      console.log(`HttpClient sending ${req.method} to ${form.href}`);

      req.on("response", (res: https.IncomingMessage) => {
        console.log(`HttpClient received ${res.statusCode} from ${form.href}`);
        //console.log(`HttpClient received headers: ${JSON.stringify(res.headers)}`);
        // Although 204 without payload is expected, data must be read
        //  to complete request (http blocks socket otherwise)
        // TODO might have response on unlink for future HATEOAS concept
        let body: Array<any> = [];
        res.on('data', (data) => { body.push(data) });
        res.on('end', () => {
          resolve();
        });
      });
      req.on('error', (err: any) => reject(err));
      req.end();
    });
  }

  public start(): boolean {
    return true;
  }

  public stop(): boolean {
    this.agent.destroy();
    return true;
  }

  public setSecurity(metadata: any, credentials?: any): boolean {

    if (Array.isArray(metadata)) {
      metadata = metadata[0];
    }

    if (metadata.authorization === "Basic") {
      this.authorization = "Basic " + new Buffer(credentials.username + ":" + credentials.password).toString('base64');

    } else if (metadata.authorization === "Bearer") {
      // TODO get token from metadata.as (authorization server)
      this.authorization = "Bearer " + credentials.token;

    } else if (metadata.authorization === "Proxy" && metadata.href !== null) {
      if (this.proxyOptions !== null) {
        console.info(`HttpClient overriding client-side proxy with security metadata 'Proxy'`);
      }
      this.proxyOptions = this.uriToOptions(metadata.href);
      if (metadata.proxyauthorization == "Basic") {
        this.proxyOptions.headers = {};
        this.proxyOptions.headers['Proxy-Authorization'] = "Basic " + new Buffer(credentials.username + ":" + credentials.password).toString('base64');
      } else if (metadata.proxyauthorization == "Bearer") {
        this.proxyOptions.headers = {};
        this.proxyOptions.headers['Proxy-Authorization'] = "Bearer " + credentials.token;
      }

    } else if (metadata.authorization === "SessionID") {
      // TODO this is just an idea sketch
      console.error(`HttpClient cannot use SessionID: Not implemented`);

    } else {
      console.error(`HttpClient cannot set security metadata '${metadata.authorization}'`);
      console.dir(metadata);
      return false;
    }

    console.log(`HttpClient using security metadata '${metadata.authorization}'`);
    return true;
  }

  private uriToOptions(uri: string): https.RequestOptions {
    let requestUri = url.parse(uri);
    let options: https.RequestOptions = {};
    options.agent = this.agent;

    if (this.proxyOptions != null) {
      options.hostname = this.proxyOptions.hostname;
      options.port = this.proxyOptions.port;
      options.path = uri;
      options.headers = {};
      // copy header fields for Proxy-Auth etc.
      for (let hf in this.proxyOptions.headers) options.headers[hf] = this.proxyOptions.headers[hf];
      options.headers["Host"] = requestUri.hostname;
    } else {
      options.hostname = requestUri.hostname;
      options.port = parseInt(requestUri.port, 10);
      options.path = requestUri.path;
      options.headers = {};
    }

    if (this.authorization !== null) {
      options.headers["Authorization"] = this.authorization;
    }

    if (this.allowSelfSigned === true) {
      options.rejectUnauthorized = false;
    }

    return options;
  }
  private generateRequest(form: HttpForm, dflt: string): any {

    let options: http.RequestOptions = this.uriToOptions(form.href);

    options.method = dflt;

    if (typeof form["http:methodName"] === "string") {
      console.log("HttpClient got Form 'methodName'", form["http:methodName"]);
      switch (form["http:methodName"]) {
        case "GET": options.method = "GET"; break;
        case "POST": options.method = "POST"; break;
        case "PUT": options.method = "PUT"; break;
        case "DELETE": options.method = "DELETE"; break;
        case "PATCH": options.method = "PATCH"; break;
        default: console.warn("HttpClient got invalid 'methodName', using default", options.method);
      }
    }

    let req = this.provider.request(options);

    console.log(`HttpClient applying form`);
    //console.dir(form);

    // apply form data
    if (typeof form.mediaType === "string") {
      console.log("HttpClient got Form 'mediaType'", form.mediaType);
      req.setHeader("Accept", form.mediaType);
    }
    if (Array.isArray(form["http:headers"])) {
      console.log("HttpClient got Form 'headers'", form["http:headers"]);
      let headers = form["http:headers"] as Array<HttpHeader>;
      for (let option of headers) {
        req.setHeader(option["http:fieldName"], option["http:fieldValue"]);
      }
    } else if (typeof form["http:headers"] === "object") {
      console.warn("HttpClient got Form SINGLE-ENTRY 'headers'", form["http:headers"]);
      let option = form["http:headers"] as HttpHeader;
      req.setHeader(option["http:fieldName"], option["http:fieldValue"]);
    }

    return req;
  }
}
