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
import WebSocketClient from './ws-client';

export default class WebSocketClientFactory implements ProtocolClientFactory {

  public readonly scheme: string = "ws";
  private clientSideProxy : any = null;

  constructor(proxy : any = null) {
    this.clientSideProxy = proxy;
  }

  public getClient(): ProtocolClient {
    console.log(`HttpClientFactory creating client for '${this.scheme}'`);
    return new WebSocketClient();
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
