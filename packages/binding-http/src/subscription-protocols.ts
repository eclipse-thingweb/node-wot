/* eslint-disable dot-notation -- we are using private functions from HttpClient */
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
import { HttpClient, HttpForm } from "./http";
import EventSource from "eventsource";
import { Content, ProtocolHelpers } from "@node-wot/core";
import { Readable } from "stream";
export interface InternalSubscription {
    open(next: (value: Content) => void, error?: (error: Error) => void, complete?: () => void): Promise<void>;
    close(): void;
}
export class LongPollingSubscription implements InternalSubscription {
    private form: HttpForm;
    private client: HttpClient;

    private closed: boolean;
    /**
     *
     */
    constructor(form: HttpForm, client: HttpClient) {
        this.form = form;
        this.client = client;
        this.closed = false;
    }

    open(next: (value: Content) => void, error?: (error: Error) => void, complete?: () => void): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const polling = async (handshake: boolean) => {
                try {
                    if (handshake) {
                        const headRequest = await this.client["generateFetchRequest"](this.form, "HEAD", {
                            timeout: 1000,
                        });
                        const result = await this.client["fetch"](headRequest);
                        if (result.ok) resolve();
                    }

                    // long timeout for long polling
                    const request = await this.client["generateFetchRequest"](this.form, "GET", {
                        timeout: 60 * 60 * 1000,
                    });
                    console.debug(
                        "[binding-http]",
                        `HttpClient (subscribeResource) sending ${request.method} to ${request.url}`
                    );

                    const result = await this.client["fetch"](request);

                    this.client["checkFetchResponse"](result);

                    console.debug("[binding-http]", `HttpClient received ${result.status} from ${request.url}`);

                    console.debug(
                        "[binding-http]",
                        `HttpClient received headers: ${JSON.stringify(result.headers.raw())}`
                    );
                    console.debug(
                        "[binding-http]",
                        `HttpClient received Content-Type: ${result.headers.get("content-type")}`
                    );

                    if (!this.closed) {
                        // in browsers node-fetch uses the native fetch, which returns a ReadableStream
                        // not complaint with node. Therefore we have to force the conversion here.
                        const body = ProtocolHelpers.toNodeStream(result.body as Readable);
                        next({ type: result.headers.get("content-type"), body });
                        polling(false);
                    }

                    complete && complete();
                } catch (e) {
                    error && error(e);
                    complete && complete();
                    reject(e);
                }
            };
            polling(true);
        });
    }

    close(): void {
        this.closed = true;
    }
}

export class SSESubscription implements InternalSubscription {
    private form: HttpForm;
    private eventSource: EventSource;
    private closed: boolean;
    /**
     *
     */
    constructor(form: HttpForm) {
        this.form = form;
        this.closed = false;
    }

    open(next: (value: Content) => void, error?: (error: Error) => void, complete?: () => void): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.eventSource = new EventSource(this.form.href);

            this.eventSource.onopen = (event) => {
                console.debug(
                    "[binding-http]",
                    `HttpClient (subscribeResource) Server-Sent Event connection is opened to ${this.form.href}`
                );
                resolve();
            };
            this.eventSource.onmessage = (event) => {
                console.debug("[binding-http]", `HttpClient received ${JSON.stringify(event)} from ${this.form.href}`);
                const output = { type: this.form.contentType, body: Readable.from(JSON.stringify(event)) };
                next(output);
            };
            this.eventSource.onerror = function (event) {
                error(new Error(event.toString()));
                complete && complete();
                reject(event.toString());
            };
        });
    }

    close(): void {
        this.eventSource.close();
    }
}
