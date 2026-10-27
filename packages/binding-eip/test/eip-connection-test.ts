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
import { EipValueLayout } from "../src/eip-codec";
import { EipConnection } from "../src/eip-connection";
import { EipStructureDefinition } from "../src/eip-form";
import { EipError, STRUCTURE_TYPE_CODE } from "../src/eip-protocol";
import { EipSession } from "../src/eip-session";
import { FakeEipServer } from "./fake-eip-server";

chai.use(chaiAsPromised);

const DINT = 0xc4;
const REAL = 0xca;
const INT = 0xc3;

const motorStatus: EipStructureDefinition = {
    "eipv:typeName": "MotorStatus",
    "eipv:byteSize": 8,
    "eipv:fields": [
        { "eipv:name": "Running", "eipv:type": "eipv:BOOL", "eipv:byteOffset": 0, "eipv:bitOffset": 3 },
        { "eipv:name": "Speed", "eipv:type": "eipv:REAL", "eipv:byteOffset": 4 },
    ],
};

function dints(...values: number[]): Buffer {
    const buf = Buffer.alloc(values.length * 4);
    values.forEach((v, i) => buf.writeInt32LE(v, i * 4));
    return buf;
}

describe("EtherNet/IP connection", () => {
    const server = new FakeEipServer();
    const options = { timeout: 1000 };
    let session: EipSession;
    let connection: EipConnection;

    before(async () => {
        const port = await server.start();
        session = new EipSession({ host: "127.0.0.1", port, routePath: ["1", "0"] });
        connection = new EipConnection(session, 8);
    });

    after(async () => {
        session.close();
        await server.stop();
    });

    beforeEach(() => {
        server.reset();
    });

    const services = () => server.requests.map((r) => r.service);

    describe("read", () => {
        it("reads a primitive tag", async () => {
            server.addTag("MotorSpeed", REAL, 4, Buffer.from([0x00, 0x00, 0xc0, 0x3f]));
            expect(await connection.read("MotorSpeed", { type: "eipv:REAL" }, options)).to.equal(1.5);
            expect(services()).to.deep.equal([0x4c]);
        });

        it("applies scale and offset", async () => {
            const raw = Buffer.alloc(2);
            raw.writeInt16LE(235);
            server.addTag("TankTemp", INT, 2, raw);
            const value = await connection.read("TankTemp", { type: "eipv:INT", scale: 0.1 }, options);
            expect(value).to.be.closeTo(23.5, 1e-9);
        });

        it("decodes a structure and keeps program-scoped paths intact", async () => {
            const data = Buffer.alloc(8);
            data[0] = 0x08;
            data.writeFloatLE(1450.5, 4);
            server.addTag("Program:Packaging.Motor", STRUCTURE_TYPE_CODE, 8, data, 0x1234);
            const value = await connection.read("Program:Packaging.Motor", { structure: motorStatus }, options);
            expect(value).to.deep.equal({ Running: true, Speed: 1450.5 });
        });

        it("falls back to Read Tag Fragmented on a partial transfer", async () => {
            server.maxFragment = 16;
            server.addTag("Levels", DINT, 4, dints(0, 1, 2, 3, 4, 5, 6, 7, 8, 9));
            const layout: EipValueLayout = { type: "eipv:DINT", dimensions: [10] };
            expect(await connection.read("Levels", layout, options)).to.deep.equal([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
            expect(services()).to.deep.equal([0x4c, 0x52, 0x52, 0x52]);
        });

        it("starts with Read Tag Fragmented when the form names it", async () => {
            server.addTag("Levels", DINT, 4, dints(1, 2));
            const layout: EipValueLayout = { type: "eipv:DINT", dimensions: [2] };
            const value = await connection.read("Levels", layout, { ...options, service: "ReadTagFragmented" });
            expect(value).to.deep.equal([1, 2]);
            expect(services()).to.deep.equal([0x52]);
        });

        it("reads a range of elements", async () => {
            server.addTag("Levels", DINT, 4, dints(0, 1, 2, 3, 4, 5));
            const layout: EipValueLayout = { type: "eipv:DINT", dimensions: [6], elementCount: 3 };
            expect(await connection.read("Levels", layout, options)).to.deep.equal([0, 1, 2]);
        });

        it("starts at the byte offset of the href", async () => {
            server.addTag("Status", DINT, 4, dints(10, 20, 30));
            const value = await connection.read("Status", { type: "eipv:DINT" }, { ...options, byteOffset: 8 });
            expect(value).to.equal(30);
            expect(services()).to.deep.equal([0x52]);
        });

        it("rejects a tag whose CIP type differs from the form", async () => {
            server.addTag("MotorSpeed", REAL, 4, Buffer.alloc(4));
            await expect(connection.read("MotorSpeed", { type: "eipv:DINT" }, options)).to.be.rejectedWith(
                EipError,
                "CIP type"
            );
        });

        it("reports a missing tag with its name", async () => {
            const error = (await connection
                .read("Nope", { type: "eipv:DINT" }, options)
                .catch((e: unknown) => e)) as EipError;
            expect(error).to.be.instanceOf(EipError);
            expect(error.message).to.include("Reading tag 'Nope'");
            expect(error.generalStatus).to.equal(0x04);
        });
    });

    describe("write", () => {
        it("writes a primitive tag", async () => {
            const tag = server.addTag("Setpoint", DINT, 4, dints(0));
            await connection.write("Setpoint", { type: "eipv:DINT" }, 1234, options);
            expect(tag.data).to.deep.equal(dints(1234));
            expect(services()).to.deep.equal([0x4d]);
        });

        it("reads a structure first to obtain its handle and preserve padding", async () => {
            const tag = server.addTag(
                "Motor",
                STRUCTURE_TYPE_CODE,
                8,
                Buffer.from([0xf0, 0xaa, 0xbb, 0xcc, 0, 0, 0, 0]),
                0x0abc
            );
            await connection.write("Motor", { structure: motorStatus }, { Running: true, Speed: 2 }, options);
            expect(tag.data[0]).to.equal(0xf8);
            expect(tag.data.subarray(1, 4)).to.deep.equal(Buffer.from([0xaa, 0xbb, 0xcc]));
            expect(tag.data.readFloatLE(4)).to.equal(2);
            expect(services()).to.deep.equal([0x4c, 0x4d]);
        });

        it("splits large values into Write Tag Fragmented requests", async () => {
            const tag = server.addTag("Levels", DINT, 4, dints(0, 0, 0, 0, 0, 0));
            const layout: EipValueLayout = { type: "eipv:DINT", dimensions: [6] };
            await connection.write("Levels", layout, [1, 2, 3, 4, 5, 6], options);
            expect(tag.data).to.deep.equal(dints(1, 2, 3, 4, 5, 6));
            expect(services()).to.deep.equal([0x53, 0x53, 0x53]);
        });

        it("uses Write Tag Fragmented when the form names it", async () => {
            const tag = server.addTag("Setpoint", DINT, 4, dints(0));
            await connection.write("Setpoint", { type: "eipv:DINT" }, 5, { ...options, service: "WriteTagFragmented" });
            expect(tag.data).to.deep.equal(dints(5));
            expect(services()).to.deep.equal([0x53]);
        });

        it("writes at the byte offset of the href", async () => {
            const tag = server.addTag("Status", DINT, 4, dints(10, 20, 30));
            await connection.write("Status", { type: "eipv:DINT" }, 99, { ...options, byteOffset: 4 });
            expect(tag.data).to.deep.equal(dints(10, 99, 30));
        });

        it("surfaces a type mismatch reported by the controller", async () => {
            server.addTag("MotorSpeed", REAL, 4, Buffer.alloc(4));
            const error = (await connection
                .write("MotorSpeed", { type: "eipv:DINT" }, 1, options)
                .catch((e: unknown) => e)) as EipError;
            expect(error).to.be.instanceOf(EipError);
            expect(error.generalStatus).to.equal(0xff);
            expect(error.message).to.include("0x2107");
        });

        it("rejects invalid values before contacting the controller", async () => {
            server.addTag("Setpoint", DINT, 4, dints(0));
            await expect(connection.write("Setpoint", { type: "eipv:DINT" }, "x", options)).to.be.rejectedWith(
                TypeError
            );
            expect(server.requests).to.have.length(0);
        });
    });
});
