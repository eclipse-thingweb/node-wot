/********************************************************************************
 * Copyright (c) 2018 - 2021 Contributors to the Eclipse Foundation
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
import * as TDT from "wot-thing-description-types";

export const DEFAULT_CONTEXT = "https://www.w3.org/2019/wot/td/v1";
export const DEFAULT_CONTEXT_LANGUAGE = "en";
export const DEFAULT_THING_TYPE = "Thing";

/** Implements the Thing Description as software object */
export default class Thing implements TDT.ThingDescription {
    title: TDT.Title;
    securityDefinitions: {
        [k: string]: TDT.SecurityScheme;
    };
    security: string | [string, ...string[]];

    "@context": TDT.ThingContext;

    [key: string]: any;

    constructor() {
        this["@context"] = DEFAULT_CONTEXT;
        this["@type"] = DEFAULT_THING_TYPE;
        this.security = "";
        this.properties = {};
        this.actions = {};
        this.events = {};
        this.links = [];
    }
}

/** Basis from implementing the Thing Interaction descriptions for Property, Action, and Event */
export interface ThingInteraction {
    title?: TDT.Title;
    titles?: TDT.Titles;
    description?: TDT.Description;
    descriptions?: TDT.Descriptions;
    scopes?: Array<string>;
    uriVariables?: {
        [key: string]: DataSchema;
    };
    security?: Array<string>;
    forms?: Array<Form>;

    [key: string]: any;
}

export interface ExpectedResponse {
    contentType?: string;
}

/** Implements the Interaction Form description */
// Note: JSON schema definition at https://github.com/w3c/wot-thing-description/blob/main/validation/td-json-schema-validation.json
// uses different kinds of forms: FormElementRoot, FormElementProperty, ...
export interface Form {
    href: string;
    subprotocol?: string;
    op?: string | Array<string>;
    contentType?: string; // media type + parameter(s), e.g., text/plain;charset=utf8
    security?: Array<string>; // Set of security definition names, chosen from those defined in securityDefinitions  // Security;
    scopes?: Array<string>;
    response?: ExpectedResponse;
}
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

export type DataSchema = WoT.DataSchema &
    (BooleanSchema | IntegerSchema | NumberSchema | StringSchema | ObjectSchema | ArraySchema | NullSchema);

export class BaseSchema {
    type?: string;
    title?: TDT.Title;
    titles?: TDT.Titles;
    description?: TDT.Description;
    descriptions?: TDT.Descriptions;
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

// TODO these security types should come from "wot-thing-description-types"

export interface SecurityScheme {
    scheme: string;
    description?: string;
    proxy?: string;
}

export interface APIKeySecurityScheme {
    "@type"?: TDT.TypeDeclaration;
    description?: TDT.Description;
    descriptions?: TDT.Descriptions;
    proxy?: TDT.AnyUri;
    scheme: "apikey";
    in?: "header" | "query" | "body" | "cookie";
    name?: string;
    [k: string]: unknown;
}

export interface OAuth2SecurityScheme {
    "@type"?: TDT.TypeDeclaration;
    description?: TDT.Description;
    descriptions?: TDT.Descriptions;
    proxy?: TDT.AnyUri;
    scheme: "oauth2";
    authorization?: TDT.AnyUri;
    token?: TDT.AnyUri;
    refresh?: TDT.AnyUri;
    scopes?: string[] | string;
    flow?: string; // "code"; // TODO other flows?
    [k: string]: unknown;
}

/*
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
*/

/** Implements the Thing Property description */
export abstract class ThingProperty extends BaseSchema implements ThingInteraction {
    // writable: boolean;
    observable?: boolean;
    type?: string;

    // ThingInteraction
    forms?: Array<Form>;
    title?: TDT.Title;
    titles?: TDT.Titles;
    description?: TDT.Description;
    descriptions?: TDT.Descriptions;
    scopes?: Array<string>;
    uriVariables?: {
        [key: string]: DataSchema;
    };

    security?: Array<string>;

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
    title?: TDT.Title;
    titles?: TDT.Titles;
    description?: TDT.Description;
    descriptions?: TDT.Descriptions;
    scopes?: Array<string>;
    uriVariables?: {
        [key: string]: DataSchema;
    };

    security?: Array<string>;

    [key: string]: any;
}
/** Implements the Thing Event description */
export abstract class ThingEvent implements ThingInteraction {
    subscription?: DataSchema;
    data?: DataSchema;
    cancellation?: DataSchema;

    // ThingInteraction
    forms?: Array<Form>;
    title?: TDT.Title;
    titles?: TDT.Titles;
    description?: TDT.Description;
    descriptions?: TDT.Descriptions;
    scopes?: Array<string>;
    uriVariables?: {
        [key: string]: DataSchema;
    };

    security?: Array<string>;

    [key: string]: any;
}
