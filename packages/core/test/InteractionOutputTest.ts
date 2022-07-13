/* eslint-disable no-unused-expressions */
/********************************************************************************
 * Copyright (c) 2018 Contributors to the Eclipse Foundation
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
import promised from "chai-as-promised";
import { expect, use } from "chai";
import { Readable } from "stream";
import { InteractionOutput } from "../src/interaction-output";

use(promised);
const delay = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

@suite("testing Interaction Output")
class InteractionOutputTests {
    @test async "should read to a Buffer"() {
        const stream = Readable.from([1, 2, 3]);
        const content = { body: stream, type: "" };

        const out = new InteractionOutput(content, {});
        const result = await out.arrayBuffer();
        expect(result).be.deep.equals(Buffer.from([1, 2, 3]));
    }

    @test async "should be readable with Streams"() {
        const stream = Readable.from([1, 2, 3]);
        const content = { body: stream, type: "" };

        const out = new InteractionOutput(content, {});
        const result = [];
        const reader = out.data.getReader();
        expect(reader).not.to.be.undefined;
        let read;
        do {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- we know it's defined: expect(reader).not.to.be.undefined
            read = await reader!.read();
            !read.done && result.push(read.value);
        } while (read.done !== true);

        expect(result).be.deep.equals([1, 2, 3]);
    }

    @test async "should throw if the stream was accessed before calling value"() {
        const stream = Readable.from([1, 2, 3]);
        const content = { body: stream, type: "application/json" };

        const out = new InteractionOutput(content, {});
        const result = [];
        const reader = out.data.getReader();
        expect(reader).not.to.be.undefined;
        let read;
        do {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- we know it's defined: expect(reader).not.to.be.undefined
            read = await reader!.read();
            !read.done && result.push(read.value);
        } while (read.done !== true);

        return expect(out.value()).to.be.rejected;
    }

    @test async "should return the value"() {
        const stream = Readable.from(Buffer.from("true", "utf-8"));
        const content = { body: stream, type: "application/json" };

        const out = new InteractionOutput(content, {}, { type: "boolean" });
        const result = await out.value<boolean>();
        expect(result).be.true;
    }

    @test async "should return the value after delay"() {
        const stream = Readable.from(Buffer.from("true", "utf-8"));
        const content = { body: stream, type: "application/json" };

        const out = new InteractionOutput(content, {}, { type: "boolean" });
        await delay(100);
        const result = await out.value<boolean>();
        expect(result).be.true;
    }

    @test async "should data be used after arrayBuffer"() {
        const stream = Readable.from(Buffer.from("true", "utf-8"));
        const content = { body: stream, type: "application/json" };

        const out = new InteractionOutput(content, {}, { type: "boolean" });
        await out.arrayBuffer();
        expect(out.dataUsed).be.true;
    }

    @test async "should data be used after data"() {
        const stream = Readable.from(Buffer.from("true", "utf-8"));
        const content = { body: stream, type: "application/json" };

        const out = new InteractionOutput(content, {}, { type: "boolean" });
        const TestOutputStream = out.data;
        expect(out.dataUsed).be.true;
    }

    @test async "should data be used after value"() {
        const stream = Readable.from(Buffer.from("true", "utf-8"));
        const content = { body: stream, type: "application/json" };

        const out = new InteractionOutput(content, {}, { type: "boolean" });
        await out.value<boolean>();
        expect(out.dataUsed).be.true;
    }

    @test async "should throw if data is used by data getter"() {
        const stream = Readable.from(Buffer.from("true", "utf-8"));
        const content = { body: stream, type: "application/json" };

        const out = new InteractionOutput(content, {}, { type: "boolean" });
        const TestOutputStream = out.data;
        await expect(out.arrayBuffer()).eventually.to.be.rejected;
        await expect(out.value()).eventually.to.be.rejected;
    }

    @test async "should throw if data is used by arrayBuffer()"() {
        const stream = Readable.from(Buffer.from("true", "utf-8"));
        const content = { body: stream, type: "application/json" };

        const out = new InteractionOutput(content, {}, { type: "boolean" });
        await out.arrayBuffer();
        expect(() => out.data).to.throw;
        await expect(out.value()).eventually.to.be.rejected;
    }

    @test async "should throw if data is used by value()"() {
        const stream = Readable.from(Buffer.from("true", "utf-8"));
        const content = { body: stream, type: "application/json" };

        const out = new InteractionOutput(content, {}, { type: "boolean" });
        await out.value();
        expect(() => out.data).to.throw;
    }

    @test async "should return value multiple times"() {
        const stream = Readable.from(Buffer.from("true", "utf-8"));
        const content = { body: stream, type: "application/json" };

        const out = new InteractionOutput(content, {}, { type: "boolean" });
        const result = await out.value<boolean>();
        expect(result).be.true;

        const result2 = await out.value<boolean>();
        expect(result2).be.true;
    }

    @test async "should fail validation"() {
        const stream = Readable.from(Buffer.from("true", "utf-8"));
        const content = { body: stream, type: "application/json" };

        const out = new InteractionOutput(content, {}, { type: "number" });
        const result = out.value<number>();
        return expect(result).to.eventually.be.rejected;
    }

    @test async "should recognize wrong data schemas"() {
        const stream = Readable.from(Buffer.from("true", "utf-8"));
        const content = { body: stream, type: "application/json" };

        const out = new InteractionOutput(content, {}, { type: { wrong: "schema" } });
        const result = out.value<number>();
        return expect(result).to.eventually.be.rejected;
    }
}
