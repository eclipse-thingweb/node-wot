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
import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import type * as WoT from "wot-typescript-definitions";
import ModbusServer from "./test-modbus-server";
import DefaultServient from "./test-servient";

use(chaiAsPromised);

const overrideMap = [
    { "map:wire": 0, "map:app": "off" },
    { "map:wire": 1, "map:app": "open" },
    { "map:wire": 2, "map:app": "close" },
];

// Limit Violations of the Siemens SENTRON PAC4200 (analysis US5, example 3)
const limitFields: Array<[string, number, number]> = [
    ...Array.from({ length: 8 }, (_, i): [string, number, number] => [`limit${i}`, 2 ** (24 + i), 24 + i]),
    ...Array.from({ length: 4 }, (_, i): [string, number, number] => [`limit${8 + i}`, 2 ** (16 + i), 16 + i]),
    ["logicFlag", 1, 0],
    ...Array.from({ length: 4 }, (_, i): [string, number, number] => [`logicResult${1 + i}`, 2 ** (1 + i), 1 + i]),
];

function thingDescription(): WoT.ThingDescription {
    return {
        "@context": "https://www.w3.org/2022/wot/td/v1.1",
        title: "DamperActuator",
        securityDefinitions: { nosec_sc: { scheme: "nosec" } },
        security: "nosec_sc",
        properties: {
            overrideControl: {
                type: "string",
                enum: ["off", "open", "close"],
                readOnly: true,
                forms: [
                    {
                        href: "modbus+tcp://127.0.0.1:8502/1/0",
                        contentType: "application/octet-stream",
                        op: ["readproperty"],
                        "modv:entity": "HoldingRegister",
                        "map:valueMapping": { "map:fromWire": [{ "map:proc": "enum", "map:map": overrideMap }] },
                    },
                ],
            },
            batteryState: {
                type: "string",
                enum: ["low", "high"],
                readOnly: true,
                forms: [
                    {
                        href: "modbus+tcp://127.0.0.1:8502/1/1?quantity=2",
                        contentType: "application/octet-stream",
                        op: ["readproperty"],
                        "modv:entity": "HoldingRegister",
                        "octv:byteLength": 4,
                        "octv:byteOrder": "bigEndian",
                        "map:valueMapping": {
                            "map:fromWire": [
                                {
                                    "map:proc": "enumRange",
                                    "map:ranges": [
                                        { "map:min": 0, "map:max": 65535, "map:app": "low" },
                                        { "map:min": 65536, "map:max": 4294967295, "map:app": "high" },
                                    ],
                                },
                            ],
                        },
                    },
                ],
            },
            limitViolations: {
                type: "object",
                properties: Object.fromEntries(limitFields.map(([name]) => [name, { type: "boolean" }])),
                required: limitFields.map(([name]) => name),
                readOnly: true,
                forms: [
                    {
                        href: "modbus+tcp://127.0.0.1:8502/1/203?quantity=2",
                        contentType: "application/octet-stream",
                        op: ["readproperty"],
                        "modv:entity": "HoldingRegister",
                        "octv:byteLength": 4,
                        "octv:byteOrder": "bigEndian",
                        "map:valueMapping": {
                            "map:fromWire": [
                                {
                                    "map:proc": "bitExtract",
                                    "octv:fields": limitFields.map(([name, mask, shift]) => ({
                                        "octv:fieldName": name,
                                        "octv:mask": mask,
                                        "octv:shift": shift,
                                        "octv:fieldType": "boolean",
                                    })),
                                },
                            ],
                        },
                    },
                ],
            },
        },
    } as WoT.ThingDescription;
}

describe("Modbus data mapping", () => {
    let server: ModbusServer;
    let servient: DefaultServient;
    let thing: WoT.ConsumedThing;

    before(async () => {
        server = new ModbusServer(1);
        await server.start();
        servient = new DefaultServient();
        const wot = await servient.start();
        thing = await wot.consume(thingDescription());
    });

    after(async () => {
        await servient.shutdown();
        server.stop();
    });

    it("should map a holding register code to an enum string", async () => {
        server.setRegisters([2], 0);
        const output = await thing.readProperty("overrideControl");
        expect(await output.value()).to.equal("close");
    });

    it("should reject a register code without enum entry", async () => {
        server.setRegisters([7], 0);
        const output = await thing.readProperty("overrideControl");
        await expect(output.value()).to.be.rejectedWith("No enum entry matches '7'");
    });

    it("should classify a 32-bit value spanning two registers", async () => {
        server.setRegisters([0x0001, 0x0000], 1);
        const high = await thing.readProperty("batteryState");
        expect(await high.value()).to.equal("high");

        server.setRegisters([0x0000, 0xffff], 1);
        const low = await thing.readProperty("batteryState");
        expect(await low.value()).to.equal("low");
    });

    it("should extract the limit violation bitmap of two registers", async () => {
        // high register: bit 31 (limit7), bit 24 (limit0), bit 16 (limit8); low register: bit 0 and bit 4
        server.setRegisters([0x8101, 0x0011], 203);
        const output = await thing.readProperty("limitViolations");
        const expected = Object.fromEntries(limitFields.map(([name]) => [name, false]));
        Object.assign(expected, { limit0: true, limit7: true, limit8: true, logicFlag: true, logicResult4: true });
        expect(await output.value()).to.deep.equal(expected);
    });

    it("should report no violation for an all-zero bitmap", async () => {
        server.setRegisters([0x0000, 0x0000], 203);
        const output = await thing.readProperty("limitViolations");
        const value = (await output.value()) as Record<string, boolean>;
        expect(Object.values(value)).to.have.length(limitFields.length);
        expect(Object.values(value).every((flag) => !flag)).to.be.true;
    });
});
