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
import { expect } from "chai";
import {
    EipError,
    EncapsulationDecoder,
    assertCipSuccess,
    encodeCipRequest,
    encodeEncapsulation,
    encodeReadTag,
    encodeReadTagFragmented,
    encodeRoutePath,
    encodeSendRRData,
    encodeTagPath,
    encodeUnconnectedSend,
    encodeWriteTag,
    encodeWriteTagFragmented,
    decodeSendRRData,
    parseCipReply,
    parseTagData,
    tagTypeHeader,
    SERVICE,
} from "../src/eip-protocol";

function bytes(...values: number[]): Buffer {
    return Buffer.from(values);
}

function ascii(text: string): number[] {
    return Array.from(Buffer.from(text, "latin1"));
}

describe("EtherNet/IP protocol encoding", () => {
    describe("tag path", () => {
        it("encodes a simple symbol", () => {
            expect(encodeTagPath("MotorSpeed")).to.deep.equal(bytes(0x91, 10, ...ascii("MotorSpeed")));
        });

        it("pads symbols of odd length", () => {
            expect(encodeTagPath("Abc")).to.deep.equal(bytes(0x91, 3, ...ascii("Abc"), 0));
        });

        it("encodes members and array subscripts", () => {
            expect(encodeTagPath("Recipe[3].SetPoint")).to.deep.equal(
                bytes(0x91, 6, ...ascii("Recipe"), 0x28, 3, 0x91, 8, ...ascii("SetPoint"))
            );
        });

        it("encodes one segment per dimension", () => {
            expect(encodeTagPath("Grid[1,2]")).to.deep.equal(bytes(0x91, 4, ...ascii("Grid"), 0x28, 1, 0x28, 2));
        });

        it("uses wider index segments when needed", () => {
            expect(encodeTagPath("A[300]")).to.deep.equal(bytes(0x91, 1, 0x41, 0, 0x29, 0, 0x2c, 0x01));
            expect(encodeTagPath("A[70000]")).to.deep.equal(bytes(0x91, 1, 0x41, 0, 0x2a, 0, 0x70, 0x11, 0x01, 0x00));
        });

        it("keeps colons of program-scoped and module tags", () => {
            const encoded = encodeTagPath("Program:Packaging.Counter");
            expect(encoded).to.deep.equal(
                bytes(0x91, 17, ...ascii("Program:Packaging"), 0, 0x91, 7, ...ascii("Counter"), 0)
            );
            expect(encodeTagPath("Local:2:O")).to.deep.equal(bytes(0x91, 9, ...ascii("Local:2:O"), 0));
        });

        it("rejects bit access, which is not supported yet", () => {
            expect(() => encodeTagPath("Status.3")).to.throw("bit");
        });

        it("rejects malformed tag paths", () => {
            for (const bad of ["", "1Tag", "Tag[", "Tag[x]", "Tag[1,2,3,4]", "a..b", "Tag.", "a b"]) {
                expect(() => encodeTagPath(bad), bad).to.throw("tag path");
            }
        });
    });

    describe("route path", () => {
        it("encodes backplane slot routes", () => {
            expect(encodeRoutePath(["1", "0"])).to.deep.equal(bytes(1, 0));
            expect(encodeRoutePath(["1", "3"])).to.deep.equal(bytes(1, 3));
        });

        it("encodes an Ethernet hop as an extended link address", () => {
            expect(encodeRoutePath(["1", "4", "2", "10.0.0.1", "1", "0"])).to.deep.equal(
                bytes(1, 4, 0x12, 8, ...ascii("10.0.0.1"), 1, 0)
            );
        });

        it("pads extended link addresses to an even length", () => {
            expect(encodeRoutePath(["2", "10.0.0.12"])).to.deep.equal(bytes(0x12, 9, ...ascii("10.0.0.12"), 0));
        });

        it("rejects extended port numbers", () => {
            expect(() => encodeRoutePath(["15", "0"])).to.throw("port");
        });
    });

    describe("CIP requests", () => {
        const path = encodeTagPath("A");

        it("builds a generic request", () => {
            expect(encodeCipRequest(0x4c, path, bytes(1, 0))).to.deep.equal(bytes(0x4c, 2, 0x91, 1, 0x41, 0, 1, 0));
        });

        it("builds Read Tag and Read Tag Fragmented", () => {
            expect(encodeReadTag(path, 3)).to.deep.equal(bytes(SERVICE.ReadTag, 2, 0x91, 1, 0x41, 0, 3, 0));
            expect(encodeReadTagFragmented(path, 3, 0x102)).to.deep.equal(
                bytes(SERVICE.ReadTagFragmented, 2, 0x91, 1, 0x41, 0, 3, 0, 0x02, 0x01, 0, 0)
            );
        });

        it("builds Write Tag and Write Tag Fragmented", () => {
            const header = tagTypeHeader("eipv:DINT");
            expect(encodeWriteTag(path, header, 1, bytes(5, 0, 0, 0))).to.deep.equal(
                bytes(SERVICE.WriteTag, 2, 0x91, 1, 0x41, 0, 0xc4, 0, 1, 0, 5, 0, 0, 0)
            );
            expect(encodeWriteTagFragmented(path, header, 2, 8, bytes(5, 0, 0, 0))).to.deep.equal(
                bytes(SERVICE.WriteTagFragmented, 2, 0x91, 1, 0x41, 0, 0xc4, 0, 2, 0, 8, 0, 0, 0, 5, 0, 0, 0)
            );
        });

        it("includes the structure handle in the type header of structures and STRING", () => {
            expect(tagTypeHeader(undefined, 0x1234)).to.deep.equal(bytes(0xa0, 0x02, 0x34, 0x12));
            expect(tagTypeHeader("eipv:STRING", 0x0fce)).to.deep.equal(bytes(0xa0, 0x02, 0xce, 0x0f));
            expect(() => tagTypeHeader(undefined)).to.throw("handle");
        });
    });

    describe("Unconnected Send", () => {
        it("wraps a request with timing, size and route path", () => {
            const embedded = encodeReadTag(encodeTagPath("A"), 1);
            expect(encodeUnconnectedSend(embedded, encodeRoutePath(["1", "0"]))).to.deep.equal(
                bytes(0x52, 2, 0x20, 0x06, 0x24, 0x01, 0x05, 0xf9, 8, 0, ...embedded, 1, 0, 1, 0)
            );
        });

        it("pads an embedded request of odd length", () => {
            const embedded = bytes(1, 2, 3);
            expect(encodeUnconnectedSend(embedded, bytes(1, 0))).to.deep.equal(
                bytes(0x52, 2, 0x20, 0x06, 0x24, 0x01, 0x05, 0xf9, 3, 0, 1, 2, 3, 0, 1, 0, 1, 0)
            );
        });
    });

    describe("CIP replies", () => {
        it("parses status, extended status and data", () => {
            const reply = parseCipReply(bytes(0xcc, 0, 0xff, 1, 0x05, 0x21, 9, 9));
            expect(reply.service).to.equal(0xcc);
            expect(reply.status).to.equal(0xff);
            expect(reply.extendedStatus).to.deep.equal([0x2105]);
            expect(reply.data).to.deep.equal(bytes(9, 9));
        });

        it("accepts success and optionally partial transfer", () => {
            const ok = parseCipReply(bytes(0xcc, 0, 0, 0, 1));
            expect(() => assertCipSuccess(ok)).to.not.throw();
            const partial = parseCipReply(bytes(0xcc, 0, 6, 0, 1));
            expect(() => assertCipSuccess(partial)).to.throw(EipError);
            expect(() => assertCipSuccess(partial, true)).to.not.throw();
        });

        it("raises descriptive errors", () => {
            const missing = parseCipReply(bytes(0xcc, 0, 0x04, 1, 0, 0));
            expect(() => assertCipSuccess(missing, false, "Tag 'X'"))
                .to.throw(EipError, "Tag 'X'")
                .with.property("generalStatus", 0x04);
            const mismatch = parseCipReply(bytes(0xcd, 0, 0xff, 1, 0x07, 0x21));
            expect(() => assertCipSuccess(mismatch)).to.throw("0x2107");
            const unknown = parseCipReply(bytes(0xcc, 0, 0x7e, 0));
            expect(() => assertCipSuccess(unknown)).to.throw("0x7e");
        });

        it("rejects truncated replies", () => {
            expect(() => parseCipReply(bytes(0xcc, 0))).to.throw("short");
            expect(() => parseCipReply(bytes(0xcc, 0, 0, 2, 1))).to.throw("short");
        });

        it("splits tag data into type, optional structure handle and value", () => {
            expect(parseTagData(bytes(0xc4, 0, 1, 2, 3, 4))).to.deep.equal({
                typeCode: 0xc4,
                structureHandle: undefined,
                value: bytes(1, 2, 3, 4),
            });
            expect(parseTagData(bytes(0xa0, 0x02, 0x34, 0x12, 7, 8))).to.deep.equal({
                typeCode: 0x02a0,
                structureHandle: 0x1234,
                value: bytes(7, 8),
            });
            expect(() => parseTagData(bytes(0xa0, 0x02, 0x34))).to.throw("short");
        });
    });

    describe("encapsulation", () => {
        const context = bytes(1, 2, 3, 4, 5, 6, 7, 8);

        it("encodes the 24 byte header", () => {
            const frame = encodeEncapsulation(0x6f, 0xaabbccdd, context, bytes(9, 9));
            expect(frame.length).to.equal(26);
            expect(frame.readUInt16LE(0)).to.equal(0x6f);
            expect(frame.readUInt16LE(2)).to.equal(2);
            expect(frame.readUInt32LE(4)).to.equal(0xaabbccdd);
            expect(frame.readUInt32LE(8)).to.equal(0);
            expect(frame.subarray(12, 20)).to.deep.equal(context);
            expect(frame.readUInt32LE(20)).to.equal(0);
            expect(frame.subarray(24)).to.deep.equal(bytes(9, 9));
        });

        it("reassembles frames from arbitrary chunks", () => {
            const a = encodeEncapsulation(0x65, 1, context, bytes(1, 0, 0, 0));
            const b = encodeEncapsulation(0x6f, 1, context, bytes(5, 6, 7));
            const all = Buffer.concat([a, b]);
            const decoder = new EncapsulationDecoder();
            const frames = [
                ...decoder.push(all.subarray(0, 10)),
                ...decoder.push(all.subarray(10, 30)),
                ...decoder.push(all.subarray(30)),
            ];
            expect(frames).to.have.length(2);
            expect(frames[0].command).to.equal(0x65);
            expect(frames[0].data).to.deep.equal(bytes(1, 0, 0, 0));
            expect(frames[1].command).to.equal(0x6f);
            expect(frames[1].sessionHandle).to.equal(1);
            expect(frames[1].senderContext).to.deep.equal(context);
            expect(frames[1].data).to.deep.equal(bytes(5, 6, 7));
        });

        it("returns several frames from one chunk", () => {
            const a = encodeEncapsulation(0x65, 1, context, Buffer.alloc(0));
            const frames = new EncapsulationDecoder().push(Buffer.concat([a, a]));
            expect(frames).to.have.length(2);
        });

        it("wraps CIP data for SendRRData and unwraps it again", () => {
            const cip = bytes(0xcc, 0, 0, 0, 1, 2);
            const payload = encodeSendRRData(cip);
            expect(payload.subarray(0, 6)).to.deep.equal(bytes(0, 0, 0, 0, 0, 0));
            expect(payload.readUInt16LE(6)).to.equal(2);
            expect(payload.readUInt16LE(8)).to.equal(0x0000);
            expect(payload.readUInt16LE(10)).to.equal(0);
            expect(payload.readUInt16LE(12)).to.equal(0x00b2);
            expect(payload.readUInt16LE(14)).to.equal(6);
            expect(decodeSendRRData(payload)).to.deep.equal(cip);
        });

        it("rejects SendRRData replies without an unconnected data item", () => {
            expect(() => decodeSendRRData(bytes(0, 0, 0, 0, 0, 0, 0, 0))).to.throw("item");
        });
    });
});
