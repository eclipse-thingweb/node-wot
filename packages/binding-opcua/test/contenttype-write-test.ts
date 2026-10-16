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

//
// Write round-trip per contentType flavour.
//
// The read matrices show what comes back; this shows that a value written
// through the binding survives, which is where a lossy codec does real damage:
// a bad read is a wrong number on a dashboard, a bad write is a wrong value in
// the plant.
//

import chaiAsPromised from "chai-as-promised";
import { expect, use } from "chai";

use(chaiAsPromised);
import { Servient, createLoggers } from "@node-wot/core";
import { OPCUAServer, DataType, VariantArrayType, UAVariable, VariantLike, makeAccessLevelFlag } from "node-opcua";

import { OPCUAClientFactory } from "../src";
import { startServer } from "./fixture/basic-opcua-server";

const { info } = createLoggers("binding-opcua", "contenttype-write-test");

const endpoint = "opc.tcp://localhost:7890";
const NS = "http://example.org/WriteTest/";

interface WriteCase {
    key: string;
    id: string;
    uaDataType: string;
    initial: VariantLike;
    wotType: string;
    /** value to write, as the WoT application would supply it */
    write: unknown;
    /** what we expect to read back */
    expect: unknown;
}

const CASES: WriteCase[] = [
    {
        key: "Double",
        id: "s=W_Double",
        uaDataType: "Double",
        initial: { dataType: DataType.Double, value: 0 },
        wotType: "number",
        write: 3.141592653589793,
        // full 64-bit precision must survive; a float32 round-trip would give
        // 3.1415927410125732 instead
        expect: 3.141592653589793,
    },
    {
        key: "Int32",
        id: "s=W_Int32",
        uaDataType: "Int32",
        initial: { dataType: DataType.Int32, value: 0 },
        wotType: "integer",
        write: -12345,
        expect: -12345,
    },
    {
        key: "Int64",
        id: "s=W_Int64",
        uaDataType: "Int64",
        initial: { dataType: DataType.Int64, arrayType: VariantArrayType.Scalar, value: [0, 0] },
        wotType: "string",
        // 2^53 + 1: not representable as a JS number, so it must travel as a string
        write: "9007199254740993",
        expect: "9007199254740993",
    },
    {
        key: "String",
        id: "s=W_String",
        uaDataType: "String",
        initial: { dataType: DataType.String, value: "" },
        wotType: "string",
        write: "hello wörld",
        expect: "hello wörld",
    },
    {
        key: "Boolean",
        id: "s=W_Boolean",
        uaDataType: "Boolean",
        initial: { dataType: DataType.Boolean, value: false },
        wotType: "boolean",
        write: true,
        expect: true,
    },
    {
        key: "ByteString",
        id: "s=W_ByteString",
        uaDataType: "ByteString",
        initial: { dataType: DataType.ByteString, value: Buffer.alloc(0) },
        wotType: "string",
        // JSON carries a ByteString as base64
        write: "3q2+7w==",
        expect: "3q2+7w==",
    },
];

function makeTD(c: WriteCase, contentType?: string): WoT.ThingDescription {
    const form: Record<string, unknown> = {
        href: `/?id=nsu=${NS};${c.id}`,
        op: ["readproperty", "writeproperty"],
        type: c.wotType,
    };
    if (contentType !== undefined) {
        form.contentType = contentType;
    }
    return {
        "@context": "https://www.w3.org/2019/wot/td/v1",
        "@type": ["Thing"],
        securityDefinitions: { nosec_sc: { scheme: "nosec" } },
        security: "nosec_sc",
        title: `write ${c.key}`,
        base: endpoint,
        properties: { v: { type: c.wotType, forms: [form] } },
    } as unknown as WoT.ThingDescription;
}

