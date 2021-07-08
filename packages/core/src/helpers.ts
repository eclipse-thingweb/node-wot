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
import { ProtocolHelpers } from "./core";
import Ajv from 'ajv';
import TDSchema from "wot-typescript-definitions/schema/td-json-schema-validation.json";

const tdSchema = TDSchema;
const ajv = new Ajv({strict:false});

export default class Helpers {

  private srv: Servient;

  constructor(srv: Servient) {
      this.srv = srv;
  }

  private static staticAddress: string = undefined;

  public static extractScheme(uri: string) {
    let parsed = url.parse(uri);
    // console.log(parsed)
    // remove trailing ':'
    if (parsed.protocol === null) {
      throw new Error(`Protocol in url "${uri}" must be valid`)
    }
    let scheme = parsed.protocol.slice(0, -1);
    console.debug("[core/helpers]",`Helpers found scheme '${scheme}'`);
    return scheme;
  }

  public static setStaticAddress(address: string) {
    Helpers.staticAddress = address;
  }

  public static getAddresses(): Array<string> {
    let addresses: Array<any> = [];

    if (Helpers.staticAddress!==undefined) {
      addresses.push(Helpers.staticAddress);
      
      console.debug("[core/helpers]",`AddressHelper uses static ${addresses}`);
      return addresses;
    } else {

      let interfaces = os.networkInterfaces();

      for (let iface in interfaces) {
        interfaces[iface].forEach((entry: any) => {
          console.debug("[core/helpers]",`AddressHelper found ${entry.address}`);
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

      console.debug("[core/helpers]",`AddressHelper identified ${addresses}`);

      return addresses;
    }
  }

  public static toUriLiteral(address: string): string {

    // Due to crash logged with:
    // TypeError: Cannot read property 'indexOf' of undefined at Function.Helpers.toUriLiteral 
    if (!address) {
      console.error("[core/helpers]",`AddressHelper received invalid address '${address}'`);
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

  //TODO: specialize fetch to retrieve just thing descriptions
  public fetch(uri: string): Promise<any> {
    return new Promise<object>((resolve, reject) => {
        let client = this.srv.getClientFor(Helpers.extractScheme(uri));
      console.debug("[core/helpers]",`WoTImpl fetching TD from '${uri}' with ${client}`);
        client.readResource(new TD.Form(uri, ContentSerdes.TD))
            .then(async (content) => {
                client.stop();

                if (content.type !== ContentSerdes.TD &&
                  content.type !== ContentSerdes.JSON_LD ) {
                  console.warn("[core/helpers]",`WoTImpl received TD with media type '${content.type}' from ${uri}`);
                }

                let td = (await ProtocolHelpers.readStreamFully(content.body)).toString('utf-8')

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

  public static async parseInteractionOutput(response: WoT.InteractionOutput) {
    let value = undefined;
    try {
      value = await response.value();
    } catch (err) {
      // TODO if response.value() fails, try low-level stream read
      console.error("[core/helpers]", "parseInteractionOutput low-level stream not implemented");
    }
    return value;
  }

  /**
   * Helper function to remove reserved keywords in required property of TD JSON Schema
   */
  static validateThingDescription(td: any) {
    if(td.required !== undefined) {
        let reservedKeywords: Array<string> = [ 
            "title", "@context", "instance", "forms", "security", "href", "securityDefinitions"
        ]
        if (Array.isArray(td.required)) {
            let reqProps: Array<string> =td.required;
            td.required = reqProps.filter(n => !reservedKeywords.includes(n))
        } else if (typeof td.required === "string") {
            if(reservedKeywords.indexOf(td.required) !== -1)
                delete td.required
        }
    }

    if(td.definitions !== undefined){
        for (let prop in td.definitions) {  
            this.validateThingDescription(td.definitions[prop])
        }
    }

    return td
  }

  /**
   * Helper function to validate an ExposedThingInit
   */
  public static validateExposedThingInit(data : any) {
    const td = JSON.parse(JSON.stringify(tdSchema));

    if(data["@type"] !== undefined && data["@type"] == "tm:ThingModel") {
      return {
        valid: false,
        errors: "ThingModel declaration is not supported"
      };
    }

    let exposeThingInitSchema = Helpers.validateThingDescription(td);
    const validate = ajv.compile(exposeThingInitSchema);
    const isValid = validate(data);
    let errors = undefined;
    if(!isValid) {
      errors = validate.errors.map(o => o.message).join('\n');
    }
    return {
      valid: isValid,
      errors: errors
    };
  }
}
