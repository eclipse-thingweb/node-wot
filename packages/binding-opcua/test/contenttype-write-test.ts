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
// Write round-trip for application/opcua+uabinary and the views of its type parameter.
//
// The read matrices show what comes back; this shows that a value written
// through the binding survives, which is where a lossy codec does real damage:
// a bad read is a wrong number on a dashboard, a bad write is a wrong value in
// the plant.
//

import chaiAsPromised from "chai-as-promised";
import { expect, use } from "chai";

use(chaiAsPromised);
import { Servient } from "@node-wot/core";
import {
    OPCUAServer,
    DataType,
    DataValue,
    Range,
    VariantArrayType,
    UAVariable,
    VariantLike,
    makeAccessLevelFlag,
    coerceNodeId,
} from "node-opcua";
import { ReadableStream } from "web-streams-polyfill";

import { OPCUAClientFactory } from "../src";
import { decodeUABinaryDataValue, encodeUABinaryDataValue } from "../src/ua-binary";
import { startServer } from "./fixture/basic-opcua-server";

const endpoint = "opc.tcp://localhost:7890";
const UABINARY = "application/opcua+uabinary";
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

const RANGE_ID = "s=W_Range";
const NODEID_ID = "s=W_NodeId";

/** a NodeId value, which OPC UA JSON 1.05 writes with the namespace URI (`nsu=`) */
function makeNodeIdTD(contentType: string, type: string): WoT.ThingDescription {
    return {
        "@context": "https://www.w3.org/2019/wot/td/v1",
        "@type": ["Thing"],
        securityDefinitions: { nosec_sc: { scheme: "nosec" } },
        security: "nosec_sc",
        title: "write NodeId",
        base: endpoint,
        properties: {
            v: {
                type,
                forms: [{ href: `/?id=nsu=${NS};${NODEID_ID}`, op: ["readproperty", "writeproperty"], contentType }],
            },
        },
    } as unknown as WoT.ThingDescription;
}

/** a structure of namespace 0, to check that structures are refused for now (issue #1583) */
function makeRangeTD(contentType: string): WoT.ThingDescription {
    return {
        "@context": "https://www.w3.org/2019/wot/td/v1",
        "@type": ["Thing"],
        securityDefinitions: { nosec_sc: { scheme: "nosec" } },
        security: "nosec_sc",
        title: "write Range",
        base: endpoint,
        properties: {
            v: { type: "object", forms: [{ href: `/?id=nsu=${NS};${RANGE_ID}`, op: ["writeproperty"], contentType }] },
        },
    } as unknown as WoT.ThingDescription;
}

