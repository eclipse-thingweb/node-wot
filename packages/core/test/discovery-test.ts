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

import { Subscription } from "rxjs/Subscription";
import { Form, SecurityScheme } from "../src/thing-description";
import { Content } from "../src/content";
import { createLoggers } from "../src/logger";
import { ProtocolClient, ProtocolClientFactory } from "../src/protocol-interfaces";
import Servient from "../src/servient";
import { Readable } from "stream";
import { expect } from "chai";

const { debug, error } = createLoggers("core", "DiscoveryTest");

function createDirectoryTestTd(title: string, thingsPropertyHref: string) {
    return {
        "@context": "https://www.w3.org/2022/wot/td/v1.1",
        title,
        security: "nosec_sc",
        securityDefinitions: {
            nosec_sc: {
                scheme: "nosec",
            },
        },
        properties: {
            things: {
                type: "array",
                forms: [
                    {
                        href: thingsPropertyHref,
                    },
                ],
            },
        },
    };
}

function createDiscoveryContent(td: unknown, contentType: string) {
    const buffer = Buffer.from(JSON.stringify(td));
    const content = new Content(contentType, Readable.from(buffer));
    return content;
}

const directoryTdUrl1 = "test://localhost/valid-output-tds";
const directoryTdUrl2 = "test://localhost/invalid-output-tds";
const directoryTdUrl3 = "test://localhost/no-array-output";

const directoryTdTitle1 = "Directory Test TD 1";
const directoryTdTitle2 = "Directory Test TD 2";
const directoryTdTitle3 = "Directory Test TD 3";

const directoryThingsUrl1 = "test://localhost/things1";
const directoryThingsUrl2 = "test://localhost/things2";
const directoryThingsUrl3 = "test://localhost/things3";

const directoryThingDescription1 = createDirectoryTestTd(directoryTdTitle1, directoryThingsUrl1);
const directoryThingDescription2 = createDirectoryTestTd(directoryTdTitle2, directoryThingsUrl2);
const directoryThingDescription3 = createDirectoryTestTd(directoryTdTitle3, directoryThingsUrl3);

class TestProtocolClient implements ProtocolClient {
    async readResource(form: Form): Promise<Content> {
        const href = form.href;

        switch (href) {
            case directoryThingsUrl1:
                return createDiscoveryContent([directoryThingDescription1], "application/ld+json");
            case directoryThingsUrl2:
                return createDiscoveryContent(["I am an invalid TD!"], "application/ld+json");
            case directoryThingsUrl3:
                return createDiscoveryContent("I am no array and therefore invalid!", "application/ld+json");
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
        switch (uri) {
            case directoryTdUrl1:
                debug(`Found current URL ${uri} to fetch directory TD`);
                return createDiscoveryContent(directoryThingDescription1, "application/td+json");
            case directoryTdUrl2:
                debug(`Found current URL ${uri} to fetch directory TD`);
                return createDiscoveryContent(directoryThingDescription2, "application/td+json");
            case directoryTdUrl3:
                debug(`Found current URL ${uri} to fetch directory TD`);
                return createDiscoveryContent(directoryThingDescription3, "application/td+json");
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

        const discoveryProcess = await WoT.exploreDirectory(directoryTdUrl1);

        let tdCounter = 0;
        for await (const thingDescription of discoveryProcess) {
            expect(thingDescription.title).to.eql(directoryTdTitle1);
            tdCounter++;
        }
        expect(tdCounter).to.eql(1);
        expect(discoveryProcess.error).to.eq(undefined);
    });

    it("should receive no output and an error by the exploreDirectory method for invalid returned TDs", async () => {
        const servient = new Servient();
        servient.addClientFactory(new TestProtocolClientFactory());

        const WoT = await servient.start();

        const discoveryProcess = await WoT.exploreDirectory(directoryTdUrl2);

        let tdCounter = 0;
        for await (const thingDescription of discoveryProcess) {
            error(`Encountered unexpected TD with title ${thingDescription.title}`);
            tdCounter++;
        }
        expect(tdCounter).to.eql(0);
        expect(discoveryProcess.error).to.not.eq(undefined);
    });

    it("should receive no output and an error by the exploreDirectory method if no array is returned", async () => {
        const servient = new Servient();
        servient.addClientFactory(new TestProtocolClientFactory());

        const WoT = await servient.start();

        const discoveryProcess = await WoT.exploreDirectory(directoryTdUrl3);

        let tdCounter = 0;
        for await (const thingDescription of discoveryProcess) {
            error(`Encountered unexpected TD with title ${thingDescription.title}`);
            tdCounter++;
        }
        expect(tdCounter).to.eql(0);
        expect(discoveryProcess.error).to.not.eq(undefined);
    });

    it("should be possible to stop discovery with exploreDirectory prematurely", async () => {
        const servient = new Servient();
        servient.addClientFactory(new TestProtocolClientFactory());

        const WoT = await servient.start();

        const discoveryProcess = await WoT.exploreDirectory(directoryTdUrl1);
        expect(discoveryProcess.done).to.not.eq(true);
        discoveryProcess.stop();
        expect(discoveryProcess.done).to.eq(true);

        let tdCounter = 0;
        for await (const thingDescription of discoveryProcess) {
            error(`Encountered unexpected TD with title ${thingDescription.title}`);
            tdCounter++;
        }
        expect(tdCounter).to.eql(0);
        expect(discoveryProcess.error).to.eq(undefined);
    });
});
