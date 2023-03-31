/* eslint-disable no-unused-expressions */
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
import { suite, test } from "@testdeck/mocha";
import { expect, should } from "chai";
import { once, Readable } from "stream";
import { ReadableStream } from "web-streams-polyfill/ponyfill/es2018";
import ProtocolHelpers from "../src/protocol-helpers";

should();
@suite("Protocol Helpers Streams")
class ProtocolHelpersStreamTest {
    emptyNodeStream!: Readable;
    emptyWebStream!: ReadableStream<void>;
    testNodeStream!: Readable;
    testWebStream!: ReadableStream<string>;

    before() {
        this.emptyNodeStream = Readable.from([]);
        this.emptyWebStream = new ReadableStream();
        this.testNodeStream = Readable.from(["test"]);
        this.testWebStream = new ReadableStream({
            pull: (controller) => {
                controller.enqueue("test");
                controller.close();
            },
        });
    }

    @test "should convert to ReadableStream"() {
        const result = ProtocolHelpers.toWoTStream(this.emptyNodeStream);
        expect(result).to.be.instanceOf(ReadableStream);
    }

    @test async "should convert to an usable ReadableStream"() {
        const result = ProtocolHelpers.toWoTStream(this.testNodeStream);
        const reader = result.getReader();

        let totalPayload = "";
        let finished = false;
        do {
            const { done, value } = await reader.read();
            finished = done;
            totalPayload = totalPayload.concat(value ?? "");
        } while (!finished);

        expect(totalPayload).be.eql("test");
    }

    @test async "should ReadableStream be cancellable"() {
        const result = ProtocolHelpers.toWoTStream(this.testNodeStream);

        await result.cancel();

        expect(this.testNodeStream.destroyed).to.be.true;
    }

    @test "should cache Node Readable"() {
        const result = ProtocolHelpers.toWoTStream(this.emptyNodeStream);
        const second = ProtocolHelpers.toNodeStream(result);

        expect(second).to.be.eqls(this.emptyNodeStream);
    }

    @test "should convert to Node Readable"() {
        const result = ProtocolHelpers.toNodeStream(this.emptyWebStream);
        expect(result).to.be.instanceOf(Readable);
    }

    @test async "should convert to an usable Node Readable"() {
        const result = ProtocolHelpers.toNodeStream(this.testWebStream);

        let payload = "";
        for await (const data of result) {
            payload = payload.concat(data);
        }

        expect(payload).to.be.eql("test");
    }

    @test async "should Node Readable be destroyable"() {
        const result = ProtocolHelpers.toNodeStream(this.testWebStream);
        const promise = once(result, "close");
        result.destroy();

        await promise;
        expect(this.testWebStream.locked).not.be.true;
    }

    @test "should cache ReadableStream"() {
        const result = ProtocolHelpers.toNodeStream(this.emptyWebStream);
        const second = ProtocolHelpers.toWoTStream(result);

        expect(second).to.be.eqls(this.emptyWebStream);
    }
}
