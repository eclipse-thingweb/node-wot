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
 * Generic helper functions used across the code
 * These Helpers are used like this:
 * ```
 * import Helpers from "@node-wot/core"
 * 
 * ...
 * Helpers.foo(bar)
 * ...
 * ```
 */

import * as url from "url";
import * as os from "os";

// imports for fetchTD
import Servient from "./servient";
import * as TD from "@node-wot/td-tools";
import { ContentSerdes } from "./content-serdes";

export default class Helpers {

  private static staticAddress: string = undefined;

  public static extractScheme(uri: string) {
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

  public static setStaticAddress(address: string) {
    Helpers.staticAddress = address;
  }

  public static getAddresses(): Array<string> {
    let addresses: Array<any> = [];

    if (Helpers.staticAddress!==undefined) {
      addresses.push(Helpers.staticAddress);
      
      console.debug(`AddressHelper uses static ${addresses}`);
      return addresses;
    } else {

      let interfaces = os.networkInterfaces();

      for (let iface in interfaces) {
        interfaces[iface].forEach((entry: any) => {
          console.debug(`AddressHelper found ${entry.address}`);
          if (entry.internal === false) {
            if (entry.family === "IPv4") {
              addresses.push(entry.address);
            } else if (entry.scopeid === 0) {
              addresses.push(Helpers.toUriLiteral(entry.address));
            }
          }
        });
      }

      // add localhost only if no external addresses
      if (addresses.length===0) {
        addresses.push('localhost');
      }

      console.debug(`AddressHelper identified ${addresses}`);

      return addresses;
    }
  }

  public static toUriLiteral(address: string): string {

    // Due to crash logged with:
    // TypeError: Cannot read property 'indexOf' of undefined at Function.Helpers.toUriLiteral 
    if (!address) {
      console.error(`AddressHelper received invalid address '${address}'`);
      return "{invalid address}";
    }

    if (address.indexOf(':') !== -1) {
      address = `[${address}]`;
    }
    return address;
  }

  public static generateUniqueName(name: string) {
    let suffix = name.match(/.+_([0-9]+)$/);
    if (suffix !== null) {
      return name.slice(0, -suffix[1].length) + (1+parseInt(suffix[1]));
    } else {
      return name + "_2";
    }
  }

  public static fetchTD(srv: Servient, uri: string): Promise<WoT.ThingDescription> {
    return new Promise<WoT.ThingDescription>((resolve, reject) => {
        let client = srv.getClientFor(Helpers.extractScheme(uri));
        console.info(`WoTImpl fetching TD from '${uri}' with ${client}`);
        client.readResource(new TD.Form(uri, ContentSerdes.TD))
            .then((content) => {
                client.stop();

                if (content.type !== ContentSerdes.TD &&
                  content.type !== ContentSerdes.JSON_LD ) {
                  console.warn(`WoTImpl received TD with media type '${content.type}' from ${uri}`);
                }

                let td = content.body.toString();

                try {
                  let jo : object = JSON.parse(td);
                  resolve(jo);
                } catch(err) {
                  reject(new Error(`WoTImpl fetched invalid JSON from '${uri}': ${err.message}`));
                }
            })
            .catch((err) => { reject(err); });
    });
  }

  /**
   *  helper function to extend class
   */
  public static extend<T, U>(first: T, second: U): T & U {
    let result = <T & U>{};
    for (let id in first) {
        (<any>result)[id] = (<any>first)[id];
    }
    for (let id in second) {
        if (!result.hasOwnProperty(id)) {
            (<any>result)[id] = (<any>second)[id];
        }
    }
    return result;
  }
}
