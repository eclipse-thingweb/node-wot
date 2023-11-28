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

/**
 * File protocol binding
 */
import { ProtocolClientFactory, ProtocolClient, createLoggers } from "@node-wot/core";
import FileClient from "./file-client";

const { debug } = createLoggers("binding-file", "file-client-factory");

export default class FileClientFactory implements ProtocolClientFactory {
    public readonly scheme: string = "file";

    public getClient(): ProtocolClient {
        debug(`FileClientFactory creating client for '${this.scheme}'`);
        return new FileClient();
    }

    public init = (): boolean => true;
    public destroy = (): boolean => true;
}
