/********************************************************************************
 * Copyright (c) 2019 Contributors to the Eclipse Foundation
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
 * Netconf protocol binding
 */
import { ProtocolClientFactory, ProtocolClient, ContentSerdes, createDebugLogger } from "@node-wot/core";
import NetconfClient from "./netconf-client";
import NetconfCodec from "./codecs/netconf-codec";

const debug = createDebugLogger("binding-netconf", "netconf-client-factory");

export default class NetconfClientFactory implements ProtocolClientFactory {
    public readonly scheme: string = "netconf";
    public contentSerdes: ContentSerdes = ContentSerdes.get();

    public getSupportedProtocols(): Array<[string, string?]> {
        return [["netconf"]];
    }

    public getClient(): ProtocolClient {
        this.contentSerdes.addCodec(new NetconfCodec()); // add custom codec for NetConf
        debug(`NetconfClientFactory creating client for '${this.scheme}'`);
        return new NetconfClient();
    }

    public init = (): boolean => true;
    public destroy = (): boolean => true;
}
