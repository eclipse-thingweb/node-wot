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

// Ignored because of circular definitions
/* eslint-disable no-use-before-define */

// global W3C WoT Scripting API definitions
import * as WoT from "wot-typescript-definitions";

export const DEFAULT_CONTEXT = "https://www.w3.org/2019/wot/td/v1";
export const DEFAULT_CONTEXT_LANGUAGE = "en";
export const DEFAULT_THING_TYPE = "Thing";

/* TODOs / Questions
 ~ In Thing index structure could be read-only (sanitizing needs write access)
*/

export declare type MultiLanguage = Record<string, unknown>; // object?

/** Implements the Thing Description as software object */
export default class Thing {
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
        [key: string]: SecurityType;
    };

    security: Array<string>;
    base: string;

    properties: {
        [key: string]: ThingProperty;
    };

    actions: {
        [key: string]: ThingAction;
    };

    events: {
        [key: string]: ThingEvent;
    };

    links: Array<Link>;
    forms: Array<Form>;

    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
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
export interface ThingInteraction {
    title?: string;
    titles?: MultiLanguage;
    description?: string;
    descriptions?: MultiLanguage;
    scopes?: Array<string>;
    uriVariables?: {
        [key: string]: DataSchema;
    };
    security?: Array<string>;
    forms?: Array<Form>;

    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    [key: string]: any;
}

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

export type DataSchema = WoT.DataSchema &
    (BooleanSchema | IntegerSchema | NumberSchema | StringSchema | ObjectSchema | ArraySchema | NullSchema);

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
    const?: unknown;
    enum?: Array<unknown>;
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

export type SecurityType =
    | NoSecurityScheme
    | BasicSecurityScheme
    | DigestSecurityScheme
    | BearerSecurityScheme
    | CertSecurityScheme
    | PoPSecurityScheme
    | APIKeySecurityScheme
    | OAuth2SecurityScheme
    | PSKSecurityScheme
    | PublicSecurityScheme;

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
export abstract class ThingProperty extends BaseSchema implements ThingInteraction {
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
    };

    security?: Array<string>;

    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    [key: string]: any;
}

/** Implements the Thing Action description */
export abstract class ThingAction implements ThingInteraction {
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
    };

    security?: Array<string>;

    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    [key: string]: any;
}
/** Implements the Thing Event description */
export abstract class ThingEvent implements ThingInteraction {
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
    };

    security?: Array<string>;

    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    [key: string]: any;
}
