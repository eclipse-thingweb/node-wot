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
import * as fs from "fs";
import * as path from "path";
import { Servient } from "@node-wot/core";
import EipClientFactory from "../src/eip-client-factory";
import { STRUCTURE_TYPE_CODE } from "../src/eip-protocol";
import { FakeEipServer } from "./fake-eip-server";

describe("EtherNet/IP binding in a servient", () => {
    const server = new FakeEipServer();
    const servient = new Servient();
    let thing: WoT.ConsumedThing;

    before(async () => {
        const port = await server.start();
        servient.addClientFactory(new EipClientFactory());
        const wot = await servient.start();

        const td = JSON.parse(
            fs.readFileSync(path.join(__dirname, "../../../examples/eip-binding/Rockwell.td.jsonld"), "utf8")
        );
        td.base = `eip://127.0.0.1:${port}/1,0/`;
        thing = await wot.consume(td);
    });

    after(async () => {
        await servient.shutdown();
        await server.stop();
    });

    beforeEach(() => {
        server.reset();
    });

    it("reads a structured property of the sample TD", async () => {
        const data = Buffer.alloc(36);
        data.writeInt32LE(100, 0);
        data.writeInt32LE(3, 4);
        data.writeFloatLE(12.5, 8);
        data.writeInt32LE(600, 32);
        server.addTag("Production_Data", STRUCTURE_TYPE_CODE, 36, data, 0x1111);

        const value = (await (await thing.readProperty("Production_Data")).value()) as Record<string, number>;
        expect(value.Prodution_Count).to.equal(100);
        expect(value.Rejected_Product_Count).to.equal(3);
        expect(value.Cycle_Time).to.equal(12.5);
        expect(value.Time_In_Shift).to.equal(600);
        expect(server.requests[0].route).to.deep.equal(Buffer.from([1, 0]));
    });

    it("resolves a relative href with colons against the base", async () => {
        const data = Buffer.alloc(4);
        data.writeInt32LE(7);
        server.addTag("Local:2:O", STRUCTURE_TYPE_CODE, 4, data, 0x2222);

        const value = await (await thing.readProperty("Local:2:O")).value();
        expect(value).to.deep.equal({ Data: 7 });
        expect(server.requests[0].tag).to.equal("Local:2:O");
    });

    it("writes a structured property", async () => {
        const tag = server.addTag("IO_Control", STRUCTURE_TYPE_CODE, 16, Buffer.alloc(16), 0x3333);

        await thing.writeProperty("IO_Control", {
            Set_LEDControl: 1,
            Set_Speed: 1500,
            Sts_LEDMode: 2,
            Sts_Speed: 3,
        });

        expect(tag.data.readInt32LE(0)).to.equal(1);
        expect(tag.data.readInt32LE(4)).to.equal(1500);
        expect(tag.data.readInt32LE(8)).to.equal(2);
        expect(tag.data.readInt32LE(12)).to.equal(3);
    });

    it("observes a property", async () => {
        const data = Buffer.alloc(16);
        data.writeInt32LE(1500, 4);
        server.addTag("IO_Control", STRUCTURE_TYPE_CODE, 16, data, 0x3333);

        const samples: unknown[] = [];
        const subscription = await thing.observeProperty("IO_Control", async (output) => {
            samples.push(await output.value());
        });
        const start = Date.now();
        while (samples.length === 0 && Date.now() - start < 3000) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        await subscription.stop();

        expect(samples[0]).to.deep.equal({ Set_LEDControl: 0, Set_Speed: 1500, Sts_LEDMode: 0, Sts_Speed: 0 });
    });
});
