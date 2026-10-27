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
import * as net from "net";
import { EipSession } from "../src/eip-session";
import { EipError, assertCipSuccess, encodeReadTag, encodeTagPath, parseTagData } from "../src/eip-protocol";
import { FakeEipServer } from "./fake-eip-server";

chai.use(chaiAsPromised);

function dint(value: number): Buffer {
    const buf = Buffer.alloc(4);
    buf.writeInt32LE(value);
    return buf;
}

function readCounter(): Buffer {
    return encodeReadTag(encodeTagPath("Counter"), 1);
}

describe("EtherNet/IP session", () => {
    const server = new FakeEipServer();
    let port: number;
    let session: EipSession;

    before(async () => {
        port = await server.start();
    });

    after(async () => {
        await server.stop();
    });

    beforeEach(() => {
        server.reset();
        server.addTag("Counter", 0xc4, 4, dint(42));
        session = new EipSession({ host: "127.0.0.1", port, routePath: ["1", "3"] });
    });

    afterEach(() => {
        session.close();
    });

    it("reads a tag and sends the configured route path", async () => {
        const reply = await session.request(readCounter(), 1000);
        assertCipSuccess(reply);
        expect(parseTagData(reply.data).value).to.deep.equal(dint(42));
        expect(server.requests).to.have.length(1);
        expect(server.requests[0].route).to.deep.equal(Buffer.from([1, 3]));
    });

    it("serializes concurrent requests and matches each reply to its request", async () => {
        server.addTag("Other", 0xc4, 4, dint(7));
        const other = encodeReadTag(encodeTagPath("Other"), 1);
        const [a, b, c] = await Promise.all([
            session.request(readCounter(), 1000),
            session.request(other, 1000),
            session.request(readCounter(), 1000),
        ]);
        expect(parseTagData(a.data).value).to.deep.equal(dint(42));
        expect(parseTagData(b.data).value).to.deep.equal(dint(7));
        expect(parseTagData(c.data).value).to.deep.equal(dint(42));
    });

    it("reuses one TCP connection", async () => {
        await session.request(readCounter(), 1000);
        await session.request(readCounter(), 1000);
        expect(server.connections).to.equal(1);
    });

    it("times out when the controller does not reply and reconnects afterwards", async () => {
        server.silent = true;
        await expect(session.request(readCounter(), 100)).to.be.rejectedWith(EipError, "100 ms");
        server.silent = false;
        const reply = await session.request(readCounter(), 1000);
        expect(reply.status).to.equal(0);
        expect(server.connections).to.equal(2);
    });

    it("reconnects after the controller drops the connection", async () => {
        await session.request(readCounter(), 1000);
        server.dropConnections();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const reply = await session.request(readCounter(), 1000);
        expect(reply.status).to.equal(0);
        expect(server.connections).to.equal(2);
    });

    it("fails when nothing listens on the port", async () => {
        const closed = net.createServer();
        await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
        const closedPort = (closed.address() as net.AddressInfo).port;
        await new Promise<void>((resolve) => closed.close(() => resolve()));
        const unreachable = new EipSession({ host: "127.0.0.1", port: closedPort, routePath: ["1", "0"] });
        await expect(unreachable.request(readCounter(), 500)).to.be.rejected;
    });

    it("returns CIP error statuses to the caller", async () => {
        const reply = await session.request(encodeReadTag(encodeTagPath("Missing"), 1), 1000);
        expect(reply.status).to.equal(0x04);
        expect(() => assertCipSuccess(reply, false, "Tag 'Missing'")).to.throw(EipError, "Tag 'Missing'");
    });

    it("rejects an invalid route path when the session is created", () => {
        expect(() => new EipSession({ host: "h", port: 1, routePath: ["20", "0"] })).to.throw("port");
    });
});
