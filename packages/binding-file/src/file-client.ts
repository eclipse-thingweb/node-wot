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
 * File protocol binding
 */
import { InteractionForm } from "@node-wot/td-tools";
import { ProtocolClient, Content } from "@node-wot/core"
import fs = require('fs');
import path = require('path');

export default class FileClient implements ProtocolClient {

  constructor() { }

  public toString() {
    return "[FileClient]";
  }

  public readResource(form: InteractionForm): Promise<Content> {
    return new Promise<Content>((resolve, reject) => {
      let filepath = form.href.split('//');
      let resource = fs.readFileSync(filepath[1], 'utf8');
      let extension = path.extname(filepath[1]);
      console.debug(`FileClient found '${extension}' extension`);
      let mediaType = "application/octet-stream";
      switch (extension) {
        case ".txt":
        case ".log":
        case ".ini":
        case ".cfg":
          mediaType = "text/plain";
          break;
        case ".json":
          mediaType = "application/json";
          break;
        case ".jsonld":
          mediaType = "application/ld+json";
          break;
        default:
          console.warn(`FileClient cannot determine media type of '${form.href}'`);
      }
      resolve({ mediaType: mediaType, body: new Buffer(resource) });
    });
  }

  public writeResource(form: InteractionForm, content: Content): Promise<any> {
    return;
  }

  public invokeResource(form: InteractionForm, payload: Object): Promise<any> {
    return new Promise<Object>((resolve, reject) => {
      resolve('FileClient POST_' + form.href + '_' + new Date())
    })
  }

  public unlinkResource(form: InteractionForm): Promise<any> {
    return new Promise<Object>((resolve, reject) => {
      resolve('FileClient DELETE_' + form.href + '_' + new Date())
    })
  }

  public start(): boolean {
    return true;
  }

  public stop(): boolean {
    return true;
  }

  public setSecurity = (metadata : any) => false;
}
