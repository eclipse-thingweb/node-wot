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

/**
 * WebSockets client
 */

import { ProtocolClient, Content, createLoggers } from "@node-wot/core";
import { Form, SecurityScheme } from "@node-wot/td-tools";
import { Subscription } from "rxjs/Subscription";

const { debug, warn } = createLoggers("binding-websockets", "ws-client");

export default class WebSocketClient implements ProtocolClient {
    // eslint-disable-next-line no-useless-constructor
    constructor() {
        // TODO: implement and remove eslint-ignore-useless-constructor
    }

    discoverDirectly(uri: string): Promise<Content> {
        return Promise.reject(new Error("Method not implemented."));
    }

    public toString(): string {
        return `[WebSocketClient]`;
    }

    public readResource(form: Form): Promise<Content> {
        return new Promise<Content>((resolve, reject) => {
            // TODO: implement
        });
    }

    public writeResource(form: Form, content: Content): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // TODO: implement
        });
    }

    public invokeResource(form: Form, content?: Content): Promise<Content> {
        return new Promise<Content>((resolve, reject) => {
            // TODO: implement
        });
    }

    public unlinkResource(form: Form): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // TODO: implement
        });
    }

    public subscribeResource(
        form: Form,
        next: (content: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ): Promise<Subscription> {
        return null;
    }

    public async start(): Promise<void> {
        // do nothing
    }

    public async stop(): Promise<void> {
        // do nothing
    }

    public setSecurity(metadata: Array<SecurityScheme>, credentials?: unknown): boolean {
        if (metadata === undefined || !Array.isArray(metadata) || metadata.length === 0) {
            warn("WebSocketClient received empty security metadata");
            return false;
        }
        // TODO support for multiple security schemes (see http-client.ts)
        const security: SecurityScheme = metadata[0];

        debug(`WebSocketClient using security scheme '${security.scheme}'`);
        return true;
    }
}
