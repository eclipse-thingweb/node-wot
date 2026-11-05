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
// Companion to contenttype-e2e-test.ts, which varies where `type` is declared.
// This one fixes the TD shape and varies the OPC UA data type instead, to show
// what each view of application/opcua+uabinary gives for each shape.
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
    StatusCodes,
    coerceLocalizedText,
    nodesets,
} from "node-opcua";
import { expect } from "chai";

import { OPCUAClientFactory } from "../src";
import { decodeUABinaryDataValue } from "../src/ua-binary";
import { startServer } from "./fixture/basic-opcua-server";
import { printTable, shortVerdict, truncate } from "./report-table";

const { info } = createLoggers("binding-opcua", "contenttype-shapes-test");

const endpoint = "opc.tcp://localhost:7890";
const NS = "http://example.org/ShapeTest/";

// populated in before(), once the address space exists
// each variable gets its own objects: the server must not see one object in two values
let makeArgument: (name: string, dataType: string, text: string) => unknown;
let rfidScanResult: unknown;

const AUTOID_NS = "http://opcfoundation.org/UA/AutoID/";

interface Shape {
    key: string;
    id: string;
    uaDataType: string;
    valueRank: number;
    arrayDimensions?: number[];
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
        // OPC UA JSON encodes Int64/UInt64 as strings, because a JSON number is an
        // IEEE-754 double and cannot round-trip integers above 2^53. So the TD has
        // to declare "string", not "integer". See gap G6 in 06-content-types-101.md.
        key: "Int64",
        id: "s=Shape_Int64",
        uaDataType: "Int64",
        valueRank: -1,
        // 2^53 + 1 = 9007199254740993, deliberately NOT representable as a JS number.
        // It must be given as an OPC UA [high, low] pair, otherwise the test input is
        // itself rounded before it reaches the server and proves nothing.
        variant: () => ({
            dataType: DataType.Int64,
            // arrayType is mandatory for Int64/UInt64: node-opcua cannot tell a
            // [high, low] pair from a two-element array without it.
            arrayType: VariantArrayType.Scalar,
            value: [0x00200000, 0x00000001],
        }),
        wotType: "string",
    },
    {
        // raw bytes: base64 in OPC UA JSON, the bytes themselves inside the UA Binary DataValue
        key: "ByteString",
        id: "s=Shape_ByteString",
        uaDataType: "ByteString",
        valueRank: -1,
        variant: () => ({ dataType: DataType.ByteString, value: Buffer.from([0xde, 0xad, 0xbe, 0xef]) }),
        wotType: "string",
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
        // the Value view gives its text, a JSON string (OPC 10000-6 Annex H.6)
        wotType: "string",
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
        variant: () => ({ dataType: DataType.ExtensionObject, value: makeArgument("Arg1", "i=6", "first argument") }),
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
            value: [makeArgument("Arg1", "i=6", "first argument"), makeArgument("Arg2", "i=11", "second argument")],
        }),
        wotType: "array",
    },
    {
        // a structure of a companion specification (namespace != 0): only the session's
        // DataTypeDefinitions decode it, so the codec needs the `uaconn` tag
        key: "RfidScanResult",
        id: "s=Shape_RfidScanResult",
        // replaced in before() by the DataType NodeId, once the namespace index is known
        uaDataType: "RfidScanResult",
        valueRank: -1,
        variant: () => ({ dataType: DataType.ExtensionObject, value: rfidScanResult }),
        wotType: "object",
    },
    // ---- remaining numeric scalars -------------------------------------
    {
        key: "Float",
        id: "s=Shape_Float",
        uaDataType: "Float",
        valueRank: -1,
        // 0.1 is not exactly representable in float32; the value that comes back
        // shows whether the float32 -> double widening is being reported honestly.
        variant: () => ({ dataType: DataType.Float, value: 0.1 }),
        wotType: "number",
    },
    {
        key: "UInt64",
        id: "s=Shape_UInt64",
        uaDataType: "UInt64",
        valueRank: -1,
        // 2^63 + 1, far beyond Number.MAX_SAFE_INTEGER
        variant: () => ({
            dataType: DataType.UInt64,
            arrayType: VariantArrayType.Scalar,
            value: [0x80000000, 0x00000001],
        }),
        wotType: "string",
    },
    {
        key: "UInt32",
        id: "s=Shape_UInt32",
        uaDataType: "UInt32",
        valueRank: -1,
        variant: () => ({ dataType: DataType.UInt32, value: 4294967295 }),
        wotType: "integer",
    },
    {
        key: "Int16",
        id: "s=Shape_Int16",
        uaDataType: "Int16",
        valueRank: -1,
        variant: () => ({ dataType: DataType.Int16, value: -32768 }),
        wotType: "integer",
    },
    {
        key: "Byte",
        id: "s=Shape_Byte",
        uaDataType: "Byte",
        valueRank: -1,
        variant: () => ({ dataType: DataType.Byte, value: 255 }),
        wotType: "integer",
    },
    {
        key: "SByte",
        id: "s=Shape_SByte",
        uaDataType: "SByte",
        valueRank: -1,
        variant: () => ({ dataType: DataType.SByte, value: -128 }),
        wotType: "integer",
    },
    // ---- non-numeric built-ins -----------------------------------------
    {
        key: "DateTime",
        id: "s=Shape_DateTime",
        uaDataType: "DateTime",
        valueRank: -1,
        variant: () => ({ dataType: DataType.DateTime, value: new Date(Date.UTC(2026, 0, 8, 10, 0, 0)) }),
        wotType: "string",
    },
    {
        key: "Guid",
        id: "s=Shape_Guid",
        uaDataType: "Guid",
        valueRank: -1,
        variant: () => ({ dataType: DataType.Guid, value: "72962B91-FA75-4AE6-8D28-B404DC7DAF63" }),
        wotType: "string",
    },
    {
        key: "NodeId",
        id: "s=Shape_NodeId",
        uaDataType: "NodeId",
        valueRank: -1,
        variant: () => ({ dataType: DataType.NodeId, value: coerceNodeId("ns=1;s=SomeNode") }),
        // the Value view gives a JSON object { IdType, Id, Namespace } (OPC 10000-6 Annex H.2)
        wotType: "object",
    },
    {
        key: "QualifiedName",
        id: "s=Shape_QualifiedName",
        uaDataType: "QualifiedName",
        valueRank: -1,
        variant: () => ({ dataType: DataType.QualifiedName, value: { namespaceIndex: 1, name: "SomeName" } }),
        wotType: "object",
    },
    {
        key: "StatusCode",
        id: "s=Shape_StatusCode",
        uaDataType: "StatusCode",
        valueRank: -1,
        variant: () => ({ dataType: DataType.StatusCode, value: StatusCodes.BadInternalError }),
        wotType: "object",
    },
    {
        key: "XmlElement",
        id: "s=Shape_XmlElement",
        uaDataType: "XmlElement",
        valueRank: -1,
        variant: () => ({ dataType: DataType.XmlElement, value: "<a>1</a>" }),
        wotType: "string",
    },
    {
        // an enumeration is an Int32 on the wire, but its DataType node names the
        // enum. Nothing in the TD can express "this 0 means Running".
        key: "Enumeration",
        id: "s=Shape_Enum",
        uaDataType: "ServerState",
        valueRank: -1,
        variant: () => ({ dataType: DataType.Int32, value: 0 }),
        wotType: "integer",
    },
    {
        // an OPC UA variable may legitimately hold no value at all
        key: "Null",
        id: "s=Shape_Null",
        uaDataType: "BaseDataType",
        valueRank: -2,
        variant: () => ({ dataType: DataType.Null, value: null }),
        wotType: "null",
    },
    // ---- more arrays ----------------------------------------------------
    {
        key: "String[]",
        id: "s=Shape_StringArray",
        uaDataType: "String",
        valueRank: 1,
        variant: () => ({ dataType: DataType.String, arrayType: VariantArrayType.Array, value: ["a", "b"] }),
        wotType: "array",
    },
    {
        key: "ByteString[]",
        id: "s=Shape_ByteStringArray",
        uaDataType: "ByteString",
        valueRank: 1,
        variant: () => ({
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Array,
            value: [Buffer.from([0x01, 0x02]), Buffer.from([0x03])],
        }),
        wotType: "array",
    },
    {
        key: "LocalizedText[]",
        id: "s=Shape_LocalizedTextArray",
        uaDataType: "LocalizedText",
        valueRank: 1,
        variant: () => ({
            dataType: DataType.LocalizedText,
            arrayType: VariantArrayType.Array,
            value: [coerceLocalizedText("one"), coerceLocalizedText("two")],
        }),
        wotType: "array",
    },
    // ---- matrices -------------------------------------------------------
    {
        // 2x3 matrix. On the wire OPC UA sends a FLAT array plus a separate
        // `dimensions` field. JSON Schema has no way to say "this flat array is
        // really 2x3", so the shape is lost unless the DataValue is exposed.
        key: "Double[2][3]",
        id: "s=Shape_DoubleMatrix",
        uaDataType: "Double",
        valueRank: 2,
        arrayDimensions: [2, 3],
        variant: () => ({
            dataType: DataType.Double,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6],
        }),
        wotType: "array",
    },
    {
        key: "Int32[2][2]",
        id: "s=Shape_Int32Matrix",
        uaDataType: "Int32",
        valueRank: 2,
        arrayDimensions: [2, 2],
        variant: () => ({
            dataType: DataType.Int32,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 2],
            value: [1, 2, 3, 4],
        }),
        wotType: "array",
    },
];

