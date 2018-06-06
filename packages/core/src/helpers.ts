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
 * Generic helper functions used across the code
 * These Helpers are used like this:
 * ```
 * import * as Helpers from './helpers'
 * 
 * ...
 * Helpers.foo(bar)
 * ...
 * ```
 */

import * as url from 'url';
import * as os from 'os'

export function extractScheme(uri: string) {
  let parsed = url.parse(uri);
  // console.log(parsed)
  // remove trailing ':'
  if (parsed.protocol === null) {
    throw new Error(`Protocol in url "${uri}" must be valid`)
  }
  let scheme = parsed.protocol.slice(0, -1);
  console.debug(`Helpers found scheme '${scheme}'`);
  return scheme;
}

export function getAddresses(): Array<string> {
  let addresses: Array<any> = [];

  let interfaces = os.networkInterfaces();

  for (let iface in interfaces) {
    interfaces[iface].forEach((entry: any) => {
      console.debug(`AddressHelper found ${entry.address}`);
      if (entry.internal === false) {
        if (entry.family === 'IPv4') {
          addresses.push(entry.address);
        } else if (entry.scopeid === 0) {
          addresses.push(entry.address);
        }
      }
    });
  }

  //addresses.push('127.0.0.1');

  console.debug(`AddressHelper identified ${addresses}`);

  return addresses;
}

export function toUriLiteral(address: string): string {
  if (address.indexOf(':') !== -1) {
    address = `[${address}]`;
  }
  return address;
}

