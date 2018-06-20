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

import Thing from './thing-description';
import * as TD from './thing-description';

/** Parses a TD into a Thing object */
export function parseTD(td: string, normalize?: boolean): Thing {
  console.debug(`parseTD() parsing\n\`\`\`\n${td}\n\`\`\``);

  let thing: Thing = JSON.parse(td);

  // apply defaults as per WoT Thing Description spec

  if (thing["@context"] === undefined) {
    thing["@context"] = TD.DEFAULT_HTTPS_CONTEXT;
  } else if (Array.isArray(thing["@context"])) {
    let semContext: Array<string> = thing["@context"];
    if ( (semContext.indexOf(TD.DEFAULT_HTTPS_CONTEXT) === -1) &&
         (semContext.indexOf(TD.DEFAULT_HTTP_CONTEXT) === -1) ) {
      // insert last
      semContext.push(TD.DEFAULT_HTTPS_CONTEXT);
    }
  }

  if (thing["@type"] === undefined) {
    thing["@type"] = "Thing";
  } else if (Array.isArray(thing["@type"])) {
    let semTypes: Array<string> = thing["@type"];
    if (semTypes.indexOf("Thing") === -1) {
      // insert first
      semTypes.unshift("Thing");
    }
  }

  if (thing.properties !== undefined && thing.properties instanceof Object) {
    for (let propName in thing.properties) {
      let prop: WoT.PropertyFragment = thing.properties[propName];
      if (prop.writable === undefined || typeof prop.writable !== "boolean") {
        prop.writable = false;
      }
      if (prop.observable == undefined || typeof prop.writable !== "boolean") {
        prop.observable = false;
      }
    }
  }

  // avoid errors due to 'undefined'
  if (typeof thing.properties !== 'object' || thing.properties === null) {
    thing.properties = {};
  }
  if (typeof thing.actions !== 'object' || thing.actions === null) {
    thing.actions = {};
  }
  if (typeof thing.events !== 'object' || thing.events === null) {
    thing.events = {};
  }

  if (thing.security === undefined) {
    console.warn(`parseTD() found no security metadata`);
  }

  if (normalize) {
    console.log(`parseTD() normalizing 'base' into 'forms'`);
    // TODO normalize normalize each Interaction link
  }

  return thing;
}

/** Serializes a Thing object into a TD */
export function serializeTD(thing: Thing): string {

  let td: string = JSON.stringify(thing);

  // TODO clean-ups

  console.debug(`serializeTD() produced\n\`\`\`\n${td}\n\`\`\``);

  return td;
}
