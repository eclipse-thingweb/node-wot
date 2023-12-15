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

import { Form, SecurityScheme } from "@node-wot/td-tools";
import { Subscription } from "rxjs/Subscription";
import { Content } from "../src/content";
import { createLoggers } from "../src/logger";
import { ProtocolClient, ProtocolClientFactory } from "../src/protocol-interfaces";
import Servient from "../src/servient";
import { Readable } from "stream";
import { expect } from "chai";

const { debug } = createLoggers("core", "DiscoveryTest");

const directoryTdUrl = "test://localhost/.well-known/wot";
const directoryThingsUrl = "test://localhost/things";

const directoryThingDescription = {
    "@context": "https://www.w3.org/2022/wot/td/v1.1",
    title: "Directory Test TD",
    security: "nosec_sc",
    securityDefinitions: {
        nosec_sc: {
            scheme: "nosec",
        },
    },
    properties: {
        things: {
            forms: [
                {
                    href: directoryThingsUrl,
                },
            ],
        },
    },
};

class TestProtocolClient implements ProtocolClient {
    async readResource(form: Form): Promise<Content> {
        if (form.href === directoryThingsUrl) {
            const buffer = Buffer.from(JSON.stringify([directoryThingDescription]));
            const content = new Content("application/ld+json", Readable.from(buffer));
            return content;
        }

        throw new Error("Invalid URL");
    }

    writeResource(form: Form, content: Content): Promise<void> {
        throw new Error("Method not implemented.");
    }

    invokeResource(form: Form, content?: Content | undefined): Promise<Content> {
        throw new Error("Method not implemented.");
    }

    unlinkResource(form: Form): Promise<void> {
        throw new Error("Method not implemented.");
    }

    subscribeResource(
        form: Form,
        next: (content: Content) => void,
        error?: ((error: Error) => void) | undefined,
        complete?: (() => void) | undefined
    ): Promise<Subscription> {
        throw new Error("Method not implemented.");
    }

    async requestThingDescription(uri: string): Promise<Content> {
        if (uri === directoryTdUrl) {
            debug(`Found corrent URL ${directoryTdUrl} to fetch directory TD`);
            const buffer = Buffer.from(JSON.stringify(directoryThingDescription));
            const content = new Content("application/td+json", Readable.from(buffer));
            return content;
        }

        throw Error("Invalid URL");
    }

    async start(): Promise<void> {
        // Do nothing
    }

    async stop(): Promise<void> {
        // Do nothing
    }

    setSecurity(metadata: SecurityScheme[], credentials?: unknown): boolean {
        return true;
    }
}

class TestProtocolClientFactory implements ProtocolClientFactory {
    public scheme = "test";

    getClient(): ProtocolClient {
        return new TestProtocolClient();
    }

    init(): boolean {
        return true;
    }

    destroy(): boolean {
        return true;
    }
}

describe("Discovery Tests", () => {
    it("should be possible to use the exploreDirectory method", async () => {
        const servient = new Servient();
        servient.addClientFactory(new TestProtocolClientFactory());

        const WoT = await servient.start();

        const discoveryProcess = await WoT.exploreDirectory(directoryTdUrl);

        for await (const thingDescription of discoveryProcess) {
            expect(thingDescription.title === "Directory Test TD");
        }
    });
});
