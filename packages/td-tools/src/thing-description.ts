/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
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

export const DEFAULT_CONTEXT_V1 = "https://www.w3.org/2019/wot/td/v1";
export const DEFAULT_CONTEXT_V11 = "https://www.w3.org/2022/wot/td/v1.1";
export const DEFAULT_CONTEXT_LANGUAGE = "en";
export const DEFAULT_THING_TYPE = "Thing";

/** Implements the Thing Description as software object */
export default class Thing implements TDT.ThingDescription {
    title: TDT.Title;
    securityDefinitions: {
        [key: string]: TDT.SecurityScheme;
    };

    security: string | [string, ...string[]];

    "@context": TDT.ThingContext;

    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    [key: string]: any;

    constructor() {
        this["@context"] = [DEFAULT_CONTEXT_V1, DEFAULT_CONTEXT_V11];
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

    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    [key: string]: any;
}

/** Implements the Interaction Form description */
export class Form implements TDT.FormElementBase {
    op?: string | string[];
    href: TDT.AnyUri;
    contentType?: string;
    contentCoding?: string;
    subprotocol?: TDT.Subprotocol;
    security?: TDT.Security;
    scopes?: TDT.Scopes;
    response?: TDT.ExpectedResponse;
    additionalResponses?: TDT.AdditionalResponsesDefinition;
    [k: string]: unknown;

    constructor(href: string, contentType?: string) {
        this.href = href;
        if (contentType) this.contentType = contentType;
    }
}
export interface ExpectedResponse {
    contentType?: string;
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

// TODO AutoSecurityScheme
// TODO ComboSecurityScheme
export type SecurityType =
    | NoSecurityScheme
    | BasicSecurityScheme
    | DigestSecurityScheme
    | BearerSecurityScheme
    | APIKeySecurityScheme
    | OAuth2SecurityScheme
    | PSKSecurityScheme;

export interface SecurityScheme {
    scheme: string;
    description?: TDT.Description;
    descriptions?: TDT.Descriptions;
    proxy?: TDT.AnyUri;
    [k: string]: unknown;
}

export interface NoSecurityScheme extends SecurityScheme, TDT.NoSecurityScheme {
    scheme: "nosec";
}

export interface BasicSecurityScheme extends SecurityScheme, TDT.BasicSecurityScheme {
    scheme: "basic";
}

export interface DigestSecurityScheme extends SecurityScheme, TDT.DigestSecurityScheme {
    scheme: "digest";
}

export interface APIKeySecurityScheme extends SecurityScheme, TDT.ApiKeySecurityScheme {
    scheme: "apikey";
}

export interface BearerSecurityScheme extends SecurityScheme, TDT.BearerSecurityScheme {
    scheme: "bearer";
}

export interface PSKSecurityScheme extends SecurityScheme, TDT.PskSecurityScheme {
    scheme: "psk";
}

export interface OAuth2SecurityScheme extends SecurityScheme, TDT.OAuth2SecurityScheme {
    scheme: "oauth2";
}

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
    title?: TDT.Title;
    titles?: TDT.Titles;
    description?: TDT.Description;
    descriptions?: TDT.Descriptions;
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
    title?: TDT.Title;
    titles?: TDT.Titles;
    description?: TDT.Description;
    descriptions?: TDT.Descriptions;
    scopes?: Array<string>;
    uriVariables?: {
        [key: string]: DataSchema;
    };

    security?: Array<string>;

    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    [key: string]: any;
}
