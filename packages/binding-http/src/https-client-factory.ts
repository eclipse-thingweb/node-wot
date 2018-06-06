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
 * HTTPS client Factory
 */

import { ProtocolClientFactory, ProtocolClient } from "@node-wot/core"
import HttpClient from "./http-client";

export class HttpConfig {
  public proxy?: HttpProxyConfig;
  public allowSelfSigned: boolean;
}
export class HttpProxyConfig {
  public href: USVString;
  public authorization: string;
  public token: string;
  public username: string;
  public password: string;
}

export default class HttpsClientFactory implements ProtocolClientFactory {

  public readonly scheme: string = "https";
  private config: HttpConfig = null;

  constructor(config: HttpConfig = null) {
    this.config = config;
  }

  public getClient(): ProtocolClient {
    // HTTPS over HTTP proxy requires HttpClient
    if (this.config.proxy && this.config.proxy.href && this.config.proxy.href.startsWith("http:")) {
      console.warn(`HttpsClientFactory creating client for 'http' due to insecure proxy configuration`);
      return new HttpClient(this.config);
    } else {
      console.log(`HttpsClientFactory creating client for '${this.scheme}'`);
      return new HttpClient(this.config, true);
    }
  }

  public init(): boolean {
    // console.info(`HttpsClientFactory for '${HttpsClientFactory.scheme}' initializing`);
    // TODO uncomment info if something is executed here
    return true;
  }

  public destroy(): boolean {
    // console.info(`HttpsClientFactory for '${HttpsClientFactory.scheme}' destroyed`);
    // TODO uncomment info if something is executed here
    return true;
  }
}
