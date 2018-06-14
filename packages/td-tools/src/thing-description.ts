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

// global W3C WoT Scripting API definitions
import WoT, { WoTFactory } from "wot-typescript-definitions";

export const DEFAULT_HTTP_CONTEXT: string = "http://w3c.github.io/wot/w3c-wot-td-context.jsonld";
export const DEFAULT_HTTPS_CONTEXT: string = "https://w3c.github.io/wot/w3c-wot-td-context.jsonld";
export const DEFAULT_THING_TYPE: string = "Thing";

/* TODOs / Questions
 ~ In Thing index structure could be read-only (sanitizing needs write access)
*/

/**
 * node-wot definition for instantiated Thing Descriptions (Things)
 */
export default class Thing implements WoT.Thing {
  /** collection of string-based keys that reference values of any type */
  [key: string]: any; /* e.g., @context besides the one that are explitecly defined below */
  id: string;
  name: string;
  description: string;
  base?: string;

  /** collection of string-based keys that reference a property of type Property2 */
  // properties: Map<string, WoT.ThingProperty>;
  properties: {
    [key: string]: WoT.ThingProperty
  };

  /** collection of string-based keys that reference a property of type Action2 */
  actions: {
    [key: string]: WoT.ThingAction;
  }

  /** collection of string-based keys that reference a property of type Event2 */
  events: {
    [key: string]: WoT.ThingEvent;
  }
  security: Security;

  /** Web links to other Things or metadata */
  links: Array<WoT.WebLink>;

  constructor() {
    this["@context"] = DEFAULT_HTTPS_CONTEXT;
    this["@type"] = DEFAULT_THING_TYPE;
    this.properties = {};
    this.actions = {};
    this.events = {};
    this.link = []
  }
}

/**
 * node-wot definition for Interactions
 */
export class Interaction implements WoT.Interaction {
  label: string;
  forms: Array<WoT.Form>;
  links: Array<WoT.Link>;
}




/**
 * node-wot definition for form / binding metadata
 */
export class Form implements WoT.Form {
  href: string;
  mediaType?: string;
  rel?: string;
  security?: WoT.Security;

  constructor(href?: string, mediaType?: string) {
    if (href) this.href = href;
    if (mediaType) this.mediaType = mediaType;
  }
}


/**
 * node-wot definition for security metadata
 */
export class Security implements WoT.Security {
  scheme: string;
  in?: string;
}
