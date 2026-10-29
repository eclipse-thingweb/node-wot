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
import { BrowseOptions, BrowseResult, browseController } from "../src/eip-browse";
import EipClientFactory from "../src/eip-client-factory";
import { EipForm } from "../src/eip-form";
import { validateEipForm } from "../src/eip-form-validation";
import { STRUCTURE_TYPE_CODE } from "../src/eip-protocol";
import { parseSymbolEntries } from "../src/eip-symbols";
import { IDENTITY_REPLY, SYMBOL_PAGES, TEMPLATES } from "./eip-browse-fixtures";
import { FakeEipServer } from "./fake-eip-server";

interface Property {
    type: string;
    minimum?: number;
    maximum?: number;
    items?: { type: string; minimum?: number; maximum?: number };
    minItems?: number;
    maxItems?: number;
    readOnly: boolean;
    observable: boolean;
    forms: EipForm[];
}

interface TemplateMemberSpec {
    name: string;
    type: number;
    info?: number;
    offset: number;
}

function hex(text: string): Buffer {
    return Buffer.from(text, "hex");
}

function identityReply(productName: string): Buffer {
    const name = Buffer.from(productName, "latin1");
    return Buffer.concat([hex(IDENTITY_REPLY).subarray(0, 14), Buffer.from([name.length]), name]);
}

/** Builds the attribute reply and body a controller returns for a template. */
function makeTemplate(name: string, size: number, members: TemplateMemberSpec[]) {
    const records = members.map((member) => {
        const record = Buffer.alloc(8);
        record.writeUInt16LE(member.info ?? 0, 0);
        record.writeUInt16LE(member.type, 2);
        record.writeUInt32LE(member.offset, 4);
        return record;
    });
    const names = Buffer.from(`${name};n\0${members.map((member) => `${member.name}\0`).join("")}`, "latin1");
    const body = Buffer.concat([...records, names]);

    const attributes = Buffer.alloc(30);
    attributes.writeUInt16LE(4, 0);
    attributes.writeUInt16LE(4, 2);
    attributes.writeUInt32LE(Math.ceil((body.length + 23) / 4), 6);
    attributes.writeUInt16LE(5, 10);
    attributes.writeUInt32LE(size, 14);
    attributes.writeUInt16LE(2, 18);
    attributes.writeUInt16LE(members.length, 22);
    attributes.writeUInt16LE(1, 24);
    attributes.writeUInt16LE(0x1234, 28);
    return { attributes, body };
}

function loadSampleController(server: FakeEipServer): void {
    server.identity = hex(IDENTITY_REPLY);
    server.symbols = SYMBOL_PAGES.flatMap((page) => parseSymbolEntries(hex(page.data), true));
    for (const [id, template] of Object.entries(TEMPLATES)) {
        server.templates.set(Number(id), { attributes: hex(template.attributes), body: hex(template.body) });
    }
}

function properties(result: BrowseResult): Record<string, Property> {
    return result.thingDescription.properties as Record<string, Property>;
}

