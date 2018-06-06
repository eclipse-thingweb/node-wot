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
 * CoAP Server based on coap by mcollina
 */

import * as url from 'url';
import {ContentSerdes} from "@node-wot/core";
import { ProtocolServer, ResourceListener, Content } from "@node-wot/core"

const coap = require('coap');

export default class CoapServer implements ProtocolServer {

  public readonly scheme: string = "coap";
  private readonly port: number = 5683;
  private readonly address: string = undefined;
  private readonly server: any = coap.createServer((req: any, res: any) => { this.handleRequest(req, res); });
  private running: boolean = false;
  private failed: boolean = false;

  private readonly resources: { [key: string]: ResourceListener } = {};

  constructor(port?: number, address?: string) {
    if (port !== undefined) {
      this.port = port;
    }
    if (address !== undefined) {
      this.address = address;
    }
  }

  public addResource(path: string, res: ResourceListener): boolean {
    if (this.resources[path] !== undefined) {
      console.warn(`CoapServer on port ${this.getPort()} already has ResourceListener '${path}' - skipping`);
      return false;
    } else {
      // TODO debug-level
      console.log(`CoapServer on port ${this.getPort()} adding resource '${path}'`);
      this.resources[path] = res;
      return true;
    }
  }

  public removeResource(path: string): boolean {
    // TODO debug-level
    console.log(`CoapServer on port ${this.getPort()} removing resource '${path}'`);
    return delete this.resources[path];
  }

  public start(): Promise<void> {
    console.info(`CoapServer starting on ${(this.address !== undefined ? this.address + ' ' : '')}port ${this.port}`);
    return new Promise<void>((resolve, reject) => {
      
      // start promise handles all errors until successful start
      this.server.once('error', (err: Error) => { reject(err); });
      this.server.listen(this.port, this.address, () => {
        // once started, console "handles" errors
        this.server.on('error', (err: Error) => {
          console.error(`CoapServer for port ${this.port} failed: ${err.message}`); this.failed = true;
        });
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    console.info(`CoapServer stopping on port ${this.getPort()}`);
    return new Promise<void>((resolve, reject) => {
      // stop promise handles all errors from now on
      this.server.once('error', (err: Error) => { reject(err); });
      this.server.close(() => { resolve(); } );
    });
  }

  public getPort(): number {
    if (this.server._sock) {
      return this.server._sock.address().port;
    } else {
      return -1;
    }
  }

  private handleRequest(req: any, res: any) {
    console.log(`CoapServer on port ${this.getPort()} received ${req.method} ${req.url}`
      + ` from ${req.rsinfo.address} port ${req.rsinfo.port}`);
    res.on('finish', () => {
      console.log(`CoapServer replied with ${res.code} to ${req.rsinfo.address} port ${req.rsinfo.port}`);
      // FIXME res.options is undefined, no other useful property to get Content-Format
      //logger.warn(`CoapServer sent Content-Format: '${res.options['Content-Format']}'`);
    });

    let requestUri = url.parse(req.url);
    let requestHandler = this.resources[requestUri.pathname];
    // TODO must be rejected with 4.15 Unsupported Content-Format, guessing not allowed
    let mediaType = req.options['Content-Format'] ? req.options['Content-Format'] : 'application/json'; // ContentSerdes.DEFAULT;

    if (requestHandler === undefined) {
      res.code = '4.04';
      res.end('Not Found');
    } else {
      if (req.method === 'GET') {
        requestHandler.onRead()
          .then(content => {
            res.code = '2.05';
            if (!content.mediaType) {
              console.warn(`CoapServer got no Media Type from '${requestUri.pathname}'`);
            } else {
              res.setOption('Content-Format', content.mediaType);
            }
            // finish
            res.end(content.body);
          })
          .catch(err => {
            console.error(`CoapServer on port ${this.getPort()}`
              + ` got internal error on read '${requestUri.pathname}': ${err.message}`);
            res.code = '5.00'; res.end(err.message);
          });
      } else if (req.method === 'PUT') {
        requestHandler.onWrite({ mediaType: mediaType, body: req.payload })
          .then(() => {
            res.code = '2.04';
            // finish with diagnostic payload
            res.end('Changed');
          })
          .catch(err => {
            console.error(`CoapServer on port ${this.getPort()}`
              + ` got internal error on write '${requestUri.pathname}': ${err.message}`);
            res.code = '5.00'; res.end(err.message);
          });
      } else if (req.method === 'POST') {
        requestHandler.onInvoke({ mediaType: mediaType, body: req.payload })
          .then(content => {
            // Actions may have a void return (no output)
            if (content.body === null) {
              res.code = '2.04';
            } else {
              res.code = '2.05';
              if (!content.mediaType) {
                console.warn(`CoapServer got no Media Type from '${requestUri.pathname}'`);
              } else {
                res.setOption('Content-Format', content.mediaType);
              }
            }
            // finish with whatever
            res.end(content.body);
          })
          .catch(err => {
            console.error(`CoapServer on port ${this.getPort()}`
              + ` got internal error on invoke '${requestUri.pathname}': ${err.message}`);
            res.code = '5.00'; res.end(err.message);
          });
      } else if (req.method === 'DELETE') {
        requestHandler.onUnlink()
          .then(() => {
            res.code = '2.02';
            // finish with diagnostic payload
            res.end('Deleted');
          })
          .catch(err => {
            console.error(`CoapServer on port ${this.getPort()}`
              + ` got internal error on unlink '${requestUri.pathname}': ${err.message}`);
            res.code = '5.00'; res.end(err.message);
          });
      } else {
        res.code = '4.05';
        res.end('Method Not Allowed');
      }
    }
  }
}
