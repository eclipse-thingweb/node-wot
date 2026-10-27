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
import {
    Content,
    ContentSerdes,
    Form,
    ProtocolClient,
    SecurityScheme,
    createDebugLogger,
    createWarnLogger,
} from "@node-wot/core";
import { Subscription } from "rxjs/Subscription";
import { DataSchema, DataSchemaValue } from "wot-typescript-definitions";
import { EipAddress, parseEipHref } from "./eip-address";
import { EipValueLayout, layoutFromForm } from "./eip-codec";
import { EipConnection, EipOperationOptions } from "./eip-connection";
import { EipForm } from "./eip-form";
import { validateEipForm } from "./eip-form-validation";
import { EipSession } from "./eip-session";

const debug = createDebugLogger("binding-eip", "eip-client");
const warn = createWarnLogger("binding-eip", "eip-client");

const DEFAULT_TIMEOUT = 2000;
const DEFAULT_POLLING = 1000;

interface Endpoint {
    session: EipSession;
    connection: EipConnection;
}

/** Reads a tag repeatedly, one read at a time, until stopped. */
class Poller {
    private timer: NodeJS.Timeout | undefined;
    private stopped = false;

    constructor(
        private readonly read: () => Promise<Content>,
        private readonly interval: number,
        private readonly next: (value: Content) => void,
        private readonly error?: (error: Error) => void
    ) {
        this.schedule(0);
    }

    stop(): void {
        this.stopped = true;
        if (this.timer !== undefined) clearTimeout(this.timer);
    }

    private schedule(delay: number): void {
        this.timer = setTimeout(() => void this.poll(), delay);
    }

    private async poll(): Promise<void> {
        try {
            this.next(await this.read());
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            if (this.error !== undefined) this.error(error);
            else warn(`Polling failed: ${error.message}`);
        }
        if (!this.stopped) this.schedule(this.interval);
    }
}

export default class EipClient implements ProtocolClient {
    private readonly endpoints = new Map<string, Endpoint>();
    private readonly pollers = new Map<string, Poller>();

    async readResource(form: Form): Promise<Content> {
        const { endpoint, address, layout, options } = this.prepare(form as EipForm);
        const value = await endpoint.connection.read(address.tagPath, layout, options);
        return ContentSerdes.get().valueToContent(value as DataSchemaValue, undefined, form.contentType);
    }

    async writeResource(form: Form, content: Content): Promise<void> {
        const { endpoint, address, layout, options } = this.prepare(form as EipForm);
        const body = await content.toBuffer();
        const value = ContentSerdes.get().contentToValue({ type: content.type, body }, {} as DataSchema);
        await endpoint.connection.write(address.tagPath, layout, value, options);
    }

    async invokeResource(form: Form, content?: Content): Promise<Content> {
        throw new Error("The EtherNet/IP binding does not support actions");
    }

    async unlinkResource(form: Form): Promise<void> {
        const poller = this.pollers.get(form.href);
        if (poller === undefined) throw new Error(`No subscription for ${form.href} found`);
        poller.stop();
        this.pollers.delete(form.href);
    }

    async subscribeResource(
        form: Form,
        next: (content: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ): Promise<Subscription> {
        const eipForm = form as EipForm;
        this.prepare(eipForm);
        if (this.pollers.has(form.href)) {
            throw new Error(`Already subscribed for ${form.href}. Multiple subscriptions are not supported`);
        }
        debug(`Polling ${form.href}`);
        const poller = new Poller(
            () => this.readResource(form),
            eipForm["eipv:pollingTime"] ?? DEFAULT_POLLING,
            next,
            error
        );
        this.pollers.set(form.href, poller);
        return new Subscription(() => {
            poller.stop();
            if (this.pollers.get(form.href) === poller) this.pollers.delete(form.href);
            complete?.();
        });
    }

    async requestThingDescription(uri: string): Promise<Content> {
        throw new Error("Method not implemented");
    }

    async start(): Promise<void> {
        // sessions are opened on demand
    }

    async stop(): Promise<void> {
        this.pollers.forEach((poller) => poller.stop());
        this.pollers.clear();
        this.endpoints.forEach((endpoint) => endpoint.session.close());
        this.endpoints.clear();
    }

    setSecurity(metadata: SecurityScheme[], credentials?: unknown): boolean {
        return false;
    }

    private prepare(form: EipForm): {
        endpoint: Endpoint;
        address: EipAddress;
        layout: EipValueLayout;
        options: EipOperationOptions;
    } {
        validateEipForm(form);
        const address = parseEipHref(form.href);
        const layout = layoutFromForm(form);
        const options: EipOperationOptions = {
            service: form["eipv:service"],
            timeout: form["eipv:timeout"] ?? DEFAULT_TIMEOUT,
            byteOffset: address.byteOffset,
        };
        return { endpoint: this.endpointFor(address), address, layout, options };
    }

    private endpointFor(address: EipAddress): Endpoint {
        const key = `${address.host}:${address.port}/${address.routePath.join(",")}`;
        let endpoint = this.endpoints.get(key);
        if (endpoint === undefined) {
            debug(`Creating session for ${key}`);
            const session = new EipSession({ host: address.host, port: address.port, routePath: address.routePath });
            endpoint = { session, connection: new EipConnection(session) };
            this.endpoints.set(key, endpoint);
        }
        return endpoint;
    }
}
