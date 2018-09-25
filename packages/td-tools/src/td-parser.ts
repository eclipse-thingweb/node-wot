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

import Thing from "./thing-description";
import * as TD from "./thing-description";

const isAbsoluteUrl = require('is-absolute-url');

/** Parses a TD into a Thing object */
export function parseTD(td: string, normalize?: boolean): Thing {
  console.debug(`parseTD() parsing\n\`\`\`\n${td}\n\`\`\``);

  let thing: Thing = JSON.parse(td);

  // apply defaults as per WoT Thing Description spec

  if (thing["@context"] === undefined) {
    thing["@context"] = TD.DEFAULT_HTTP_CONTEXT;
  } else if (Array.isArray(thing["@context"])) {
    let semContext: Array<string> = thing["@context"];
    if ((semContext.indexOf(TD.DEFAULT_HTTPS_CONTEXT) === -1) &&
      (semContext.indexOf(TD.DEFAULT_HTTP_CONTEXT) === -1) &&
      // keep compatibility for "old" context URI for now
      (semContext.indexOf("http://w3c.github.io/wot/w3c-wot-td-context.jsonld") === -1) &&
      (semContext.indexOf("https://w3c.github.io/wot/w3c-wot-td-context.jsonld") === -1)
    ) {
      // insert last
      semContext.push(TD.DEFAULT_HTTP_CONTEXT);
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

  // collect all forms for normalization and use iterations also for checking
  let allForms: WoT.Form[] = [];
  let interactionPatterns: any = {
    properties: "Property",
    actions: "Action",
    events: "Event"
  }
  for (let pattern in interactionPatterns) {
    for (let interaction in thing[pattern]) {
      // ensure forms mandatory forms field
      if (!thing[pattern][interaction].hasOwnProperty("forms")) throw new Error(`${interactionPatterns[pattern]} '${interaction}' has no forms field`);
      // ensure array structure internally
      if (!Array.isArray(thing[pattern][interaction].forms)) thing[pattern][interaction].forms = [thing[pattern][interaction].forms];
      for (let form of thing[pattern][interaction].forms) {
        // ensure mandatory href field
        if (!form.hasOwnProperty("href")) throw new Error(`Form of ${interactionPatterns[pattern]} '${interaction}' has no href field`);
        // check if base field required
        if (!isAbsoluteUrl(form.href) && !thing.hasOwnProperty("base")) throw new Error(`Form of ${interactionPatterns[pattern]} '${interaction}' has relative URI while TD has no base field`);
        // add
        allForms.push(form);
      }
    }
  }

  if (thing.hasOwnProperty("base")) {
    if (normalize === undefined || normalize === true) {
      console.log(`parseTD() normalizing 'base' into 'forms'`);

      const url = require('url');
      /* url modul works only for http --> so replace URI scheme with
        http and after resolving replace again replace with original scheme */
      let n: number = thing.base.indexOf(':');
      let scheme: string = thing.base.substr(0, n + 1); // save origin protocol
      let base: string = thing.base.replace(scheme, 'http:'); // replace protocol

      for (let form of allForms) {
        if (!form.href.match(/^([a-z0-9\+-\.]+\:).+/i)) {
          console.debug(`parseTDString() applying base '${thing.base}' to '${form.href}'`);

          let href: string = url.resolve(base, form.href) // URL resolving
          href = href.replace('http:', scheme); // replace protocol back to origin
          form.href = href;
        }
      }
    }
  }

  return thing;
}

/** Serializes a Thing object into a TD */
export function serializeTD(thing: Thing): string {

  // clean-ups
  if (!thing.security || thing.security.length===0) {
    thing.security = [{ scheme: "nosec" }];
  }

  let td: string = JSON.stringify(thing);

  console.debug(`serializeTD() produced\n\`\`\`\n${td}\n\`\`\``);

  return td;
}
