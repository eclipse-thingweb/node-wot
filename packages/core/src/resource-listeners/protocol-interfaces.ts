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

 import { InteractionForm } from "@node-wot/td-tools";

export interface ProtocolClient {

  /** this client is requested to perform a "read" on the resource with the given URI */
  readResource(form: InteractionForm): Promise<Content>;

  /** this cliet is requested to perform a "write" on the resource with the given URI  */
  writeResource(form: InteractionForm, content: Content): Promise<void>;

  /** this client is requested to perform an "invoke" on the resource with the given URI */
  invokeResource(form: InteractionForm, content: Content): Promise<Content>;

  /** this client is requested to perform an "unlink" on the resource with the given URI */
  unlinkResource(form: InteractionForm): Promise<void>;

  /** start the client (ensure it is ready to send requests) */
  start(): boolean;
  /** stop the client */
  stop(): boolean;

  /** apply TD security metadata */
  setSecurity(metadata: any, credentials?: any): boolean;
}

export interface ProtocolClientFactory {
  readonly scheme: string;
  getClient(): ProtocolClient;
  init(): boolean;
  destroy(): boolean;
}

export interface ProtocolServer {
  readonly scheme: string;
  addResource(path: string, res: ResourceListener): boolean;
  removeResource(path: string): boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  getPort(): number;
}

export interface Content {
  mediaType: string,
  body: Buffer
}

/**
 * defines the behaviour for a Resource 
 * expected implementations are e.g. actionlistener, propertylistener etc.
 * 
 * mkovatsc: we probably need to pass around an object with Media Type info, Buffer, and maybe error code
 * mkovatsc: not sure if we need a promise here. The calls should be non-blocking IIRC
 * mkovatsc: we need some adapter that uses TD information to convert between our Scripting API valueType
 *           objects and the Buffer/mediaType. Where should this go?
 */
export interface ResourceListener {
  // FIXME instanceof does not work to determine type
  getType(): string;
  onRead(): Promise<Content>;
  onWrite(value: Content): Promise<void>;
  onInvoke(value: Content): Promise<Content>;
  onUnlink(): Promise<void>;
}
