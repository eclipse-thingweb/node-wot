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
// contentType x OPC UA data shape matrix.
//
// Companion to octet-stream-e2e-test.ts, which varies where `type` is declared.
// This one fixes the TD shape and varies the OPC UA data type instead, to show
// which shapes each contentType can actually carry.
//
// Self-contained on purpose: it registers its own namespace and variables on the
// running fixture server, so the same untracked file can be dropped into any
// checkout (master, PR #1449, WT1 WIP) without touching tracked fixtures.
//

import { Servient, createLoggers } from "@node-wot/core";
import {
    OPCUAServer,
    DataType,
    VariantArrayType,
    coerceNodeId,
    DataTypeIds,
    UAVariable,
    VariantLike,
} from "node-opcua";

import { OPCUAClientFactory } from "../src";
import { startServer } from "./fixture/basic-opcua-server";

const { info } = createLoggers("binding-opcua", "octet-stream-shapes-test");

const endpoint = "opc.tcp://localhost:7890";
const NS = "http://example.org/ShapeTest/";

// populated in before(), once the address space exists
let extensionObject1: unknown;
let extensionObject2: unknown;

interface Shape {
    key: string;
    id: string;
    uaDataType: string;
    valueRank: number;
    variant: () => VariantLike;
    wotType: string;
}

const SHAPES: Shape[] = [
    {
        key: "Double",
        id: "s=Shape_Double",
        uaDataType: "Double",
        valueRank: -1,
        variant: () => ({ dataType: DataType.Double, value: 42.5 }),
        wotType: "number",
    },
    {
        // 42.5 is exactly representable in float32, so it hides any narrowing.
        // pi is not: if the value comes back changed, the codec is not using
        // the OPC UA Double encoding.
        key: "Double(pi)",
        id: "s=Shape_DoublePi",
        uaDataType: "Double",
        valueRank: -1,
        variant: () => ({ dataType: DataType.Double, value: 3.141592653589793 }),
        wotType: "number",
    },
    {
        key: "Int64",
        id: "s=Shape_Int64",
        uaDataType: "Int64",
        valueRank: -1,
        variant: () => ({ dataType: DataType.Int64, value: 9007199254740991 }),
        wotType: "integer",
    },
    {
        key: "Int32",
        id: "s=Shape_Int32",
        uaDataType: "Int32",
        valueRank: -1,
        variant: () => ({ dataType: DataType.Int32, value: 7 }),
        wotType: "integer",
    },
    {
        key: "Boolean",
        id: "s=Shape_Boolean",
        uaDataType: "Boolean",
        valueRank: -1,
        variant: () => ({ dataType: DataType.Boolean, value: true }),
        wotType: "boolean",
    },
    {
        key: "String",
        id: "s=Shape_String",
        uaDataType: "String",
        valueRank: -1,
        variant: () => ({ dataType: DataType.String, value: "hello" }),
        wotType: "string",
    },
    {
        key: "Int32[]",
        id: "s=Shape_Int32Array",
        uaDataType: "Int32",
        valueRank: 1,
        variant: () => ({ dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: [1, 2, 3] }),
        wotType: "array",
    },
    {
        key: "Double[]",
        id: "s=Shape_DoubleArray",
        uaDataType: "Double",
        valueRank: 1,
        variant: () => ({ dataType: DataType.Double, arrayType: VariantArrayType.Array, value: [1.5, 2.5] }),
        wotType: "array",
    },
    {
        key: "LocalizedText",
        id: "s=Shape_LocalizedText",
        uaDataType: "LocalizedText",
        valueRank: -1,
        variant: () => ({ dataType: DataType.LocalizedText, value: { locale: "en", text: "Hello" } }),
        wotType: "object",
    },
    {
        key: "Variant(any)",
        id: "s=Shape_Variant",
        uaDataType: "BaseDataType",
        valueRank: -2,
        variant: () => ({ dataType: DataType.Double, value: 3.25 }),
        wotType: "number",
    },
    {
        key: "ExtensionObject",
        id: "s=Shape_ExtObj",
        uaDataType: "Argument",
        valueRank: -1,
        variant: () => ({ dataType: DataType.ExtensionObject, value: extensionObject1 }),
        wotType: "object",
    },
    {
        key: "ExtensionObject[]",
        id: "s=Shape_ExtObjArray",
        uaDataType: "Argument",
        valueRank: 1,
        variant: () => ({
            dataType: DataType.ExtensionObject,
            arrayType: VariantArrayType.Array,
            value: [extensionObject1, extensionObject2],
        }),
        wotType: "array",
    },
];

