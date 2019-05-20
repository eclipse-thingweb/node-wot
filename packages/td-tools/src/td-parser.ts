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

import Thing from "./thing-description";
import * as TD from "./thing-description";

const isAbsoluteUrl = require('is-absolute-url');
let URLToolkit = require('url-toolkit');

/** Parses a TD into a Thing object */
export function parseTD(td: string, normalize?: boolean): Thing {
  console.debug(`parseTD() parsing\n\`\`\`\n${td}\n\`\`\``);

  let thing: Thing = JSON.parse(td);

  // apply defaults as per WoT Thing Description spec

  if (thing["@context"] === undefined) {
    thing["@context"] = TD.DEFAULT_CONTEXT;
  } else if (Array.isArray(thing["@context"])) {
    let semContext: Array<string> = thing["@context"];
    if (semContext.indexOf(TD.DEFAULT_CONTEXT) === -1) {
      // insert last
      semContext.push(TD.DEFAULT_CONTEXT);
    }
  } else if (thing["@context"] !== TD.DEFAULT_CONTEXT) {
    let semContext: string | any = thing["@context"];
    thing["@context"] = [semContext, TD.DEFAULT_CONTEXT];
  }

  if (thing["@type"] === undefined) {
    thing["@type"] = TD.DEFAULT_THING_TYPE;
  } else if (Array.isArray(thing["@type"])) {
    let semTypes: Array<string> = thing["@type"];
    if (semTypes.indexOf(TD.DEFAULT_THING_TYPE) === -1) {
      // insert first
      semTypes.unshift(TD.DEFAULT_THING_TYPE);
    }
  } else if (thing["@type"] !== TD.DEFAULT_THING_TYPE) {
    let semType: string = thing["@type"];
    thing["@type"] = [TD.DEFAULT_THING_TYPE, semType];
  }

  if (thing.properties !== undefined && thing.properties instanceof Object) {
    for (let propName in thing.properties) {
      let prop: WoT.PropertyFragment = thing.properties[propName];
      if (prop.readOnly === undefined || typeof prop.readOnly !== "boolean") {
        prop.readOnly = false;
      }
      if (prop.writeOnly === undefined || typeof prop.writeOnly !== "boolean") {
        prop.writeOnly = false;
      }
      if (prop.observable == undefined || typeof prop.observable !== "boolean") {
        prop.observable = false;
      }
    }
  }
  
  if (thing.actions !== undefined && thing.actions instanceof Object) {
    for (let actName in thing.actions) {
      let act: WoT.ActionFragment = thing.actions[actName];
      if (act.safe === undefined || typeof act.safe !== "boolean") {
        act.safe = false;
      }
      if (act.idempotent === undefined || typeof act.idempotent !== "boolean") {
        act.idempotent = false;
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

      for (let form of allForms) {
        if (!form.href.match(/^([a-z0-9\+-\.]+\:).+/i)) {
          console.debug(`parseTDString() applying base '${thing.base}' to '${form.href}'`);
          form.href = URLToolkit.buildAbsoluteURL(thing.base, form.href);
        }
      }
    }
  }

  return thing;
}

/** Serializes a Thing object into a TD */
export function serializeTD(thing: Thing): string {

  let copy: any = JSON.parse(JSON.stringify(thing));

  // clean-ups
  if (!copy.security || copy.security.length === 0) {
    copy.securityDefinitions = {
      "nosec_sc": { "scheme": "nosec" }
    };
    copy.security = ["nosec_sc"];
  }

  if (copy.forms && copy.forms.length === 0) {
    delete copy.forms;
  }

  if (copy.properties && Object.keys(copy.properties).length === 0) {
    delete copy.properties;
  } else if(copy.properties) {
    // add mandatory fields (if missing): observable, writeOnly, and readOnly
    for (let propName in copy.properties) {
      let prop = copy.properties[propName];
      if (prop.readOnly === undefined || typeof prop.readOnly !== "boolean") {
        prop.readOnly = false;
      }
      if (prop.writeOnly === undefined || typeof prop.writeOnly !== "boolean") {
        prop.writeOnly = false;
      }
      if (prop.observable == undefined || typeof prop.observable !== "boolean") {
        prop.observable = false;
      }
    }
  }

  if (copy.actions && Object.keys(copy.actions).length === 0) {
    delete copy.actions;
  } else if (copy.actions) {
    // add mandatory fields (if missing): idempotent and safe
    for (let actName in copy.actions) {
      let act = copy.actions[actName];
      if (act.idempotent === undefined || typeof act.idempotent !== "boolean") {
        act.idempotent = false;
      }
      if (act.safe === undefined || typeof act.safe !== "boolean") {
        act.safe = false;
      }
    }
  }
  if (copy.events && Object.keys(copy.events).length === 0) {
    delete copy.events;
  }

  if (copy.links && copy.links.length === 0) {
    delete copy.links;
  }

  let td: string = JSON.stringify(copy);

  console.debug(`serializeTD() produced\n\`\`\`\n${td}\n\`\`\``);

  return td;
}
