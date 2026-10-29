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
import * as dgram from "dgram";
import { discoverControllers, encodeListIdentity, parseListIdentityReply, subnetBroadcast } from "../src/eip-discovery";
import { LIST_IDENTITY_REPLY } from "./eip-browse-fixtures";

const reply = Buffer.from(LIST_IDENTITY_REPLY, "hex");

describe("EtherNet/IP discovery", () => {
    describe("ListIdentity messages", () => {
        it("encodes a request as a zeroed encapsulation header with command 0x63", () => {
            const request = encodeListIdentity();
            expect(request).to.have.length(24);
            expect(request.readUInt16LE(0)).to.equal(0x63);
            expect(request.subarray(2).every((byte) => byte === 0)).to.equal(true);
        });

        it("decodes the reply of a 1756-L81E/B", () => {
            expect(parseListIdentityReply(reply)).to.deep.equal({
                vendorId: 1,
                deviceType: 0x0e,
                productCode: 164,
                revision: { major: 30, minor: 11 },
                status: 0x1160,
                serialNumber: 0x00d70a2e,
                productName: "1756-L81E/B",
            });
        });

        it("ignores datagrams that are not valid replies", () => {
            const otherCommand = Buffer.from(reply);
            otherCommand.writeUInt16LE(0x65, 0);
            const failed = Buffer.from(reply);
            failed.writeUInt32LE(1, 8);
            const noItems = Buffer.from(reply);
            noItems.writeUInt16LE(0, 24);
            const otherItem = Buffer.from(reply);
            otherItem.writeUInt16LE(0x0086, 26);

            expect(parseListIdentityReply(otherCommand)).to.equal(undefined);
            expect(parseListIdentityReply(failed)).to.equal(undefined);
            expect(parseListIdentityReply(noItems)).to.equal(undefined);
            expect(parseListIdentityReply(otherItem)).to.equal(undefined);
            expect(parseListIdentityReply(reply.subarray(0, 40))).to.equal(undefined);
            expect(parseListIdentityReply(Buffer.alloc(0))).to.equal(undefined);
            expect(parseListIdentityReply(encodeListIdentity())).to.equal(undefined);
        });
    });

    it("computes the subnet broadcast address", () => {
        expect(subnetBroadcast("192.168.100.5", "255.255.255.0")).to.equal("192.168.100.255");
        expect(subnetBroadcast("10.1.2.3", "255.255.0.0")).to.equal("10.1.255.255");
        expect(subnetBroadcast("172.16.5.130", "255.255.255.128")).to.equal("172.16.5.255");
    });

    describe("on the network", () => {
        let responder: dgram.Socket;
        let port: number;
        let received: Buffer[];
        let answers: Buffer[];

        before(async () => {
            responder = dgram.createSocket("udp4");
            responder.on("message", (message, sender) => {
                received.push(message);
                for (const answer of answers) responder.send(answer, sender.port, sender.address);
            });
            await new Promise<void>((resolve) => responder.bind(0, "127.0.0.1", resolve));
            port = responder.address().port;
        });

        after(() => {
            responder.close();
        });

        beforeEach(() => {
            received = [];
            answers = [reply];
        });

        function discover(timeout = 200) {
            return discoverControllers({ broadcastAddress: "127.0.0.1", localAddress: "127.0.0.1", port, timeout });
        }

        it("finds a controller and builds its base URI", async () => {
            const found = await discover();
            expect(received).to.have.length(1);
            expect(received[0]).to.deep.equal(encodeListIdentity());
            expect(found).to.have.length(1);
            expect(found[0]).to.deep.include({
                host: "127.0.0.1",
                port,
                baseUri: `eip://127.0.0.1:${port}/1,0/`,
                controller: "ControlLogix",
            });
            expect(found[0].identity.productName).to.equal("1756-L81E/B");
        });

        it("lists one entry per device and skips garbage", async () => {
            answers = [Buffer.from("not a reply"), reply, reply];
            expect(await discover()).to.have.length(1);
        });

        it("returns nothing when no device answers", async () => {
            answers = [];
            expect(await discover(100)).to.deep.equal([]);
        });

        it("does not mark a device that is not a Logix controller", async () => {
            const drive = Buffer.from(reply);
            drive.writeUInt16LE(2, 24 + 2 + 2 + 2 + 2 + 16);
            answers = [drive];
            const found = await discover();
            expect(found).to.have.length(1);
            expect(found[0].identity.vendorId).to.equal(2);
            expect(found[0].controller).to.equal(undefined);
        });
    });
});