/** bytes given to writeProperty as they are: core skips the codec for a stream */
function asStream(bytes: Buffer): WoT.DataSchemaValue {
    // core recognises this polyfill's ReadableStream, not Node's built-in one
    return new ReadableStream({
        start: (controller) => {
            controller.enqueue(new Uint8Array(bytes));
            controller.close();
        },
    }) as unknown as WoT.DataSchemaValue;
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
        const range = ns.addVariable({
            browseName: "Range",
            nodeId: RANGE_ID,
            dataType: "Range",
            componentOf: folder,
            accessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite"),
            userAccessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite"),
        }) as UAVariable & { setValueFromSource(v: VariantLike): void };
        range.setValueFromSource({ dataType: DataType.ExtensionObject, value: new Range({ low: 0, high: 1 }) });
        const nodeIdVariable = ns.addVariable({
            browseName: "NodeIdValue",
            nodeId: NODEID_ID,
            dataType: "NodeId",
            componentOf: folder,
            accessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite"),
            userAccessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite"),
        }) as UAVariable & { setValueFromSource(v: VariantLike): void };
        // a namespace index of 2 or more: its value depends on the server, its URI does not
        nodeIdVariable.setValueFromSource({
            dataType: DataType.NodeId,
            value: coerceNodeId(`ns=${ns.index};s=W_Double`),
        });
        servient = new Servient();
        servient.addClientFactory(new OPCUAClientFactory());
        wot = await servient.start();
    });

    after(async function () {
        await servient.shutdown();
        await opcuaServer.shutdown();
    });

    describe("a form without contentType, or with one this binding no longer takes", function () {
        it("refuses a form without contentType, which TD 1.1 makes application/json", async function () {
            const thing = await wot.consume(makeTD(CASES[0]));
            await expect(thing.readProperty("v")).to.be.rejectedWith(
                /needs contentType 'application\/opcua\+uabinary'/
            );
        });

        it("refuses application/json", async function () {
            const thing = await wot.consume(makeTD(CASES[0], "application/json"));
            await expect(thing.writeProperty("v", 1.5 as WoT.DataSchemaValue)).to.be.rejectedWith(
                /unsupported contentType 'application\/json'/
            );
        });
    });

    describe("application/opcua+uabinary (the Value view, the default)", function () {
        // The payload is a UA Binary DataValue; value() is the decoded value.
        for (const c of CASES) {
            it(`${c.key} survives a write/read round-trip, written as a value-only DataValue`, async function () {
                const thing = await wot.consume(makeTD(c, UABINARY));
                await thing.writeProperty("v", c.write as WoT.DataSchemaValue);
                const read = await thing.readProperty("v");
                expect(await read.value()).to.deep.equal(c.expect);
            });
        }

        it("round-trips a ByteString, and arrayBuffer() is the DataValue that holds it", async function () {
            const c = CASES.find((x) => x.key === "ByteString");
            if (c === undefined) {
                throw new Error("missing ByteString case");
            }
            const thing = await wot.consume(makeTD(c, UABINARY));

            await thing.writeProperty("v", Buffer.from([0xde, 0xad, 0xbe, 0xef]) as unknown as WoT.DataSchemaValue);

            // value() reports a ByteString as base64, as OPC UA JSON does
            const read = await thing.readProperty("v");
            expect(await read.value()).to.equal("3q2+7w==");

            // the bytes are the UA Binary DataValue, the ByteString inside it
            const raw = await thing.readProperty("v");
            const dataValue = decodeUABinaryDataValue(Buffer.from(await raw.arrayBuffer()));
            expect(dataValue.value.dataType).to.equal(DataType.ByteString);
            expect(dataValue.value.value).to.deep.equal(Buffer.from([0xde, 0xad, 0xbe, 0xef]));
        });

        it("writes the bytes of a DataValue as they are when the type already matches", async function () {
            const c = CASES.find((x) => x.key === "Int32");
            if (c === undefined) {
                throw new Error("missing Int32 case");
            }
            const thing = await wot.consume(makeTD(c, UABINARY));
            const bytes = encodeUABinaryDataValue(new DataValue({ value: { dataType: DataType.Int32, value: -7 } }));
            // mask 01 (value only), type 06 (Int32), then -7
            expect(bytes.toString("hex")).to.equal("0106f9ffffff");

            await thing.writeProperty("v", asStream(bytes));

            expect(await (await thing.readProperty("v")).value()).to.equal(-7);
        });

        it("accepts a base64 string as well as a Buffer", async function () {
            const c = CASES.find((x) => x.key === "ByteString");
            if (c === undefined) {
                throw new Error("missing ByteString case");
            }
            const thing = await wot.consume(makeTD(c, UABINARY));

            await thing.writeProperty("v", "AQID" as WoT.DataSchemaValue);

            const read = await thing.readProperty("v");
            expect(await read.value()).to.equal("AQID");
        });

        it("accepts a Uint8Array as well as a Buffer", async function () {
            const c = CASES.find((x) => x.key === "ByteString");
            if (c === undefined) {
                throw new Error("missing ByteString case");
            }
            const thing = await wot.consume(makeTD(c, UABINARY));

            await thing.writeProperty("v", new Uint8Array([1, 2, 3]) as unknown as WoT.DataSchemaValue);

            const read = await thing.readProperty("v");
            expect(await read.value()).to.equal("AQID");
        });

        it("refuses a value that cannot be converted to the node's DataType, naming both", async function () {
            const c = CASES.find((x) => x.key === "Double");
            if (c === undefined) {
                throw new Error("missing Double case");
            }
            const thing = await wot.consume(makeTD(c, UABINARY));
            let message = "";
            try {
                // a valid payload, a String: the refusal can only come from the conversion
                await thing.writeProperty("v", "AQID" as WoT.DataSchemaValue);
            } catch (err) {
                message = (err as Error).message;
            }
            expect(message).to.match(/cannot convert the String/);
            expect(message).to.match(/to Double/);
        });

        it("refuses a number for a ByteString node", async function () {
            const c = CASES.find((x) => x.key === "ByteString");
            if (c === undefined) {
                throw new Error("missing ByteString case");
            }
            const thing = await wot.consume(makeTD(c, UABINARY));
            await expect(thing.writeProperty("v", 1.5 as WoT.DataSchemaValue)).to.be.rejectedWith(
                /cannot convert the Double .* to ByteString/
            );
        });

        it("refuses a structure, by value and as bytes, pointing at issue #1583", async function () {
            const thing = await wot.consume(makeRangeTD(UABINARY));
            await expect(
                thing.writeProperty("v", { Low: 0, High: 10 } as unknown as WoT.DataSchemaValue)
            ).to.be.rejectedWith(/writing a structure .* is not supported yet[\s\S]*issues\/1583/);

            const bytes = encodeUABinaryDataValue(
                new DataValue({ value: { dataType: DataType.ExtensionObject, value: new Range({ low: 0, high: 10 }) } })
            );
            await expect(thing.writeProperty("v", asStream(bytes))).to.be.rejectedWith(/not supported yet/);
        });
    });

    describe("type=Variant and type=DataValue: the same payload, a richer value()", function () {
        // OPC UA JSON 1.05 Compact (OPC 10000-6 5.4).
        function doubleCase(): WriteCase {
            const c = CASES.find((x) => x.key === "Double");
            if (c === undefined) {
                throw new Error("missing Double case");
            }
            // the views return an object, so the TD must say so: core validates what
            // value() returns against the schema
            return { ...c, wotType: "object" };
        }

        it("type=Variant gives the value and its OPC UA type", async function () {
            const thing = await wot.consume(makeTD(doubleCase(), `${UABINARY};type=Variant`));
            const read = await thing.readProperty("v");
            expect(await read.value()).to.have.keys(["UaType", "Value"]);
        });

        it("type=DataValue adds the timestamps", async function () {
            const thing = await wot.consume(makeTD(doubleCase(), `${UABINARY};type=DataValue`));
            const value = (await (await thing.readProperty("v")).value()) as Record<string, unknown>;
            expect(value).to.have.property("UaType", DataType.Double);
            expect(value.Value).to.be.a("number");
            expect(new Date(value.SourceTimestamp as string).getTime()).to.be.greaterThan(0);
        });

        it("round-trips a write through the Variant view", async function () {
            const thing = await wot.consume(makeTD(doubleCase(), `${UABINARY};type=Variant`));
            await thing.writeProperty("v", { UaType: 11, Value: 1.25 } as unknown as WoT.DataSchemaValue);
            const read = await thing.readProperty("v");
            expect(await read.value()).to.deep.equal({ UaType: 11, Value: 1.25 });
        });

        it("converts a Variant view write to the node's DataType, as the Value view does", async function () {
            const c = { ...(CASES.find((x) => x.key === "Int32") as WriteCase), wotType: "object" };
            const thing = await wot.consume(makeTD(c, `${UABINARY};type=Variant`));
            // a Double given for an Int32 node
            await thing.writeProperty("v", { UaType: 11, Value: 42 } as unknown as WoT.DataSchemaValue);
            expect(await (await thing.readProperty("v")).value()).to.deep.equal({ UaType: DataType.Int32, Value: 42 });
        });

        it("writes the value of a DataValue view", async function () {
            const thing = await wot.consume(makeTD(doubleCase(), `${UABINARY};type=DataValue`));
            await thing.writeProperty("v", { UaType: 11, Value: 2.5 } as unknown as WoT.DataSchemaValue);
            const value = (await (await thing.readProperty("v")).value()) as Record<string, unknown>;
            expect(value.Value).to.equal(2.5);
        });
    });

    describe("namespaces: OPC UA JSON 1.05 names them by URI (nsu=)", function () {
        // the binding passes the session's namespace table to the JSON encoders and decoders;
        // without it a NodeId of the server's namespace 2+ would be written ns=<index>, and an
        // nsu= NodeId would decode as a String NodeId of namespace 0
        const variant105 = `${UABINARY};type=Variant`;

        it("reads a NodeId as nsu=<uri>, and writes it back to the same node", async function () {
            const thing = await wot.consume(makeNodeIdTD(variant105, "object"));
            const read = await (await thing.readProperty("v")).value();
            expect(read).to.deep.equal({ UaType: DataType.NodeId, Value: `nsu=${NS};s=W_Double` });

            await thing.writeProperty("v", { UaType: DataType.NodeId, Value: `nsu=${NS};s=W_Int32` });
            const back = await (await thing.readProperty("v")).value();
            expect(back).to.deep.equal({ UaType: DataType.NodeId, Value: `nsu=${NS};s=W_Int32` });
        });

        it("names the namespace by URI in the Value view too", async function () {
            const value = await (await (await wot.consume(makeNodeIdTD(UABINARY, "object"))).readProperty("v")).value();
            expect(JSON.stringify(value)).to.contain(NS);
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
            expect(message).to.match(/application\/opcua\+uabinary/);
        });
    });
});
