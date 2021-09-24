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

import { Form } from "@node-wot/td-tools";

export { default as CoapServer } from "./coap-server";
export { default as CoapClientFactory } from "./coap-client-factory";
export { default as CoapClient } from "./coap-client";
export { default as CoapsClientFactory } from "./coaps-client-factory";
export { default as CoapsClient } from "./coaps-client";

export * from "./coap-server";
export * from "./coap-client-factory";
export * from "./coap-client";
export * from "./coaps-client-factory";
export * from "./coaps-client";

export class CoapOption {
    public "cov:optionName": number;
    public "cov:optionValue": any;
}

export type CoapMethodName = "GET" | "POST" | "PUT" | "DELETE" | "FETCH" | "PATCH" | "iPATCH";

export class CoapForm extends Form {
    public "cov:methodName"?: CoapMethodName;
    public "cov:options"?: Array<CoapOption> | CoapOption;
}

/**
 * Checks if a given method name is valid against the CoAP binding templates.
 *
 * Valid method names are `GET`, `POST`, `PUT`, `DELETE`, `FETCH`, `PATCH`, and `iPATCH`.
 *
 * @param methodName The method name to check.
 * @returns `true` if the given `methodName` is valid.
 */
export function isValidCoapMethod(methodName: CoapMethodName): methodName is CoapMethodName {
    return ["GET", "POST", "PUT", "DELETE", "FETCH", "PATCH", "iPATCH"].includes(methodName);
}

/**
 * Checks if a given method name is supported by the current CoAP implementation.
 *
 * Valid method names are `GET`, `POST`, `PUT`, and `DELETE`.
 *
 * @param methodName The method name to check.
 * @returns `true` if the given `methodName` is supported.
 */
export function isSupportedCoapMethod(methodName: CoapMethodName): methodName is CoapMethodName {
    return ["GET", "POST", "PUT", "DELETE"].includes(methodName);
}

export declare interface CoapRequestConfig {
    agent?: Object;
    hostname?: string;
    port?: number;
    pathname?: string;
    query?: string;
    observe?: boolean;
    multicast?: boolean;
    confirmable?: boolean;
    method?: string;
}
