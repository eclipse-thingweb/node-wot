/********************************************************************************
 * Copyright (c) 2020 Contributors to the Eclipse Foundation
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
import { ProtocolClientFactory, ProtocolClient, createDebugLogger, createWarnLogger } from "@node-wot/core";
import ModbusClient from "./modbus-client";

const debug = createDebugLogger("binding-modbus", "modbus-client-factory");
const warn = createWarnLogger("binding-modbus", "modbus-client-factory");

export default class ModbusClientFactory implements ProtocolClientFactory {
    public readonly scheme: string = "modbus+tcp";
    private singleton?: ModbusClient;

    public getSupportedProtocols(): Array<[string, string?]> {
        return [["modbus+tcp"]];
    }

    public getClient(): ProtocolClient {
        debug(`Get client for '${this.scheme}'`);
        this.init();
        // singleton is initialized in init()
        return this.singleton!;
    }

    public init(): boolean {
        if (!this.singleton) {
            debug(`Initializing client for '${this.scheme}'`);
            this.singleton = new ModbusClient();
        }
        return true;
    }

    public destroy(): boolean {
        debug(`Destroying client for '${this.scheme}'`);
        if (!this.singleton) {
            warn(`Destroying a not initialized client factory for '${this.scheme}'`);
            return true; // do not cause an error
        }
        this.singleton.stop();
        this.singleton = undefined;
        return true;
    }
}
