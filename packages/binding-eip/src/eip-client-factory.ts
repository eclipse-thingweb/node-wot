/********************************************************************************
 * Copyright (c) 2026 Contributors to the Eclipse Foundation
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
import { ProtocolClient, ProtocolClientFactory, createDebugLogger, createWarnLogger } from "@node-wot/core";
import EipClient from "./eip-client";

const debug = createDebugLogger("binding-eip", "eip-client-factory");
const warn = createWarnLogger("binding-eip", "eip-client-factory");

export default class EipClientFactory implements ProtocolClientFactory {
    public readonly scheme: string = "eip";
    private singleton?: EipClient;

    public getClient(): ProtocolClient {
        debug(`Get client for '${this.scheme}'`);
        this.init();
        // singleton is initialized in init()
        return this.singleton!;
    }

    public init(): boolean {
        if (!this.singleton) {
            debug(`Initializing client for '${this.scheme}'`);
            this.singleton = new EipClient();
        }
        return true;
    }

    public destroy(): boolean {
        debug(`Destroying client for '${this.scheme}'`);
        if (!this.singleton) {
            warn(`Destroying a not initialized client factory for '${this.scheme}'`);
            return true; // do not cause an error
        }
        void this.singleton.stop();
        this.singleton = undefined;
        return true;
    }
}
