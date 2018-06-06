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

import { InteractionForm } from "@node-wot/td-tools";

export { default as CoapServer } from "./coap-server";
export { default as CoapClientFactory } from "./coap-client-factory";
export { default as CoapClient } from "./coap-client";

export * from "./coap-server";
export * from "./coap-client-factory";
export * from "./coap-client";

export class CoapForm extends InteractionForm {
    public "coap:methodCode"?: number; // 1=0.01=GET, 2=0.02=POST, 3=0.03=PUT, 4=0.04=DELETE
    public "coap:options"?: Array<CoapOption> | CoapOption;
}

export class CoapOption {
    public "coap:optionCode": number;
    public "coap:optionValue": any;
}

export declare interface CoapRequestConfig {
    agent?: Object,
    hostname?: string,
    port?: number,
    pathname?: string,
    query?: string,
    observe?: boolean,
    multicast?: boolean,
    confirmable?: boolean,
    method?: string
}
