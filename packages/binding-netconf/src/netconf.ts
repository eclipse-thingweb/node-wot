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

import { Form } from "@node-wot/td-tools";
export { default as NetconfClient } from "./netconf-client";
export { default as NetconfClientFactory } from "./netconf-client-factory";
export * from "./netconf";
export * from "./netconf-client-factory";
export class NetconfForm extends Form {
    public "nc:NSs"?: Record<string, string>;
    public "nc:method"?: string;
    public "nc:target"?: string;
}

export type RpcMethod = "GET-CONFIG" | "EDIT-CONFIG" | "COMMIT" | "RPC";

export interface NetConfCredentials {
    username: string;
    password?: string;

    privateKey?: string;
}

export function isRpcMethod(method?: string): method is RpcMethod {
    if (!method) return false;
    return ["GET-CONFIG", "EDIT-CONFIG", "COMMIT", "RPC"].includes(method);
}