describe("EtherNet/IP browsing", () => {
    const server = new FakeEipServer();
    let port: number;
    let uri: string;

    before(async () => {
        port = await server.start();
        uri = `eip://127.0.0.1:${port}/1,0/`;
    });

    after(async () => {
        await server.stop();
    });

    beforeEach(() => {
        server.reset();
        loadSampleController(server);
    });

    function browse(options?: BrowseOptions): Promise<BrowseResult> {
        return browseController(uri, { timeout: 2000, ...options });
    }

    describe("the sample controller", () => {
        it("describes the controller", async () => {
            const { thingDescription, skipped } = await browse();
            expect(thingDescription["@context"]).to.deep.equal([
                "https://www.w3.org/2022/wot/td/v1.1",
                { eipv: "https://www.w3.org/2026/wot/eip" },
            ]);
            expect(thingDescription.title).to.equal(`1756-L81E/B @ 127.0.0.1`);
            expect(thingDescription.id).to.equal(`urn:eip:127.0.0.1:${port}:1:0`);
            expect(thingDescription.base).to.equal(`eip://127.0.0.1:${port}/1,0/`);
            expect(thingDescription["eipv:controller"]).to.equal("ControlLogix");
            expect(thingDescription.security).to.deep.equal(["nosec_sc"]);
            expect(skipped).to.deep.equal([]);
        });

        it("lists the data tags and leaves out programs, tasks, maps and connections", async () => {
            const result = await browse();
            expect(Object.keys(properties(result))).to.deep.equal([
                "Local:2:O",
                "Production_Data",
                "Previous_Shift_Production_Data",
                "IO_Control",
            ]);
        });

        it("generates the structure definitions of the hand-written sample TD", async () => {
            const sample = JSON.parse(
                fs.readFileSync(path.join(__dirname, "../../../examples/eip-binding/Rockwell.td.jsonld"), "utf8")
            );
            const generated = properties(await browse());
            for (const [name, property] of Object.entries<{ forms: EipForm[] }>(sample.properties)) {
                const expected = property.forms[0]["eipv:structureDefinition"];
                const actual = generated[name].forms[0]["eipv:structureDefinition"];
                expect(actual?.["eipv:typeName"], name).to.equal(expected?.["eipv:typeName"]);
                expect(actual?.["eipv:fields"], name).to.deep.equal(expected?.["eipv:fields"]);
                expect(generated[name].forms[0].href, name).to.equal(property.forms[0].href);
            }
        });

        it("takes the structure size from the template", async () => {
            const generated = properties(await browse());
            expect(generated.Production_Data.forms[0]["eipv:structureDefinition"]?.["eipv:byteSize"]).to.equal(36);
            expect(generated["Local:2:O"].forms[0]["eipv:structureDefinition"]?.["eipv:byteSize"]).to.equal(4);
        });

        it("marks read-only tags by their external access", async () => {
            const generated = properties(await browse());
            expect(generated.Production_Data.readOnly).to.equal(true);
            expect(generated.Production_Data.forms[0].op).to.deep.equal(["readproperty", "observeproperty"]);
            expect(generated.IO_Control.readOnly).to.equal(false);
            expect(generated.IO_Control.forms[0].op).to.deep.equal([
                "readproperty",
                "observeproperty",
                "writeproperty",
            ]);
        });

        it("makes every form valid and observable", async () => {
            for (const property of Object.values(properties(await browse()))) {
                expect(property.type).to.equal("object");
                expect(property.observable).to.equal(true);
                expect(property.forms).to.have.length(1);
                expect(() => validateEipForm(property.forms[0])).not.to.throw();
                expect(property.forms[0]["eipv:pollingTime"]).to.equal(1000);
            }
        });

        it("reads a template once however many tags use it", async () => {
            await browse();
            const reads = server.requests.filter((r) => r.service === 0x03 && r.tag === "class 0x6c instance 1566");
            expect(reads).to.have.length(1);
        });

        it("sends every request with the route path of the endpoint", async () => {
            await browse();
            expect(server.requests.length).to.be.greaterThan(0);
            for (const request of server.requests) expect(request.route).to.deep.equal(Buffer.from([1, 0]));
        });
    });

    describe("paging and older firmware", () => {
        it("follows the partial transfers of the symbol list", async () => {
            server.symbolPageSize = 2;
            const result = await browse();
            expect(Object.keys(properties(result))).to.have.length(4);
            const lists = server.requests.filter((r) => r.service === 0x55);
            expect(lists.length).to.be.greaterThan(2);
        });

        it("follows the partial transfers of a template", async () => {
            server.maxFragment = 20;
            const generated = properties(await browse());
            expect(generated.Production_Data.forms[0]["eipv:structureDefinition"]?.["eipv:fields"]).to.have.length(9);
        });

        it("lists again without external access when the controller does not know it", async () => {
            server.externalAccess = false;
            const generated = properties(await browse());
            expect(Object.keys(generated)).to.have.length(4);
            for (const property of Object.values(generated)) {
                expect(property.readOnly).to.equal(false);
                expect(property.forms[0].op).to.include("writeproperty");
            }
        });
    });

    describe("types", () => {
        const user = 0x8000;

        it("describes atomic tags, arrays and arrays of structures", async () => {
            server.symbols.push(
                { instance: 100, name: "Speed", type: 0x00ca, elementLength: 4 },
                { instance: 101, name: "Count", type: 0x00c4, elementLength: 4 },
                { instance: 102, name: "Enabled", type: 0x00c1, elementLength: 1 },
                { instance: 103, name: "Setpoints", type: 0x20c4, elementLength: 4, dimensions: [10, 0, 0] },
                { instance: 104, name: "Shifts", type: 0xa61e, elementLength: 36, dimensions: [3, 0, 0] },
                { instance: 105, name: "Mask", type: 0x00d3, elementLength: 4 }
            );
            const generated = properties(await browse());

            expect(generated.Speed).to.deep.include({ type: "number", readOnly: false, observable: true });
            expect(generated.Speed.forms[0]["eipv:type"]).to.equal("eipv:REAL");
            expect(generated.Count).to.deep.include({ type: "integer", minimum: -2147483648, maximum: 2147483647 });
            expect(generated.Enabled.type).to.equal("boolean");
            expect(generated.Mask).to.deep.include({ type: "integer", minimum: 0, maximum: 4294967295 });

            expect(generated.Setpoints).to.deep.include({ type: "array", minItems: 10, maxItems: 10 });
            expect(generated.Setpoints.items).to.deep.include({ type: "integer" });
            expect(generated.Setpoints.forms[0]["eipv:type"]).to.equal("eipv:DINT");
            expect(generated.Setpoints.forms[0]["eipv:dimensions"]).to.deep.equal([10]);

            expect(generated.Shifts).to.deep.include({ type: "array", minItems: 3, maxItems: 3 });
            expect(generated.Shifts.items?.type).to.equal("object");
            expect(generated.Shifts.forms[0]["eipv:dimensions"]).to.deep.equal([3]);
            expect(generated.Shifts.forms[0]["eipv:structureDefinition"]?.["eipv:byteSize"]).to.equal(36);
        });

        it("keeps every dimension of a multi-dimensional array", async () => {
            server.symbols.push({ instance: 100, name: "Grid", type: 0x40c4, dimensions: [4, 5, 0] });
            const generated = properties(await browse());
            expect(generated.Grid.forms[0]["eipv:dimensions"]).to.deep.equal([4, 5]);
            expect(generated.Grid.maxItems).to.equal(20);
        });

        it("maps the predefined STRING to eipv:STRING", async () => {
            server.symbols.push({ instance: 100, name: "Recipe_Name", type: user | 4046, elementLength: 88 });
            const generated = properties(await browse());
            expect(generated.Recipe_Name.type).to.equal("string");
            expect(generated.Recipe_Name.forms[0]["eipv:type"]).to.equal("eipv:STRING");
            expect(generated.Recipe_Name.forms[0]["eipv:structureDefinition"]).to.equal(undefined);
        });

        it("describes a TIMER with its bits and without the control word", async () => {
            server.symbols.push({ instance: 100, name: "Delay", type: user | 3971, elementLength: 12 });
            const definition = properties(await browse()).Delay.forms[0]["eipv:structureDefinition"];
            expect(definition?.["eipv:typeName"]).to.equal("TIMER");
            expect(definition?.["eipv:byteSize"]).to.equal(12);
            expect(definition?.["eipv:fields"]).to.deep.equal([
                { "eipv:name": "PRE", "eipv:type": "eipv:DINT", "eipv:byteOffset": 4 },
                { "eipv:name": "ACC", "eipv:type": "eipv:DINT", "eipv:byteOffset": 8 },
                { "eipv:name": "EN", "eipv:type": "eipv:BOOL", "eipv:byteOffset": 3, "eipv:bitOffset": 7 },
                { "eipv:name": "TT", "eipv:type": "eipv:BOOL", "eipv:byteOffset": 3, "eipv:bitOffset": 6 },
                { "eipv:name": "DN", "eipv:type": "eipv:BOOL", "eipv:byteOffset": 3, "eipv:bitOffset": 5 },
            ]);
        });

        it("describes nested structures, array members and packed BOOLs", async () => {
            server.templates.set(
                0x131,
                makeTemplate("Inner", 8, [
                    { name: "A", type: 0xc4, offset: 0 },
                    { name: "B", type: 0xca, offset: 4 },
                ])
            );
            server.templates.set(
                0x130,
                makeTemplate("Outer", 116, [
                    { name: "Inner", type: user | 0x131, offset: 0 },
                    { name: "Values", type: 0x20c4, info: 4, offset: 8 },
                    { name: "ZZZZZZZZZZOuter0", type: 0xc2, offset: 24 },
                    { name: "Run", type: 0xc1, info: 3, offset: 24 },
                    { name: "Name", type: user | 4046, offset: 28 },
                ])
            );
            server.symbols.push({ instance: 100, name: "Machine", type: user | 0x130, elementLength: 32 });

            const definition = properties(await browse()).Machine.forms[0]["eipv:structureDefinition"];
            expect(definition?.["eipv:typeName"]).to.equal("Outer");
            expect(definition?.["eipv:fields"]).to.deep.equal([
                {
                    "eipv:name": "Inner",
                    "eipv:structureDefinition": {
                        "eipv:typeName": "Inner",
                        "eipv:fields": [
                            { "eipv:name": "A", "eipv:type": "eipv:DINT", "eipv:byteOffset": 0 },
                            { "eipv:name": "B", "eipv:type": "eipv:REAL", "eipv:byteOffset": 4 },
                        ],
                        "eipv:byteSize": 8,
                    },
                    "eipv:byteOffset": 0,
                },
                { "eipv:name": "Values", "eipv:type": "eipv:DINT", "eipv:byteOffset": 8, "eipv:dimensions": [4] },
                { "eipv:name": "Run", "eipv:type": "eipv:BOOL", "eipv:byteOffset": 24, "eipv:bitOffset": 3 },
                { "eipv:name": "Name", "eipv:type": "eipv:STRING", "eipv:byteOffset": 28 },
            ]);
        });
    });

    describe("tags the binding cannot express", () => {
        it("reports them and goes on", async () => {
            server.templates.set(
                0x120,
                makeTemplate("STRING20", 24, [
                    { name: "LEN", type: 0xc4, offset: 0 },
                    { name: "DATA", type: 0x20c2, info: 20, offset: 4 },
                ])
            );
            server.templates.set(
                0x121,
                makeTemplate("Odd", 12, [
                    { name: "Good", type: 0xc4, offset: 0 },
                    { name: "Stamp", type: 0xcc, offset: 4 },
                ])
            );
            server.symbols.push(
                { instance: 100, name: "Stamp", type: 0x00cc, elementLength: 8 },
                { instance: 101, name: "Hidden", type: 0x00c4, elementLength: 4, externalAccess: 3 },
                { instance: 102, name: "Flags", type: 0x20c1, dimensions: [4, 0, 0] },
                { instance: 103, name: "Label", type: 0x8000 | 0x120, elementLength: 24 },
                { instance: 104, name: "Mixed", type: 0x8000 | 0x121, elementLength: 12 },
                { instance: 105, name: "Names", type: 0xa000 | 4046, dimensions: [2, 0, 0] },
                { instance: 106, name: "Fine", type: 0x00c4, elementLength: 4 }
            );
            const result = await browse();

            expect(Object.keys(properties(result))).to.include("Fine");
            const reasons = Object.fromEntries(result.skipped.map((tag) => [tag.name, tag.reason]));
            expect(Object.keys(reasons)).to.have.members(["Stamp", "Hidden", "Flags", "Label", "Mixed", "Names"]);
            expect(reasons.Stamp).to.contain("0xcc");
            expect(reasons.Hidden).to.contain("external access");
            expect(reasons.Flags).to.contain("BOOL");
            expect(reasons.Label).to.contain("STRING20");
            expect(reasons.Mixed).to.contain("Stamp").and.to.contain("Odd");
            expect(reasons.Names).to.contain("STRING");
        });

        it("skips a tag whose template the controller does not serve, and keeps the others", async () => {
            server.templates.delete(1566);
            const result = await browse();
            expect(Object.keys(properties(result))).to.deep.equal(["Local:2:O", "IO_Control"]);
            expect(result.skipped.map((tag) => tag.name)).to.deep.equal([
                "Production_Data",
                "Previous_Shift_Production_Data",
            ]);
            expect(result.skipped[0].reason).to.contain("template 1566");
        });
    });

    describe("options", () => {
        it("filters by regular expression and by function", async () => {
            expect(Object.keys(properties(await browse({ filter: /^IO_/ })))).to.deep.equal(["IO_Control"]);
            const generated = properties(await browse({ filter: (name) => name.includes("Shift") }));
            expect(Object.keys(generated)).to.deep.equal(["Previous_Shift_Production_Data"]);
        });

        it("filters with a global regular expression repeatedly", async () => {
            const filter = /Production/g;
            expect(Object.keys(properties(await browse({ filter })))).to.have.length(2);
        });

        it("sets title, id and polling time", async () => {
            const result = await browse({ title: "Line 1", id: "urn:line:1", pollingTime: 250 });
            expect(result.thingDescription.title).to.equal("Line 1");
            expect(result.thingDescription.id).to.equal("urn:line:1");
            expect(properties(result).IO_Control.forms[0]["eipv:pollingTime"]).to.equal(250);
        });

        it("encodes characters that are not allowed in an href", async () => {
            server.symbols.push({ instance: 100, name: "Odd#Name", type: 0x00c4 });
            const generated = properties(await browse());
            expect(generated["Odd#Name"].forms[0].href).to.equal("Odd%23Name");
        });
    });

    describe("controller families", () => {
        it("browses a CompactLogix", async () => {
            server.identity = identityReply("5069-L306ER/A");
            const result = await browse();
            expect(result.thingDescription["eipv:controller"]).to.equal("CompactLogix");
        });

        it("rejects other controllers with a clear error", async () => {
            server.identity = identityReply("2080-LC50-24QWB");
            let error: Error | undefined;
            try {
                await browse();
            } catch (err) {
                error = err as Error;
            }
            expect(error?.message).to.contain("2080-LC50-24QWB").and.to.contain("ControlLogix and CompactLogix");
            expect(server.requests.filter((r) => r.service === 0x55)).to.have.length(0);
        });

        it("accepts a declared family for an unknown product name", async () => {
            server.identity = identityReply("1789-L60");
            const result = await browse({ controller: "ControlLogix" });
            expect(result.thingDescription["eipv:controller"]).to.equal("ControlLogix");
        });
    });

    describe("failures", () => {
        it("fails the browse when the controller does not answer", async () => {
            server.silent = true;
            let error: Error | undefined;
            try {
                await browse({ timeout: 200 });
            } catch (err) {
                error = err as Error;
            }
            expect(error?.message).to.contain("No reply");
        });

        it("rejects an address with a tag path", async () => {
            let error: Error | undefined;
            try {
                await browseController(`eip://127.0.0.1:${port}/1,0/Tag`);
            } catch (err) {
                error = err as Error;
            }
            expect(error?.message).to.contain("tag path");
        });
    });

    describe("in a servient", () => {
        const servient = new Servient();
        let wot: Awaited<ReturnType<Servient["start"]>>;

        before(async () => {
            servient.addClientFactory(new EipClientFactory());
            wot = await servient.start();
        });

        after(async () => {
            await servient.shutdown();
        });

        it("turns the browse result into a consumable Thing", async () => {
            const data = Buffer.alloc(16);
            data.writeInt32LE(1500, 4);
            server.addTag("IO_Control", STRUCTURE_TYPE_CODE, 16, data, 0x3333);

            const td = await wot.requestThingDescription(uri);
            expect(td.title).to.equal("1756-L81E/B @ 127.0.0.1");
            expect(Object.keys(td.properties ?? {})).to.have.length(4);

            const thing = await wot.consume(td);
            const value = await (await thing.readProperty("IO_Control")).value();
            expect(value).to.deep.equal({ Set_LEDControl: 0, Set_Speed: 1500, Sts_LEDMode: 0, Sts_Speed: 0 });
        });

        it("browses and reads over one session", async () => {
            server.addTag("IO_Control", STRUCTURE_TYPE_CODE, 16, Buffer.alloc(16), 0x3333);
            const before = server.connections;
            const td = await wot.requestThingDescription(uri);
            await (await (await wot.consume(td)).readProperty("IO_Control")).value();
            expect(server.connections - before).to.equal(0);
        });
    });
});
