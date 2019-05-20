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

// global W3C WoT Scripting API definitions
import * as WoT from "wot-typescript-definitions";

export const DEFAULT_CONTEXT: string = "https://www.w3.org/2019/wot/td/v1";
export const DEFAULT_THING_TYPE: string = "Thing";

/* TODOs / Questions
 ~ In Thing index structure could be read-only (sanitizing needs write access)
*/

export class VersionInfo implements WoT.VersionInfo {
  instance: string;
}

/** Implements the Thing Description as software object */
export default class Thing implements WoT.ThingFragment {
  id: string;
  title: string;
  titles: WoT.MultiLanguage;
  description: string;
  descriptions: WoT.MultiLanguage;
  support: string;
  modified: string;
  created: string;
  version: VersionInfo;
  securityDefinitions: {
    [key: string]: WoT.Security;
  };
  security: Array<String>;
  base: string;

  properties: {
    [key: string]: WoT.ThingProperty;
  };
  actions: {
    [key: string]: WoT.ThingAction;
  }
  events: {
    [key: string]: WoT.ThingEvent;
  }
  links: Array<WoT.Link>;
  forms: Array<WoT.Form>;

  [key: string]: any;

  constructor() {
    this["@context"] = DEFAULT_CONTEXT;
    this["@type"] = DEFAULT_THING_TYPE;
    this.security = [];
    this.properties = {};
    this.actions = {};
    this.events = {};
    this.links = [];
  }
}

/** Basis from implementing the Thing Interaction descriptions for Property, Action, and Event */
export abstract class ThingInteraction implements WoT.InteractionFragment {
  title: string;
  titles: WoT.MultiLanguage;
  description: string;
  descriptions: WoT.MultiLanguage;
  scopes: Array<string>;
  uriVariables: {
    [key: string]: WoT.DataSchema;
  }
  security: Array<string>;
  forms: Array<Form>;

  [key: string]: any;
}
/** Implements the Thing Property description */
export class ThingProperty extends ThingInteraction implements WoT.PropertyFragment, WoT.BaseSchema {
  // writable: boolean;
  observable: boolean;
  type: string;
}
/** Implements the Thing Action description */
export class ThingAction extends ThingInteraction implements WoT.ActionFragment {
  input: WoT.DataSchema;
  output: WoT.DataSchema;
  safe: boolean;
  idempotent: boolean;
}
/** Implements the Thing Action description */
export class ThingEvent extends ThingInteraction implements WoT.EventFragment {
  subscription: WoT.DataSchema;
  data: WoT.DataSchema;
  cancellation: WoT.DataSchema;
}

/** Implements the Thing Security definitions */
export class Security implements WoT.SecurityScheme {
  scheme: string;
  description: string;
  proxyURI?: string;
}

export class ExpectedResponse implements WoT.ExpectedResponse {
  contentType?: string;
}

/** Implements the Interaction Form description */
export class Form implements WoT.Form {
  href: string;
  subprotocol?: string;
  op?: string | Array<string>;
  contentType?: string;
  security?: Array<string>; // WoT.Security;
  scopes?: Array<string>;
  response?: ExpectedResponse;

  constructor(href: string, contentType?: string) {
    this.href = href;
    if (contentType) this.contentType = contentType;
  }
}
