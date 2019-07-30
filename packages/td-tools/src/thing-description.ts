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

import { Subscription } from 'rxjs/Subscription'; // XXX remove after subscribe() in ThingProperty is removed


export const DEFAULT_CONTEXT: string = "https://www.w3.org/2019/wot/td/v1";
export const DEFAULT_CONTEXT_LANGUAGE: string = "en";
export const DEFAULT_THING_TYPE: string = "Thing";

/* TODOs / Questions
 ~ In Thing index structure could be read-only (sanitizing needs write access)
*/

export declare type MultiLanguage = any; // object?

/** Implements the Thing Description as software object */
export default class Thing
//  implements ThingFragment 
 {
  id: string;
  title: string;
  titles: MultiLanguage;
  description: string;
  descriptions: MultiLanguage;
  support: string;
  modified: string;
  created: string;
  version: VersionInfo;
  securityDefinitions: {
    [key: string]: SecurityScheme;
  };
  security: Array<String>;
  base: string;

  properties: {
    [key: string]: ThingProperty;
  };
  actions: {
    [key: string]: ThingAction;
  }
  events: {
    [key: string]: ThingEvent;
  }
  links: Array<Link>;
  forms: Array<Form>;

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
export interface ThingInteraction
//  extends InteractionFragment
 {
  title?: string;
  titles?: MultiLanguage;
  description?: string;
  descriptions?: MultiLanguage;
  scopes?: Array<string>;
  uriVariables?: {
    [key: string]: DataSchema;
  }
  security?: Array<string>;
  forms?: Array<Form>;

  [key: string]: any;  
}

// /** Implements the Thing Security definitions */
// export class Security implements SecurityScheme {
//   scheme: string;
//   description: string;
//   proxyURI?: string;
// }

export class ExpectedResponse implements ExpectedResponse {
  contentType?: string;
}

/** Implements the Interaction Form description */
export class Form implements Form {
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


// INTERFACES

// /**
//  * The ThingFragment dictionary contains fields to initialize a Thing or to match during discovery
//  */
// export interface ThingFragment {
//   /** A hint to gernerate the identifier for the Thing */
//   id?: string;
//   /** The title attribute represents the user given name of the Thing */
//   title?: string;
//   /** Define the base URI that is valid for all defined local interaction resources */
//   base?: string;
//   /** A human-readable description of the Thing */
//   description?: string;
//   /** Human-readable descriptions in different languages */
//   descriptions?: MultiLanguage;
//   /** Information about the Thing maintainer, e.g., author or contact URI */
//   support?: string;
//   /** Provides information when the TD instance was last modified */
//   lastModified?: string;
//   /** Provides information when the TD instance was created */
//   created?: string;
//   /** Provides version information */
//   version?: VersionInfo;

//   /** Set of named security configurations (definitions only). Not actually applied unless names are used in a security section */
//   securityDefinitions?: { [key: string]: Security }
//   /** Set of security definition names, chosen from those defined in securityDefinitions.  */
//   security?: Array<String>;

//   /** A map of PropertyFragments with decriptions only */
//   properties?: { [key: string]: PropertyFragment }
//   /** A map of ActionFragments with decriptions only */
//   actions?: { [key: string]: ActionFragment }
//   /** A map of EventFragments with decriptions only */
//   events?: { [key: string]: EventFragment }
//   /** A list of Web links to other Things or metadata */
//   links?: Array<Link>;
//   /** Indicates one or more endpoints at which operation(s) on this resource are accessible */
//   forms?: Array<Form>;
//   /**
//    * A collection of predicate terms that reference values of any type,
//    * e.g., @context, @type, or other terms from the vocabulary defined in @context.
//    */
//   [key: string]: any;
// }

/** Carries version information about the TD instance. If required, additional version information such as firmware and hardware version (term definitions outside of the TD namespace) can be extended here. */
export interface VersionInfo {
  instance?: string;
}

export interface Link {
  href: string;
  rel?: string | Array<string>;
  type?: string; // media type hint, no media type parameters
  anchor?: string;
}

export interface ExpectedResponse {
  contentType?: string;
}

export interface Form {
  href: string;
  subprotocol?: string;
  op?: string | Array<string>;
  contentType?: string; // media type + parameter(s), e.g., text/plain;charset=utf8
  security?: Array<string>; // Set of security definition names, chosen from those defined in securityDefinitions  // Security;
  scopes?: Array<string>;
  response?: ExpectedResponse;
}

// export interface InteractionFragment {
//   /** A human-readable title for the Interaction, e.g., for UIs */
//   title?: string;
//   /** Human-readable titles for the Interaction, in different languages */
//   titles?: MultiLanguage;
//   /** A human-readable description of the Interaction */
//   description?: string;
//   /** Human-readable descriptions in different languages */
//   descriptions?: MultiLanguage;
//   /** Set of authorization scope identifiers */
//   scopes?: Array<string>;
//   /** URI template variables */
//   uriVariables?: { [key: string]: DataSchema };
//   /** Set of security definition names */
//   security?: Array<string>;

//   /**
//    * A collection of predicate terms that reference values of any type,
//    * e.g., @type, or other terms from the vocabulary defined in @context.
//    */
//   [key: string]: any;
// }

export type DataSchema = BooleanSchema | IntegerSchema | NumberSchema | StringSchema | ObjectSchema | ArraySchema | NullSchema;

export class BaseSchema {
  type?: string;
  title?: string;
  titles?: MultiLanguage;
  description?: string;
  descriptions?: MultiLanguage;
  writeOnly?: boolean;
  readOnly?: boolean;
  oneOf?: Array<DataSchema>;
  unit?: string;
  const?: any;
  enum?: Array<any>;
}

export interface BooleanSchema extends BaseSchema {
  type: "boolean";
}

export interface IntegerSchema extends BaseSchema {
  type: "integer";
  minimum?: number;
  maximum?: number;
}

export interface NumberSchema extends BaseSchema {
  type: "number";
  minimum?: number;
  maximum?: number;
}

export interface StringSchema extends BaseSchema {
  type: "string";
}

export interface ObjectSchema extends BaseSchema {
  type: "object";
  properties: { [key: string]: DataSchema };
  required?: Array<string>;
}

export interface ArraySchema extends BaseSchema {
  type: "array";
  items: DataSchema;
  minItems?: number;
  maxItems?: number;
}

export interface NullSchema extends BaseSchema {
  type: "null";
}

// export interface ThingInteraction
// // extends InteractionFragment
// {
//   forms: Array<Form>;

//   // XXX
//   title: string;
//   titles: MultiLanguage;
//   description: string;
//   descriptions: MultiLanguage;
//   scopes: Array<string>;
//   uriVariables: {
//     [key: string]: DataSchema;
//   }
//   security: Array<string>;
//   // forms: Array<Form>;

//   // [key: string]: any;
// }

// export class PropertyFragment extends BaseSchema implements InteractionFragment {
//   observable?: boolean;
// }

// export interface ActionFragment extends InteractionFragment {
//   input?: DataSchema;
//   output?: DataSchema;
//   safe?: boolean;
//   idempotent?: boolean;
// }

// export interface EventFragment extends InteractionFragment {
//   subscription?: DataSchema;
//   data?: DataSchema;
//   cancellation?: DataSchema;
// }

// export interface ThingProperty extends ThingInteraction, PropertyFragment //, Observable<any>
// {
//   read(options?: any): Promise<any>;
//   write(value: any, options?: any): Promise<void>;
//   // subscribe(next?: (value: any) => void, error?: (error: any) => void, complete?: () => void): Subscription;
// }

// export interface ThingAction extends ThingInteraction, ActionFragment {
//   invoke(parameter?: any, options?: any): Promise<any>;
// }

// export interface ThingEvent extends ThingInteraction, EventFragment {
//   // subscribe(next?: (data: any) => void, error?: (error: any) => void, complete?: () => void): Subscription;
//   // FIXME emit should be only on ExposedThings' ThingEvents - therefore move emit() to ExposedThing?
//   emit?(data?: any): void;
// }


export type SecurityType = NoSecurityScheme | BasicSecurityScheme | DigestSecurityScheme | BearerSecurityScheme | CertSecurityScheme | PoPSecurityScheme | APIKeySecurityScheme | OAuth2SecurityScheme | PSKSecurityScheme | PublicSecurityScheme;


export interface SecurityScheme {
  scheme: string;
  description?: string;
  proxy?: string;
}

export interface NoSecurityScheme extends SecurityScheme {
  scheme: "nosec";
}

export interface BasicSecurityScheme extends SecurityScheme {
  scheme: "basic";
  in?: string;
  name?: string;
}

export interface DigestSecurityScheme extends SecurityScheme {
  scheme: "digest";
  name?: string;
  in?: string;
  qop?: string;
}

export interface APIKeySecurityScheme extends SecurityScheme {
  scheme: "apikey";
  in?: string;
  name?: string;
}

export interface BearerSecurityScheme extends SecurityScheme {
  scheme: "bearer";
  in?: string;
  alg?: string;
  format?: string;
  name?: string;
  authorization?: string;
}

export interface CertSecurityScheme extends SecurityScheme {
  scheme: "cert";
  identity?: string;
}

export interface PSKSecurityScheme extends SecurityScheme {
  scheme: "psk";
  identity?: string;
}

export interface PublicSecurityScheme extends SecurityScheme {
  scheme: "public";
  identity?: string;
}

export interface PoPSecurityScheme extends SecurityScheme {
  scheme: "pop";
  format?: string;
  authorization?: string;
  alg?: string;
  name?: string;
  in?: string;
}

export interface OAuth2SecurityScheme extends SecurityScheme {
  scheme: "oauth2";
  authorization?: string;
  flow?: string; // one of implicit, password, client, or code
  token?: string;
  refresh?: string;
  scopes?: Array<string>;
}


/** Implements the Thing Property description */
export abstract class ThingProperty extends BaseSchema
// , PropertyFragment
implements  ThingInteraction

{
  // writable: boolean;
  observable?: boolean;
  type?: string;


  // ThingInteraction
  forms?: Array<Form>;
  title?: string;
  titles?: MultiLanguage;
  description?: string;
  descriptions?: MultiLanguage;
  scopes?: Array<string>;
  uriVariables?: {
    [key: string]: DataSchema;
  }
  security?: Array<string>;

  [key: string]: any;


  
  // // XXX remove
  // abstract read(options?: any): Promise<any>;
  // abstract write(value: any, options?: any): Promise<void>;
  // abstract subscribe(next?: (value: any) => void, error?: (error: any) => void, complete?: () => void): Subscription;
}
/** Implements the Thing Action description */
export abstract class ThingAction
//  extends ActionFragment  
 implements ThingInteraction {
  input?: DataSchema;
  output?: DataSchema;
  safe?: boolean;
  idempotent?: boolean;

    // ThingInteraction
    forms?: Array<Form>;
    title?: string;
    titles?: MultiLanguage;
    description?: string;
    descriptions?: MultiLanguage;
    scopes?: Array<string>;
    uriVariables?: {
      [key: string]: DataSchema;
    }
    security?: Array<string>;
    
    [key: string]: any;

  // // XXX remove
  // abstract invoke(parameter?: any, options?: any): Promise<any>;
}
/** Implements the Thing Action description */
export abstract class ThingEvent
// extends EventFragment 
implements ThingInteraction {
  subscription?: DataSchema;
  data?: DataSchema;
  cancellation?: DataSchema;

    // ThingInteraction
    forms?: Array<Form>;
    title?: string;
    titles?: MultiLanguage;
    description?: string;
    descriptions?: MultiLanguage;
    scopes?: Array<string>;
    uriVariables?: {
      [key: string]: DataSchema;
    }
    security?: Array<string>;
    
    [key: string]: any;
}
