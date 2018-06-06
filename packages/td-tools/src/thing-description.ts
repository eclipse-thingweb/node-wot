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
import WoT from "wot-typescript-definitions";

import "reflect-metadata";

/** Internet Media Types */
/*export enum MediaType {
    JSON = <any>"application/json",
    XML = <any>"application/xml",
    EXI = <any>"application/exi"

} */

export const DEFAULT_HTTP_CONTEXT : string = "http://w3c.github.io/wot/w3c-wot-td-context.jsonld" ;
export const DEFAULT_HTTPS_CONTEXT : string = "https://w3c.github.io/wot/w3c-wot-td-context.jsonld";
export const DEFAULT_THING_TYPE : string = "Thing";

/** Interaction pattern */
export enum InteractionPattern {
  Property = 'Property' as any,
  Action = 'Action' as any,
  Event = 'Event' as any
}

/**
 * node-wot definition for security metadata
 */
export class ThingSecurity {
  public mode: string;

  public proxy: string;
}

/**
 * node-wot definition for form / binding metadata
 */
export class InteractionForm {

  /** relativ or absulut URI path of the Interaction resource */
  public href: string;

  /** used mediaType of the interacion resources */
  public mediaType?: string;

  constructor(href?: string, mediaType?: string) {
    if (href) this.href = href;
    if (mediaType) this.mediaType = mediaType;
  }
}

/**
 * node-wot definition for Interactions
 */
export class Interaction {
  /** @ type information of the Interaction */
  public semanticType: Array<WoT.SemanticType>;

  public metadata: Array<WoT.SemanticMetadata>;

  /** name/identifier of the Interaction */
  public name: string;

  /** type of the Interaction (action, property, event) */
  public pattern: InteractionPattern;

  /** form information of the Interaction resources */
  public form: Array<InteractionForm>;

  /** writable flag for the Property */
  public writable: boolean;

  /** observable flag for the Property */
  public observable: boolean;

  /** Property/Event schema */
  public schema: any;
  /** Action input schema */
  public inputSchema: any;
  /** Action output schema */
  public outputSchema: any;

  constructor() {
    this.semanticType = []; // semanticType is subset of @type (without Pattern)
    this.metadata = [];
    this.form = [];
  }
}

export class PrefixedContext {
  public prefix: string;
  public context: string;

  constructor(prefix: string, context: string) {
    this.prefix = prefix;
    this.context = context;
  }
}

/**
 * node-wot definition for instantiated Thing Descriptions (Things)
 */
export default class Thing {

  /** @context information of the TD */
  public context: Array<string | object>;

  /** @ type information, usually 'Thing' */
  public semanticType: Array<WoT.SemanticType>;

  /** container for all custom metadata */
  public metadata: Array<WoT.SemanticMetadata>;

  /** human-readable name of the Thing */
  public name: string;

  /** unique identifier (a URI, includes URN) */
  public id: string;

  /** security metadata */
  public security: Array<object>;

  /** base URI of the Interaction resources */
  public base?: string;

  /** Interactions of this Thing */
  public interaction: Array<Interaction>;

  /** Web links to other Things or metadata */
  public link?: Array<any>;

  constructor() {
    this.context = [DEFAULT_HTTPS_CONTEXT];
    this.semanticType = []; // semanticType is subset of @type (without "Thing")
    this.metadata = [];
    this.interaction = [];
    this.link = []
  }
}
