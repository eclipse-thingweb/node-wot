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

import { Form } from "@node-wot/td-tools";

export { default as HttpServer } from './http-server'
export { default as HttpClient } from './http-client'
export { default as HttpClientFactory } from './http-client-factory'
export { default as HttpsClientFactory } from './https-client-factory'
export * from './http-server'
export * from './http-client'
export * from './http-client-factory'
export * from './https-client-factory'

export class HttpConfig {
    public proxy?: HttpProxyConfig;
    public allowSelfSigned: boolean;
}

export class HttpProxyConfig {
    public href: USVString;
    public scheme?: string;
    public token?: string;
    public username?: string;
    public password?: string;
}

export class HttpForm extends Form {
    public "http:methodName"?: string; // "GET", "PUT", "POST", "DELETE"
    public "http:headers"?: Array<HttpHeader> | HttpHeader;
}

export class HttpHeader {
    public "http:fieldName": number;
    public "http:fieldValue": any;
}
