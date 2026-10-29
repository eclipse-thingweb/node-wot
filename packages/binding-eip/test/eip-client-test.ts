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
import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { Content, ContentSerdes } from "@node-wot/core";
import EipClient from "../src/eip-client";
import EipClientFactory from "../src/eip-client-factory";
import { EipForm } from "../src/eip-form";
import { STRUCTURE_TYPE_CODE } from "../src/eip-protocol";
import { FakeEipServer } from "./fake-eip-server";

chai.use(chaiAsPromised);

const DINT = 0xc4;
const REAL = 0xca;

function dint(value: number): Buffer {
    const buf = Buffer.alloc(4);
    buf.writeInt32LE(value);
    return buf;
}

function real(value: number): Buffer {
    const buf = Buffer.alloc(4);
    buf.writeFloatLE(value);
    return buf;
}

async function jsonOf(content: Content): Promise<unknown> {
    expect(content.type).to.equal("application/json");
    return JSON.parse((await content.toBuffer()).toString());
}

function jsonContent(value: unknown): Content {
    return ContentSerdes.get().valueToContent(value as never, undefined, "application/json");
}

async function waitFor(condition: () => boolean, timeoutMs = 2000): Promise<void> {
    const start = Date.now();
    while (!condition()) {
        if (Date.now() - start > timeoutMs) throw new Error("Condition not met in time");
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
}

describe("EtherNet/IP client", () => {
    const server = new FakeEipServer();
    let port: number;
    let client: EipClient;

    const form = (tag: string, extra: Record<string, unknown> = {}): EipForm =>
        ({
            href: `eip://127.0.0.1:${port}/1,0/${tag}`,
            op: ["readproperty", "observeproperty", "writeproperty"],
            ...extra,
        }) as EipForm;

    before(async () => {
        port = await server.start();
    });

    after(async () => {
        await server.stop();
    });

    beforeEach(() => {
        server.reset();
        client = new EipClient();
    });

    afterEach(async () => {
        await client.stop();
    });

    describe("readResource", () => {
        it("returns the decoded value as JSON content", async () => {
            server.addTag("MotorSpeed", REAL, 4, real(1.5));
            const content = await client.readResource(form("MotorSpeed", { "eipv:type": "eipv:REAL" }));
            expect(await jsonOf(content)).to.equal(1.5);
            expect(server.requests[0].route).to.deep.equal(Buffer.from([1, 0]));
        });

        it("returns structures as objects", async () => {
            const data = Buffer.alloc(8);
            data.writeInt32LE(100, 0);
            data.writeFloatLE(0.5, 4);
            server.addTag("IO_Control", STRUCTURE_TYPE_CODE, 8, data, 0x4321);
            const content = await client.readResource(
                form("IO_Control", {
                    "eipv:structureDefinition": {
                        "eipv:typeName": "IO_Control",
                        "eipv:fields": [
                            { "eipv:name": "Set_Speed", "eipv:type": "eipv:DINT", "eipv:byteOffset": 0 },
                            { "eipv:name": "Level", "eipv:type": "eipv:REAL", "eipv:byteOffset": 4 },
                        ],
                    },
                })
            );
            expect(await jsonOf(content)).to.deep.equal({ Set_Speed: 100, Level: 0.5 });
        });

        it("shares one connection per endpoint", async () => {
            server.addTag("A", DINT, 4, dint(1));
            server.addTag("B", DINT, 4, dint(2));
            await client.readResource(form("A", { "eipv:type": "eipv:DINT" }));
            await client.readResource(form("B", { "eipv:type": "eipv:DINT" }));
            expect(server.connections).to.equal(1);
        });

        it("rejects invalid forms before contacting the controller", async () => {
            await expect(client.readResource(form("A"))).to.be.rejectedWith("eipv:type");
            await expect(
                client.readResource(form("A", { "eipv:type": "eipv:DINT", "eipv:service": "ExecutePCCC" }))
            ).to.be.rejectedWith("PCCC");
            expect(server.connections).to.equal(0);
        });

        it("rejects hrefs that are not valid eip addresses", async () => {
            const bad = { ...form("A", { "eipv:type": "eipv:DINT" }), href: "eip://127.0.0.1/1,0/" } as EipForm;
            await expect(client.readResource(bad)).to.be.rejectedWith("tag");
        });
    });

    describe("writeResource", () => {
        it("encodes the JSON value and writes it", async () => {
            const tag = server.addTag("Setpoint", DINT, 4, dint(0));
            await client.writeResource(form("Setpoint", { "eipv:type": "eipv:DINT" }), jsonContent(1234));
            expect(tag.data).to.deep.equal(dint(1234));
        });

        it("rejects values that do not fit the declared type", async () => {
            server.addTag("Setpoint", DINT, 4, dint(0));
            await expect(
                client.writeResource(form("Setpoint", { "eipv:type": "eipv:DINT" }), jsonContent("x"))
            ).to.be.rejectedWith(TypeError);
        });
    });

    describe("unsupported operations", () => {
        it("rejects actions", async () => {
            await expect(client.invokeResource(form("A"), jsonContent(1))).to.be.rejectedWith("action");
        });

        it("does not apply security metadata", () => {
            expect(client.setSecurity([])).to.equal(false);
        });
    });

    describe("subscribeResource", () => {
        let observed: EipForm;

        beforeEach(() => {
            observed = form("Counter", { "eipv:type": "eipv:DINT", "eipv:pollingTime": 20 });
        });

        it("polls the tag and reports every sample", async () => {
            const tag = server.addTag("Counter", DINT, 4, dint(1));
            const values: unknown[] = [];
            const subscription = await client.subscribeResource(observed, (content) => {
                void jsonOf(content).then((v) => values.push(v));
            });
            await waitFor(() => values.length >= 2);
            tag.data = dint(5);
            await waitFor(() => values.includes(5));
            expect(values[0]).to.equal(1);
            subscription.unsubscribe();
        });

        it("stops polling after unsubscribe", async () => {
            server.addTag("Counter", DINT, 4, dint(1));
            let samples = 0;
            const subscription = await client.subscribeResource(observed, () => samples++);
            await waitFor(() => samples >= 1);
            subscription.unsubscribe();
            const requests = server.requests.length;
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(server.requests.length).to.be.at.most(requests + 1);
            await expect(client.unlinkResource(observed)).to.be.rejectedWith("No subscription");
        });

        it("stops polling on unlinkResource", async () => {
            server.addTag("Counter", DINT, 4, dint(1));
            let samples = 0;
            await client.subscribeResource(observed, () => samples++);
            await waitFor(() => samples >= 1);
            await client.unlinkResource(observed);
            const requests = server.requests.length;
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(server.requests.length).to.be.at.most(requests + 1);
        });

        it("rejects a second subscription to the same tag", async () => {
            server.addTag("Counter", DINT, 4, dint(1));
            await client.subscribeResource(observed, () => undefined);
            await expect(client.subscribeResource(observed, () => undefined)).to.be.rejectedWith("Already subscribed");
        });

        it("reports read errors and keeps polling", async () => {
            const errors: Error[] = [];
            const values: unknown[] = [];
            await client.subscribeResource(
                observed,
                (content) => {
                    void jsonOf(content).then((v) => values.push(v));
                },
                (error) => errors.push(error)
            );
            await waitFor(() => errors.length >= 1);
            server.addTag("Counter", DINT, 4, dint(9));
            await waitFor(() => values.includes(9));
        });

        it("stops all polling when the client stops", async () => {
            server.addTag("Counter", DINT, 4, dint(1));
            let samples = 0;
            await client.subscribeResource(observed, () => samples++);
            await waitFor(() => samples >= 1);
            await client.stop();
            const requests = server.requests.length;
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(server.requests.length).to.be.at.most(requests + 1);
        });
    });

    describe("factory", () => {
        it("serves the eip scheme with a single client", () => {
            const factory = new EipClientFactory();
            expect(factory.scheme).to.equal("eip");
            expect(factory.getClient()).to.equal(factory.getClient());
            expect(factory.destroy()).to.equal(true);
            expect(factory.destroy()).to.equal(true);
        });
    });
});
