/********************************************************************************
 * Copyright (c) 2018 - 2021 Contributors to the Eclipse Foundation
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
 * WebSockets client
 */

import { ProtocolClient, Content } from "@node-wot/core";
import { Form } from "@node-wot/td-tools";

export default class WebSocketClient implements ProtocolClient {
    // eslint-disable-next-line no-useless-constructor
    constructor() {
        // TODO: implement and remove eslint-ignore-useless-constructor
    }

    public toString(): string {
        return `[WebSocketClient]`;
    }

    public readResource(form: Form): Promise<Content> {
        return new Promise<Content>((resolve, reject) => {
            // TODO: implement
        });
    }

    public writeResource(form: Form, content: Content): Promise<unknown> {
        return new Promise<void>((resolve, reject) => {
            // TODO: implement
        });
    }

    public invokeResource(form: Form, content?: Content): Promise<Content> {
        return new Promise<Content>((resolve, reject) => {
            // TODO: implement
        });
    }

    public unlinkResource(form: Form): Promise<unknown> {
        return new Promise<void>((resolve, reject) => {
            // TODO: implement
        });
    }

    public subscribeResource(
        form: Form,
        next: (value: unknown) => void,
        error?: (error: unknown) => void,
        complete?: () => void
    ): unknown {
        return null;
    }

    public async start(): Promise<void> {
        // do nothing
    }

    public async stop(): Promise<void> {
        // do nothing
    }

    public setSecurity(metadata: unknown, credentials?: unknown): boolean {
        if (Array.isArray(metadata)) {
            metadata = metadata[0];
        }

        return true;
    }
}
