/********************************************************************************
 * Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
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
import { Form } from "@node-wot/td-tools";
import { ProtocolClient, Content } from "@node-wot/core"
import fs = require('fs');
import path = require('path');

export default class FileClient implements ProtocolClient {

  constructor() { }

  public toString() {
    return "[FileClient]";
  }

  public readResource(form: Form): Promise<Content> {
    return new Promise<Content>((resolve, reject) => {
      let filepath = form.href.split('//');
      let resource = fs.readFileSync(filepath[1], 'utf8');
      let extension = path.extname(filepath[1]);
      console.debug("[binding-file]", `FileClient found '${extension}' extension`);
      let contentType;
      if (form.contentType) {
        contentType = form.contentType;
      } else {
        // *guess* contentType based on file extension
        contentType = "application/octet-stream";
        switch (extension) {
          case ".txt":
          case ".log":
          case ".ini":
          case ".cfg":
            contentType = "text/plain";
            break;
          case ".json":
            contentType = "application/json";
            break;
          case ".jsonld":
            contentType = "application/ld+json";
            break;
          default:
            console.warn("[binding-file]", `FileClient cannot determine media type of '${form.href}'`);
        }
      }
      resolve({ type: contentType, body: Buffer.from(resource) });
    });
  }

  public writeResource(form: Form, content: Content): Promise<any> {
    return new Promise<Object>((resolve, reject) => {
      reject(new Error(`FileClient does not implement write`));
    });
  }

  public invokeResource(form: Form, payload: Object): Promise<any> {
    return new Promise<Object>((resolve, reject) => {
      reject(new Error(`FileClient does not implement invoke`));
    });
  }

  public unlinkResource(form: Form): Promise<any> {
    return new Promise<Object>((resolve, reject) => {
      reject(new Error(`FileClient does not implement unlink`));
    });
  }

  public subscribeResource(form: Form, next: ((value: any) => void), error?: (error: any) => void, complete?: () => void): any {
    error(new Error(`FileClient does not implement subscribe`));
    return null;
  }

  public start(): boolean {
    return true;
  }

  public stop(): boolean {
    return true;
  }

  public setSecurity = (metadata : any) => false;
}
