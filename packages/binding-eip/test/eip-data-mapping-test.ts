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
import { Servient } from "@node-wot/core";
import EipClientFactory from "../src/eip-client-factory";
import { STRUCTURE_TYPE_CODE } from "../src/eip-protocol";
import { FakeEipServer } from "./fake-eip-server";

chai.use(chaiAsPromised);

const DWORD = 0xd3;

describe("EtherNet/IP binding with map:valueMapping", () => {
    const server = new FakeEipServer();
    const servient = new Servient();
    let thing: WoT.ConsumedThing;

    before(async () => {
        const port = await server.start();
        servient.addClientFactory(new EipClientFactory());
        const wot = await servient.start();
        thing = await wot.consume({
            "@context": [
                "https://www.w3.org/2022/wot/td/v1.1",
                {
                    map: "https://example.org/wot/data-mapping/v1#",
                    octv: "https://example.org/wot/payload-binding/octet-stream/v1#",
                    eipv: "https://www.w3.org/2026/wot/eip",
                },
            ],
            title: "Mapped controller",
            securityDefinitions: { nosec_sc: { scheme: "nosec" } },
            security: "nosec_sc",
            base: `eip://127.0.0.1:${port}/1,0/`,
            properties: {
                LimitViolations: {
                    type: "object",
                    readOnly: true,
                    properties: {
                        limit0: { type: "boolean" },
                        limit1: { type: "boolean" },
                        logicFlag: { type: "boolean" },
                    },
                    forms: [
                        {
                            href: "LimitViolations",
                            op: ["readproperty"],
                            "eipv:type": "eipv:DWORD",
                            "map:valueMapping": {
                                "map:fromWire": [
                                    {
                                        "map:proc": "bitExtract",
                                        "octv:fields": [
                                            {
                                                "octv:fieldName": "limit0",
                                                "octv:mask": 16777216,
                                                "octv:shift": 24,
                                                "octv:fieldType": "boolean",
                                            },
                                            {
                                                "octv:fieldName": "limit1",
                                                "octv:mask": 33554432,
                                                "octv:shift": 25,
                                                "octv:fieldType": "boolean",
                                            },
                                            {
                                                "octv:fieldName": "logicFlag",
                                                "octv:mask": 1,
                                                "octv:shift": 0,
                                                "octv:fieldType": "boolean",
                                            },
                                        ],
                                    },
                                ],
                            },
                        },
                    ],
                },
                Drive: {
                    type: "object",
                    readOnly: true,
                    properties: {
                        Mode: { type: "string", enum: ["off", "auto", "manual"] },
                        Speed: { type: "integer" },
                    },
                    forms: [
                        {
                            href: "Drive",
                            op: ["readproperty"],
                            "eipv:structureDefinition": {
                                "eipv:typeName": "Drive",
                                "eipv:fields": [
                                    { "eipv:name": "Mode", "eipv:type": "eipv:DINT", "eipv:byteOffset": 0 },
                                    { "eipv:name": "Speed", "eipv:type": "eipv:DINT", "eipv:byteOffset": 4 },
                                ],
                            },
                            "map:valueMapping": {
                                "map:fromWire": [
                                    {
                                        "map:proc": "enum",
                                        "map:name": "Mode",
                                        "map:map": [
                                            { "map:wire": 0, "map:app": "off" },
                                            { "map:wire": 1, "map:app": "auto" },
                                            { "map:wire": 2, "map:app": "manual" },
                                        ],
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        });
    });

    after(async () => {
        await servient.shutdown();
        await server.stop();
    });

    beforeEach(() => {
        server.reset();
    });

    function drive(mode: number, speed: number): Buffer {
        const data = Buffer.alloc(8);
        data.writeInt32LE(mode, 0);
        data.writeInt32LE(speed, 4);
        return data;
    }

    it("extracts named booleans from an unsigned status word with bitExtract", async () => {
        const word = Buffer.alloc(4);
        word.writeUInt32LE(((1 << 24) | 1) >>> 0);
        server.addTag("LimitViolations", DWORD, 4, word);

        const value = await (await thing.readProperty("LimitViolations")).value();
        expect(value).to.deep.equal({ limit0: true, limit1: false, logicFlag: true });
    });

    it("maps a structure member to its application value with enum and map:name", async () => {
        server.addTag("Drive", STRUCTURE_TYPE_CODE, 8, drive(1, 1500), 0x1111);

        const value = await (await thing.readProperty("Drive")).value();
        expect(value).to.deep.equal({ Mode: "auto", Speed: 1500 });
    });

    it("rejects a wire value without an enum entry", async () => {
        server.addTag("Drive", STRUCTURE_TYPE_CODE, 8, drive(9, 0), 0x1111);

        const output = await thing.readProperty("Drive");
        await expect(output.value()).to.be.rejectedWith("No enum entry matches '9'");
    });
});