describe("contentType write round-trip", function () {
    this.timeout(120000);

    let opcuaServer: OPCUAServer;
    let servient: Servient;
    let wot: typeof WoT;

    before(async function () {
        opcuaServer = await startServer();
        const addressSpace = opcuaServer.engine.addressSpace;
        if (!addressSpace) {
            throw new Error("no address space");
        }
        const ns = addressSpace.registerNamespace(NS);
        const folder = ns.addObject({
            browseName: "WriteTestObject",
            organizedBy: addressSpace.rootFolder.objects,
        });
        for (const c of CASES) {
            const v = ns.addVariable({
                browseName: c.key,
                nodeId: c.id,
                dataType: c.uaDataType,
                componentOf: folder,
                accessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite"),
                userAccessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite"),
            }) as UAVariable & { setValueFromSource(v: VariantLike): void };
            v.setValueFromSource(c.initial);
        }
        servient = new Servient();
        servient.addClientFactory(new OPCUAClientFactory());
        wot = await servient.start();
    });

    after(async function () {
        await servient.shutdown();
        await opcuaServer.shutdown();
    });

    describe("application/json (bare value, the default)", function () {
        for (const c of CASES) {
            it(`${c.key} survives a write/read round-trip`, async function () {
                const thing = await wot.consume(makeTD(c));
                await thing.writeProperty("v", c.write as WoT.DataSchemaValue);
                const read = await thing.readProperty("v");
                const got = await read.value();
                info(`${c.key}: wrote ${JSON.stringify(c.write)} read ${JSON.stringify(got)}`);
                expect(got).to.deep.equal(c.expect);
            });
        }
    });

    describe("application/opcua+json;type=Value", function () {
        for (const c of CASES) {
            it(`${c.key} survives a write/read round-trip`, async function () {
                const thing = await wot.consume(makeTD(c, "application/opcua+json;type=Value"));
                await thing.writeProperty("v", c.write as WoT.DataSchemaValue);
                const read = await thing.readProperty("v");
                expect(await read.value()).to.deep.equal(c.expect);
            });
        }
    });

    describe("application/octet-stream", function () {
        // The binding registers OpcuaByteStringCodec for the opc.tcp scheme (core #1409,
        // PR #1572), so OPC UA content no longer reaches the generic OctetstreamCodec,
        // which packs Modbus registers. Before that, core serialized the write before the
        // binding was called and this test could only record the failure.
        it("round-trips a ByteString as raw bytes", async function () {
            const c = CASES.find((x) => x.key === "ByteString");
            if (c === undefined) {
                throw new Error("missing ByteString case");
            }
            const thing = await wot.consume(makeTD(c, "application/octet-stream"));

            await thing.writeProperty("v", Buffer.from([0xde, 0xad, 0xbe, 0xef]) as unknown as WoT.DataSchemaValue);

            // value() reports base64, the same as the JSON flavours
            const read = await thing.readProperty("v");
            expect(await read.value()).to.equal("3q2+7w==");

            // and the bytes themselves are untouched
            const raw = await thing.readProperty("v");
            expect(Buffer.from(await raw.arrayBuffer())).to.deep.equal(Buffer.from([0xde, 0xad, 0xbe, 0xef]));
        });

        it("accepts a base64 string as well as a Buffer", async function () {
            const c = CASES.find((x) => x.key === "ByteString");
            if (c === undefined) {
                throw new Error("missing ByteString case");
            }
            const thing = await wot.consume(makeTD(c, "application/octet-stream"));

            await thing.writeProperty("v", "AQID" as WoT.DataSchemaValue);

            const read = await thing.readProperty("v");
            expect(await read.value()).to.equal("AQID");
        });

        it("accepts a Uint8Array as well as a Buffer", async function () {
            const c = CASES.find((x) => x.key === "ByteString");
            if (c === undefined) {
                throw new Error("missing ByteString case");
            }
            const thing = await wot.consume(makeTD(c, "application/octet-stream"));

            await thing.writeProperty("v", new Uint8Array([1, 2, 3]) as unknown as WoT.DataSchemaValue);

            const read = await thing.readProperty("v");
            expect(await read.value()).to.equal("AQID");
        });

        it("is refused for a non-ByteString target, naming the form and the OPC UA type", async function () {
            const c = CASES.find((x) => x.key === "Double");
            if (c === undefined) {
                throw new Error("missing Double case");
            }
            const thing = await wot.consume(makeTD(c, "application/octet-stream"));
            let message = "";
            try {
                // valid octet-stream payload, so the codec is happy and the refusal can only
                // come from the binding noticing that the target is not a ByteString
                await thing.writeProperty("v", "AQID" as WoT.DataSchemaValue);
            } catch (err) {
                message = (err as Error).message;
            }
            expect(message).to.match(/only supported when the target is a ByteString/);
            expect(message).to.match(/Double/);
        });

        it("refuses a value that is not bytes at all, naming what it got", async function () {
            const c = CASES.find((x) => x.key === "ByteString");
            if (c === undefined) {
                throw new Error("missing ByteString case");
            }
            const thing = await wot.consume(makeTD(c, "application/octet-stream"));
            let message = "";
            try {
                await thing.writeProperty("v", 1.5 as WoT.DataSchemaValue);
            } catch (err) {
                message = (err as Error).message;
            }
            expect(message).to.match(/must be a Buffer, a Uint8Array or a base64 string/);
        });
    });

    describe("OPC UA JSON edition (version parameter)", function () {
        // 1.04 is the deprecated Reversible/NonReversible pair, 1.05 the Compact/Verbose one
        // that replaced it (OPC 10000-6 5.4). See doc/opcua-json-encoding.md.
        function doubleCase(): WriteCase {
            const c = CASES.find((x) => x.key === "Double");
            if (c === undefined) {
                throw new Error("missing Double case");
            }
            // the envelope flavours return an object, so the TD must say so: core
            // validates what value() returns against the schema
            return { ...c, wotType: "object" };
        }

        it("1.04 is the default and names the Variant fields Type and Body", async function () {
            const thing = await wot.consume(makeTD(doubleCase(), "application/opcua+json;type=Variant"));
            const read = await thing.readProperty("v");
            expect(await read.value()).to.have.keys(["Type", "Body"]);
        });

        it("version=1.05 names them UaType and Value", async function () {
            const thing = await wot.consume(makeTD(doubleCase(), "application/opcua+json;type=Variant;version=1.05"));
            const read = await thing.readProperty("v");
            expect(await read.value()).to.have.keys(["UaType", "Value"]);
        });

        it("version=1.05 flattens the DataValue onto the value", async function () {
            const thing = await wot.consume(makeTD(doubleCase(), "application/opcua+json;type=DataValue;version=1.05"));
            const read = await thing.readProperty("v");
            const value = (await read.value()) as Record<string, unknown>;
            expect(value).to.have.property("UaType");
            expect(value).to.have.property("SourceTimestamp");
            // 1.04 nests the Variant under "Value"; 1.05 puts the value itself there
            expect(value.Value).to.be.a("number");
        });

        it("round-trips a write in 1.05", async function () {
            const c = doubleCase();
            const thing = await wot.consume(makeTD(c, "application/opcua+json;type=Variant;version=1.05"));
            await thing.writeProperty("v", { UaType: 11, Value: 1.25 } as unknown as WoT.DataSchemaValue);
            const read = await thing.readProperty("v");
            expect(await read.value()).to.deep.equal({ UaType: 11, Value: 1.25 });
        });

        it("accepts the other edition on write, whatever the form says", async function () {
            const c = doubleCase();
            // form says 1.05, payload is 1.04: decoding follows the payload
            const thing105 = await wot.consume(makeTD(c, "application/opcua+json;type=Variant;version=1.05"));
            await thing105.writeProperty("v", { Type: 11, Body: 2.5 } as unknown as WoT.DataSchemaValue);
            expect(await (await thing105.readProperty("v")).value()).to.deep.equal({ UaType: 11, Value: 2.5 });

            // and the reverse
            const thing104 = await wot.consume(makeTD(c, "application/opcua+json;type=Variant"));
            await thing104.writeProperty("v", { UaType: 11, Value: 3.5 } as unknown as WoT.DataSchemaValue);
            expect(await (await thing104.readProperty("v")).value()).to.deep.equal({ Type: 11, Body: 3.5 });
        });

        it("refuses an unknown version, and mode without 1.05", async function () {
            const c = doubleCase();
            const bad = await wot.consume(makeTD(c, "application/opcua+json;type=Variant;version=1.06"));
            await expect(bad.readProperty("v")).to.be.rejectedWith(/unsupported 'version' parameter/);

            const modeOn104 = await wot.consume(makeTD(c, "application/opcua+json;type=Variant;mode=verbose"));
            await expect(modeOn104.readProperty("v")).to.be.rejectedWith(/'mode' parameter belongs to/);
        });
    });

    describe("unsupported contentType", function () {
        it("is refused with a message listing what is supported", async function () {
            const c = CASES[0];
            const thing = await wot.consume(makeTD(c, "application/xml"));
            let message = "";
            try {
                await thing.writeProperty("v", 1.5 as WoT.DataSchemaValue);
            } catch (err) {
                message = (err as Error).message;
            }
            expect(message).to.match(/unsupported contentType/);
            expect(message).to.match(/application\/opcua\+json/);
        });
    });
});
