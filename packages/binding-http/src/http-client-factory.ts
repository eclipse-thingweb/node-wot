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
 * HTTP client Factory
 */

import { ProtocolClientFactory, ProtocolClient } from "@node-wot/core";
import HttpClient from './http-client';

export default class HttpClientFactory implements ProtocolClientFactory {

  public readonly scheme: string = "http";
  private clientSideProxy : any = null;

  constructor(proxy : any = null) {
    this.clientSideProxy = proxy;
  }

  public getClient(): ProtocolClient {
    // HTTP over HTTPS proxy requires HttpsClient
    if (this.clientSideProxy && this.clientSideProxy.href && this.clientSideProxy.href.startsWith("https:")) {
      console.warn(`HttpClientFactory creating client for 'https' due to insecure proxy configuration`);
      return new HttpClient(this.clientSideProxy, true);
    } else {
      console.log(`HttpClientFactory creating client for '${this.scheme}'`);
      return new HttpClient(this.clientSideProxy);
    }
  }

  public init(): boolean {
    // console.info(`HttpClientFactory for '${HttpClientFactory.scheme}' initializing`);
    // TODO uncomment info if something is executed here
    return true;
  }

  public destroy(): boolean {
    // console.info(`HttpClientFactory for '${HttpClientFactory.scheme}' destroyed`);
    // TODO uncomment info if something is executed here
    return true;
  }
}