const CONTENT_TYPES: { key: string; contentType?: string; overrideType?: string }[] = [
    { key: "(omitted)", contentType: undefined },
    { key: "octet-stream", contentType: "application/octet-stream" },
    { key: "opcua+json", contentType: "application/opcua+json" },
    // used correctly: ask for the bare value, so the TD schema still matches
    { key: "opcua+json;Value", contentType: "application/opcua+json;type=Value" },
    // ask for the full DataValue, and declare an object schema to match
    { key: "opcua+json;DataValue", contentType: "application/opcua+json;type=DataValue", overrideType: "object" },
    // true OPC UA Binary, under the vendor-prefixed media type
    { key: "opcua+octet-stream", contentType: "application/opcua+octet-stream", overrideType: "object" },
];

interface Cell {
    shape: string;
    ct: string;
    ok: boolean;
    rendered?: string;
    /** what JS type value() actually handed back */
    jsType?: string;
    /** raw bytes on the wire, from arrayBuffer(), as hex */
    hex?: string;
    error?: string;
}

function jsTypeOf(v: unknown): string {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (Buffer.isBuffer(v)) return `Buffer(${(v as Buffer).length})`;
    if (v instanceof Uint8Array) return `Uint8Array(${v.length})`;
    if (Array.isArray(v)) return `Array(${v.length})`;
    const t = typeof v;
    if (t === "object") return (v as object).constructor?.name ?? "object";
    return t;
}

function toHex(buf: ArrayBuffer): string {
    const b = Buffer.from(buf);
    const head = b.subarray(0, 12);
    const hex = head.toString("hex").replace(/(..)/g, "$1 ").trim();
    return b.length > 12 ? `${hex} ... (${b.length}B)` : `${hex} (${b.length}B)`;
}

function makeTD(shape: Shape, contentType?: string, overrideType?: string): WoT.ThingDescription {
    const wotType = overrideType ?? shape.wotType;
    const form: Record<string, unknown> = {
        href: `/?id=nsu=${NS};${shape.id}`,
        op: ["readproperty"],
        // declare type on the form too: the e2e matrix showed octet-stream needs both
        type: wotType,
    };
    if (contentType !== undefined) {
        form.contentType = contentType;
    }
    return {
        "@context": "https://www.w3.org/2019/wot/td/v1",
        "@type": ["Thing"],
        securityDefinitions: { nosec_sc: { scheme: "nosec" } },
        security: "nosec_sc",
        title: `shape ${shape.key}`,
        base: endpoint,
        properties: {
            v: {
                type: wotType,
                readOnly: true,
                forms: [form],
            },
        },
    } as unknown as WoT.ThingDescription;
}

function render(v: unknown): string {
    let s: string;
    try {
        s = JSON.stringify(v);
    } catch {
        s = String(v);
    }
    if (s === undefined) {
        s = String(v);
    }
    return s.length > 38 ? s.slice(0, 35) + "..." : s;
}

