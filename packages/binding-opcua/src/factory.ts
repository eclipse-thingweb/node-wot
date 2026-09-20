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

import { ProtocolClientFactory, ProtocolClient, ContentSerdes, createLoggers } from "@node-wot/core";
import { OpcuaJSONCodec, OpcuaBinaryCodec } from "./codec";
import { OPCUAProtocolClient } from "./opcua-protocol-client";

const { debug, error } = createLoggers("binding-opcua", "factory");

export class OPCUAClientFactory implements ProtocolClientFactory {
    readonly scheme: string = "opc.tcp";

    private _clients: OPCUAProtocolClient[] = [];

    public contentSerdes: ContentSerdes = ContentSerdes.get();

    constructor() {
        this.contentSerdes.addCodec(new OpcuaJSONCodec());
        this.contentSerdes.addCodec(new OpcuaBinaryCodec());
    }

    public getSupportedProtocols(): Array<[string, string?]> {
        return [["opc.tcp"]];
    }

    getClient(): ProtocolClient {
        debug(`OpcuaClientFactory creating client for '${this.scheme}'`);
        if (this._clients[0] != null) {
            return this._clients[0];
        }
        this._clients[0] = new OPCUAProtocolClient();
        return this._clients[0];
    }

    init(): boolean {
        debug("init");
        return true;
    }

    destroy(): boolean {
        debug("destroy");

        const clients = this._clients;
        this._clients = [];
        (async () => {
            for (const client of clients) {
                await client.stop();
            }
        })().catch((err) => {
            error("Error destroying clients", err);
        });
        return true;
    }
}
