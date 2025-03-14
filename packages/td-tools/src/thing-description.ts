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
import * as WoT from "wot-typescript-definitions";
import * as TDT from "wot-thing-description-types";

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export const DEFAULT_CONTEXT_V1 = "https://www.w3.org/2019/wot/td/v1";
/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export const DEFAULT_CONTEXT_V11 = "https://www.w3.org/2022/wot/td/v1.1";
/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export const DEFAULT_CONTEXT_LANGUAGE = "en";
/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export const DEFAULT_THING_TYPE = "Thing";

/** Implements the Thing Description as software object
 *
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export default class Thing implements TDT.ThingDescription {
    title: TDT.Title;
    securityDefinitions: {
        [key: string]: TDT.SecurityScheme;
    };

    security: string | [string, ...string[]];

    "@context": TDT.ThingContext;

    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    [key: string]: any;

    properties?: { [k: string]: TDT.PropertyElement } | undefined;

    actions?: { [k: string]: TDT.ActionElement } | undefined;

    events?: { [k: string]: TDT.EventElement } | undefined;

    constructor() {
        this["@context"] = [DEFAULT_CONTEXT_V1, DEFAULT_CONTEXT_V11];
        this["@type"] = DEFAULT_THING_TYPE;
        this.title = "";
        this.securityDefinitions = {};
        this.security = "";
        this.properties = {};
        this.actions = {};
        this.events = {};
        this.links = [];
    }
}

/** Basis from implementing the Thing Interaction descriptions for Property, Action, and Event
 *
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export type ThingInteraction = TDT.PropertyElement | TDT.ActionElement | TDT.EventElement;

/** Implements the Interaction Form description
 *
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export class Form implements TDT.FormElementBase {
    op?: string | string[];
    href: TDT.AnyUri;
    contentType: string;
    contentCoding?: string;
    subprotocol?: TDT.Subprotocol;
    security?: TDT.Security;
    scopes?: TDT.Scopes;
    response?: TDT.ExpectedResponse;
    additionalResponses?: TDT.AdditionalResponsesDefinition;
    [k: string]: unknown;

    constructor(href: string, contentType?: string) {
        this.href = href;
        this.contentType = contentType ?? "application/json";
    }
}
/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export interface ExpectedResponse {
    contentType?: string;
}

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export type DataSchema = WoT.DataSchema &
    (BooleanSchema | IntegerSchema | NumberSchema | StringSchema | ObjectSchema | ArraySchema | NullSchema);

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
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

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export interface BooleanSchema extends BaseSchema {
    type: "boolean";
}

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export interface IntegerSchema extends BaseSchema {
    type: "integer";
    minimum?: number;
    maximum?: number;
}

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export interface NumberSchema extends BaseSchema {
    type: "number";
    minimum?: number;
    maximum?: number;
}

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export interface StringSchema extends BaseSchema {
    type: "string";
}

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export interface ObjectSchema extends BaseSchema {
    type: "object";
    properties: { [key: string]: DataSchema };
    required?: Array<string>;
}

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export interface ArraySchema extends BaseSchema {
    type: "array";
    items: DataSchema;
    minItems?: number;
    maxItems?: number;
}

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export interface NullSchema extends BaseSchema {
    type: "null";
}

// TODO AutoSecurityScheme
// TODO ComboSecurityScheme

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export type SecurityType =
    | NoSecurityScheme
    | BasicSecurityScheme
    | DigestSecurityScheme
    | BearerSecurityScheme
    | APIKeySecurityScheme
    | OAuth2SecurityScheme
    | PSKSecurityScheme;

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export interface SecurityScheme {
    scheme: string;
    description?: TDT.Description;
    descriptions?: TDT.Descriptions;
    proxy?: TDT.AnyUri;
    [k: string]: unknown;
}

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export interface NoSecurityScheme extends SecurityScheme, TDT.NoSecurityScheme {
    scheme: "nosec";
}

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export interface BasicSecurityScheme extends SecurityScheme, TDT.BasicSecurityScheme {
    scheme: "basic";
}

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export interface DigestSecurityScheme extends SecurityScheme, TDT.DigestSecurityScheme {
    scheme: "digest";
}

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export interface APIKeySecurityScheme extends SecurityScheme, TDT.ApiKeySecurityScheme {
    scheme: "apikey";
}

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export interface BearerSecurityScheme extends SecurityScheme, TDT.BearerSecurityScheme {
    scheme: "bearer";
}

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export interface PSKSecurityScheme extends SecurityScheme, TDT.PskSecurityScheme {
    scheme: "psk";
}

/**
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export interface OAuth2SecurityScheme extends SecurityScheme, TDT.OAuth2SecurityScheme {
    scheme: "oauth2";
}

/** Implements the Thing Property description
 *
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export abstract class ThingProperty extends BaseSchema {
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

/** Implements the Thing Action description
 *
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export abstract class ThingAction {
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
/** Implements the Thing Event description
 *
 * @deprecated Will be removed in the future. Please use '@node-wot/core' package instead.
 */
export abstract class ThingEvent {
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