describe("contentType x data shape matrix (issue #1400)", function () {
    this.timeout(120000);

    let opcuaServer: OPCUAServer;
    let servient: Servient;
    let wot: typeof WoT;
    const cells: Cell[] = [];

    before(async function () {
        opcuaServer = await startServer();

        const addressSpace = opcuaServer.engine.addressSpace;
        if (!addressSpace) {
            throw new Error("no address space");
        }

        extensionObject1 = addressSpace.constructExtensionObject(coerceNodeId(DataTypeIds.Argument), {
            name: "Arg1",
            dataType: coerceNodeId("i=6"),
            valueRank: -1,
            description: { text: "first argument" },
        });
        extensionObject2 = addressSpace.constructExtensionObject(coerceNodeId(DataTypeIds.Argument), {
            name: "Arg2",
            dataType: coerceNodeId("i=11"),
            valueRank: -1,
            description: { text: "second argument" },
        });

        const ns = addressSpace.registerNamespace(NS);
        const folder = ns.addObject({
            browseName: "ShapeTestObject",
            organizedBy: addressSpace.rootFolder.objects,
        });

        for (const shape of SHAPES) {
            const v = ns.addVariable({
                browseName: shape.key.replace(/[^A-Za-z0-9]/g, "_"),
                nodeId: shape.id,
                dataType: shape.uaDataType,
                valueRank: shape.valueRank,
                componentOf: folder,
            }) as UAVariable & { setValueFromSource(v: VariantLike): void };
            v.setValueFromSource(shape.variant());
        }

        servient = new Servient();
        servient.addClientFactory(new OPCUAClientFactory());
        wot = await servient.start();
    });

    after(async function () {
        await servient.shutdown();
        await opcuaServer.shutdown();

        const line = (t: string) => console.info(t);
        line("");
        line("=== contentType x OPC UA data shape ===");
        line("  shape                 " + CONTENT_TYPES.map((c) => c.key.padEnd(30)).join(""));
        for (const shape of SHAPES) {
            const row = CONTENT_TYPES.map((c) => {
                const cell = cells.find((x) => x.shape === shape.key && x.ct === c.key);
                if (!cell) {
                    return "?".padEnd(30);
                }
                const txt = cell.ok ? "OK " + cell.rendered : "THROW " + (cell.error ?? "");
                return (txt.length > 29 ? txt.slice(0, 26) + "..." : txt).padEnd(30);
            }).join("");
            line("  " + shape.key.padEnd(22) + row);
        }

        for (const c of CONTENT_TYPES) {
            line("");
            line(`--- ${c.key}: what value() returns, and the raw bytes on the wire ---`);
            line("  shape                 jsType            value / error                  wire bytes");
            for (const shape of SHAPES) {
                const cell = cells.find((x) => x.shape === shape.key && x.ct === c.key);
                if (!cell) {
                    continue;
                }
                const v = cell.ok ? (cell.rendered ?? "") : "THROW " + (cell.error ?? "");
                line(
                    "  " +
                        shape.key.padEnd(22) +
                        (cell.jsType ?? "-").padEnd(18) +
                        (v.length > 29 ? v.slice(0, 26) + "..." : v).padEnd(31) +
                        (cell.hex ?? "-")
                );
            }
        }
        line("");
    });

    for (const shape of SHAPES) {
        for (const ct of CONTENT_TYPES) {
            it(`${shape.key} as ${ct.key}`, async function () {
                const cell: Cell = { shape: shape.key, ct: ct.key, ok: false };
                const thing = await wot.consume(makeTD(shape, ct.contentType, ct.overrideType));

                // raw bytes first, on their own read: this is what actually crossed the wire
                try {
                    const rawRead = await thing.readProperty("v");
                    cell.hex = toHex(await rawRead.arrayBuffer());
                } catch (err) {
                    cell.hex = "n/a";
                }

                try {
                    const read = await thing.readProperty("v");
                    const value = await read.value();
                    cell.ok = true;
                    cell.rendered = render(value);
                    cell.jsType = jsTypeOf(value);
                } catch (err) {
                    cell.error = (err as Error).message;
                }
                cells.push(cell);
                info(`${shape.key} / ${ct.key}: ${cell.ok ? "OK" : "THROW"}`);
            });
        }
    }
});
