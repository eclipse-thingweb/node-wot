/********************************************************************************
 * Copyright (c) 2018 - 2021 Contributors to the Eclipse Foundation
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
import { expect } from "chai";
import {use} from 'chai';
import {Readable} from 'stream';
import { InteractionOutput } from "../src/interaction-output";

use(promised)

@suite("testing Interaction Output")
class InteractionOutputTests {
    @test async "should read to a Buffer"() {
        const stream = Readable.from([1, 2, 3]);
        const content = {body: stream ,type : ""};

        const out = new InteractionOutput(content,{});
        const result = await out.arrayBuffer();
        expect(result).be.deep.equals(Buffer.from([1, 2, 3]));
    }

    @test async "should be readable with Streams"() {
        const stream = Readable.from([1, 2, 3]);
        const content = { body: stream, type: "" };

        const out = new InteractionOutput(content, {});
        const result = []
        const reader = out.data.getReader();
        let read;
        do{
            read = await reader.read();
            !read.done && result.push(read.value);
        }while(read.done !== true);

        expect(result).be.deep.equals([1,2,3]);
        
    }

    @test async "should return the value"() {
        const stream = Readable.from(Buffer.from("true","utf-8"));
        const content = { body: stream, type: "application/json" };

        const out = new InteractionOutput(content, {},{type:"boolean"});
        const result = await out.value<boolean>();
        expect(result).be.true;
    }

    @test async "should data be used after value"() {
        const stream = Readable.from(Buffer.from("true", "utf-8"));
        const content = { body: stream, type: "application/json" };

        const out = new InteractionOutput(content, {}, { type: "boolean" });
        const result = await out.arrayBuffer();
        expect(out.dataUsed).be.true;
    }
    @test async "should data be used after arrayBuffer"() {
        const stream = Readable.from(Buffer.from("true", "utf-8"));
        const content = { body: stream, type: "application/json" };

        const out = new InteractionOutput(content, {}, { type: "boolean" });
        const result = await out.value<boolean>();
        expect(out.dataUsed).be.true;
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

        const out = new InteractionOutput(content, {}, { type: { wrong: "schema"} });
        const result = out.value<number>();
        return expect(result).to.eventually.be.rejected;
    }
}