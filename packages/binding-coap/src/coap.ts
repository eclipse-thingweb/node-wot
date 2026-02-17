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

import { Form } from "@node-wot/core";

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

export interface CoapServerConfig {
    port?: number;
    address?: string;
    devFriendlyUri?: boolean;
}

export type CoapMethodName = "GET" | "POST" | "PUT" | "DELETE" | "FETCH" | "PATCH" | "iPATCH";

export type BlockSize = 16 | 32 | 64 | 128 | 256 | 512 | 1024;

export type BlockSizeOptionValue = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface BlockWiseTransferParameters {
    "cov:block2Size"?: BlockSize;
    "cov:block1Size"?: BlockSize;
}

export class CoapForm extends Form {
    public "cov:method"?: CoapMethodName;

    public "cov:hopLimit"?: number;

    public "cov:blockwise"?: BlockWiseTransferParameters;

    public "cov:qblockwise"?: BlockWiseTransferParameters;

    public "cov:contentFormat"?: number;

    public "cov:accept"?: number;
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

/**
 * Encodes block size values for blockwise transfer to CoAP-specific values.
 *
 * Maps the values 16, 32, 64, 128, 256, 512, and 1024 to 0, 1, 2, 3, 4, 5, and 6,
 * respectively.
 *
 * Throws an `Error` if an invalid value `blockSize` is passed.
 *
 * @param blockSize The original block size value.
 * @returns A mapped block size value usable by CoAP.
 */
export function blockSizeToOptionValue(blockSize: BlockSize): BlockSizeOptionValue {
    switch (blockSize) {
        case 16:
            return 0;
        case 32:
            return 1;
        case 64:
            return 2;
        case 128:
            return 3;
        case 256:
            return 4;
        case 512:
            return 5;
        case 1024:
            return 6;
        default:
            throw Error(`Expected one of 16, 32, 64, 128, 256, 512, or 1024 as blockSize value, got ${blockSize}.`);
    }
}
