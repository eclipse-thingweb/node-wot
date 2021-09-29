/********************************************************************************
 * Copyright (c) 2019 - 2021 Contributors to the Eclipse Foundation
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
export { default as OpcuaClient } from "./opcua-client";
export { default as OpcuaClientFactory } from "./opcua-client-factory";
export * from "./opcua";
export * from "./opcua-client-factory";

export interface OpcuaConfig {
    subscriptionOptions: {
        requestedPublishingInterval?: number;
        requestedLifetimeCount?: number;
        requestedMaxKeepAliveCount?: number;
        maxNotificationsPerPublish?: number;
        publishingEnabled?: boolean;
        priority?: number;
    };
}
export class OpcuaForm extends Form {
    "opc:method": string;
}
