/********************************************************************************
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
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

/**
 * HTTPS client Factory
 */

import { ProtocolClientFactory, ProtocolClient } from "@node-wot/core";

export default class WssClientFactory implements ProtocolClientFactory {
    public readonly scheme: string = "wss";

    // eslint-disable-next-line no-useless-constructor
    constructor() {
        // TODO: implement and remove eslint-ignore-useless-constructor
    }

    public getClient(): ProtocolClient {
        throw new Error("WssClientFactory for 'wss' is not implemented");
    }

    public init(): boolean {
        // info(`HttpsClientFactory for '${HttpsClientFactory.scheme}' initializing`);
        // TODO uncomment info if something is executed here
        return true;
    }

    public destroy(): boolean {
        // info(`HttpsClientFactory for '${HttpsClientFactory.scheme}' destroyed`);
        // TODO uncomment info if something is executed here
        return true;
    }
}