const UABINARY = "application/opcua+uabinary";

// one payload, the UA Binary DataValue; the type parameter picks what value() returns
const CONTENT_TYPES: { key: string; contentType?: string; overrideType?: string }[] = [
    // the Value view: the bare value, so the TD schema of each shape matches
    { key: "Value", contentType: UABINARY },
    // the Variant and DataValue views return an object, and declare an object schema to match
    { key: "Variant", contentType: `${UABINARY};type=Variant`, overrideType: "object" },
    { key: "DataValue", contentType: `${UABINARY};type=DataValue`, overrideType: "object" },
];

interface Cell {
    shape: string;
    ct: string;
    ok: boolean;
    rendered?: string;
    /** what JS type value() actually handed back */
    jsType?: string;
    /** what the binding actually put on the wire, from arrayBuffer() */
    wire?: string;
    raw?: Buffer;
    value?: unknown;
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

/**
 * What went over the wire, in the form that says something: the payload as text when it
 * is JSON, hex when it is binary. `value()` shows what a consumer ends up with after core
 * has decoded and validated it, which is not the same thing - a read can fail validation
 * while the bytes were perfectly good.
 */
function renderWire(b: Buffer): string {
    const head = b.subarray(0, 12);
    const hex = head.toString("hex").replace(/(..)/g, "$1 ").trim();
    return b.length > 12 ? `${hex} ... (${b.length}B)` : `${hex} (${b.length}B)`;
}

function makeTD(shape: Shape, contentType?: string, overrideType?: string): WoT.ThingDescription {
    const wotType = overrideType ?? shape.wotType;
    const form: Record<string, unknown> = {
        href: `/?id=nsu=${NS};${shape.id}`,
        op: ["readproperty"],
        // declare type on the form too, as the e2e matrix does
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
    // JSON.stringify returns undefined for undefined and for a function
    let s: string | undefined;
    try {
        s = JSON.stringify(v);
    } catch {
        s = String(v);
    }
    s ??= String(v);
    return s.length > 200 ? s.slice(0, 197) + "..." : s;
}

describe("contentType x data shape matrix (issue #1400)", function () {
    this.timeout(120000);

    let opcuaServer: OPCUAServer;
    let servient: Servient;
    let wot: typeof WoT;
    const cells: Cell[] = [];

    before(async function () {
        opcuaServer = await startServer([nodesets.autoId]);

        const addressSpace = opcuaServer.engine.addressSpace;
        if (!addressSpace) {
            throw new Error("no address space");
        }

        const rfidScanResultType = `ns=${addressSpace.getNamespaceIndex(AUTOID_NS)};i=3007`;
        rfidScanResult = addressSpace.constructExtensionObject(coerceNodeId(rfidScanResultType), {
            codeType: "EPC",
            // a union: the server cannot encode it with no field selected
            scanData: { switchField: 2, string: "MAX7Y6wfNoHsiARo" },
            timestamp: new Date(Date.UTC(2026, 9, 19, 10)),
        });
        const rfidShape = SHAPES.find((s) => s.key === "RfidScanResult");
        if (rfidShape !== undefined) {
            rfidShape.uaDataType = rfidScanResultType;
        }

        makeArgument = (name, dataType, text) =>
            addressSpace.constructExtensionObject(coerceNodeId(DataTypeIds.Argument), {
                name,
                dataType: coerceNodeId(dataType),
                valueRank: -1,
                description: { text },
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
                arrayDimensions: shape.arrayDimensions,
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

        // The tables below show, in one place, what each contentType does to each OPC UA
        // shape. They print only with BINDING_OPCUA_TEST_VERBOSE=1; see report-table.ts.
        const verdict = (cell: Cell | undefined): string => {
            if (cell === undefined) {
                return "-";
            }
            return cell.ok ? (cell.rendered ?? "") : shortVerdict(cell.error);
        };

        printTable({
            title: "contentType x OPC UA data shape - what value() returns",
            subtitle: "x marks a refusal; the detail tables below give the value and the bytes",
            headers: ["shape", ...CONTENT_TYPES.map((c) => c.key)],
            rows: SHAPES.map((shape) => [
                shape.key,
                ...CONTENT_TYPES.map((c) => verdict(cells.find((x) => x.shape === shape.key && x.ct === c.key))),
            ]),
            // narrow on purpose: this table is for spotting patterns, the detail
            // tables below carry the full values
            maxWidth: 22,
        });

        for (const c of CONTENT_TYPES) {
            printTable({
                title: `${c.key}: what the binding sends, and what value() gives back`,
                subtitle: "the payload is the UA Binary DataValue, shown as hex",
                headers: ["shape", "js type", "value() returns", "payload on the wire"],
                rows: SHAPES.map((shape) => {
                    const cell = cells.find((x) => x.shape === shape.key && x.ct === c.key);
                    return [
                        shape.key,
                        cell?.jsType ?? "-",
                        cell === undefined ? "-" : cell.ok ? (cell.rendered ?? "") : shortVerdict(cell.error),
                        truncate(cell?.wire ?? "-", 44),
                    ];
                }),
                maxWidth: 40,
            });
        }
    });

    for (const shape of SHAPES) {
        for (const ct of CONTENT_TYPES) {
            it(`${shape.key} as ${ct.key}`, async function () {
                const cell: Cell = { shape: shape.key, ct: ct.key, ok: false };
                const thing = await wot.consume(makeTD(shape, ct.contentType, ct.overrideType));

                // raw bytes first, on their own read: this is what actually crossed the wire
                try {
                    const rawRead = await thing.readProperty("v");
                    cell.raw = Buffer.from(await rawRead.arrayBuffer());
                    cell.wire = renderWire(cell.raw);
                } catch {
                    cell.wire = "n/a";
                }

                try {
                    const read = await thing.readProperty("v");
                    const value = await read.value();
                    cell.ok = true;
                    cell.value = value;
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

    const cellOf = (shape: Shape, ct: string): Cell => {
        const cell = cells.find((x) => x.shape === shape.key && x.ct === ct);
        if (cell === undefined) {
            throw new Error(`no result for ${shape.key} as ${ct}`);
        }
        return cell;
    };

    it("Value view: value() gives every shape", function () {
        const refused = SHAPES.map((shape) => cellOf(shape, "Value"))
            .filter((cell) => !cell.ok)
            .map((cell) => `${cell.shape}: ${cell.error} (value ${cell.wire})`);
        expect(refused).to.deep.equal([]);
    });

    it("Variant view: value() gives the OPC UA built-in type of every shape", function () {
        for (const shape of SHAPES) {
            const cell = cellOf(shape, "Variant");
            expect(cell.ok, `${shape.key}: ${cell.error}`).to.equal(true);
            expect((cell.value as Record<string, unknown>).UaType, shape.key).to.equal(shape.variant().dataType);
        }
    });

    it("DataValue view: value() adds the SourceTimestamp the server sent, for every shape", function () {
        for (const shape of SHAPES) {
            const cell = cellOf(shape, "DataValue");
            expect(cell.ok, `${shape.key}: ${cell.error}`).to.equal(true);
            const value = cell.value as Record<string, unknown>;
            expect(value.UaType, shape.key).to.equal(shape.variant().dataType);
            expect(new Date(value.SourceTimestamp as string).getTime(), shape.key).to.be.greaterThan(0);
        }
    });

    it("arrayBuffer() is the UA Binary DataValue that holds the value, whatever the view", function () {
        for (const shape of SHAPES) {
            const dataType = shape.variant().dataType;
            for (const ct of CONTENT_TYPES) {
                const raw = cellOf(shape, ct.key).raw;
                expect(raw, `${shape.key} as ${ct.key}`).to.not.equal(undefined);
                const dataValue = decodeUABinaryDataValue(raw as Buffer);
                // the mask says a value follows (none for a Null value), and the timestamps
                // the server sent are kept
                const valueBit = dataType === DataType.Null ? 0 : 0x01;
                expect(raw?.[0], shape.key).to.satisfy((mask: number) => (mask & 0x01) === valueBit);
                expect(dataValue.value.dataType, `${shape.key} as ${ct.key}`).to.equal(dataType);
                expect(dataValue.sourceTimestamp, shape.key).to.be.an.instanceOf(Date);
            }
        }
    });
});
