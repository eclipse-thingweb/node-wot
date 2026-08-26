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

import { expect } from "chai";
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
        // KNOWN LIMITATION, and the main architectural finding of this POC.
        //
        // On READ the binding owns content negotiation end to end, because it is
        // handed raw bytes and decides what they mean. On WRITE it does not:
        // ConsumedThing.writeProperty calls ContentSerdes.valueToContent BEFORE the
        // binding is reached, so core has already chosen a codec from the global
        // media-type registry. For application/octet-stream that is the Modbus-oriented
        // OctetstreamCodec, and no binding-scoped resolution can intercept it.
        //
        // Fixing this needs the core change @egekorkan proposed in Dec 2025: let a
        // binding override content-serdes resolution. See gap G8 in
        // 06-content-types-101.md.
        it("cannot yet be intercepted on write - core serializes first", async function () {
            const c = CASES.find((x) => x.key === "ByteString");
            if (c === undefined) {
                throw new Error("missing ByteString case");
            }
            const thing = await wot.consume(makeTD(c, "application/octet-stream"));
            let message = "";
            try {
                await thing.writeProperty("v", Buffer.from([0x01, 0x02, 0x03]) as unknown as WoT.DataSchemaValue);
            } catch (err) {
                message = (err as Error).message;
            }
            // the error comes from core's OctetstreamCodec, not from the binding:
            // proof that the binding never saw this write
            expect(message, "expected core's codec to reject before the binding is reached").to.match(
                /Value is not a string/
            );
        });

        it("is refused for a non-ByteString target, naming the form", async function () {
            const c = CASES.find((x) => x.key === "Double");
            if (c === undefined) {
                throw new Error("missing Double case");
            }
            const thing = await wot.consume(makeTD(c, "application/octet-stream"));
            let message = "";
            try {
                await thing.writeProperty("v", 1.5 as WoT.DataSchemaValue);
            } catch (err) {
                message = (err as Error).message;
            }
            // core's OctetstreamCodec rejects a number before the binding is reached,
            // for the same reason as above. Either way the write is refused rather
            // than silently truncated to float32, which is the behaviour that matters.
            expect(message).to.match(/not a string|only supported when the target is a ByteString/);
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
