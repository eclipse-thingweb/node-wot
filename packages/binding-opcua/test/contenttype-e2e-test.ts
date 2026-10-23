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
// End-to-end matrix for `contentType` handling in binding-opcua.
//
// Purpose: demonstrate, against a real OPC UA server, what each combination of
// `contentType` and schema-`type` placement does. Written for issue #1400.
//
// An opc.tcp form takes application/opcua+uabinary (OPC 10000-6 Table 80, planned for
// WoT OPC UA Binding 1.1); its `type` parameter picks what value() returns. Every other
// contentType, and a form without one, is refused with a message naming the replacement.
// See doc/decisions.md (D8).
//
// The server exposes SpecialVariable, a Double holding 42.0.
//

import { expect } from "chai";
import { Servient, createLoggers } from "@node-wot/core";
import { OPCUAServer } from "node-opcua";

import { OPCUAClientFactory } from "../src";
import { startServer } from "./fixture/basic-opcua-server";
import { printTable, shortVerdict } from "./report-table";

const { info } = createLoggers("binding-opcua", "contenttype-e2e-test");

const endpoint = "opc.tcp://localhost:7890";
const NODE = "nsu=http://example.org/SpecialNamespace/;s=SpecialVariable";
const EXPECTED = 42.0;
const UABINARY = "application/opcua+uabinary";

/** One row of the matrix: how the TD is written, and what came back. */
interface Scenario {
    key: string;
    description: string;
    /** contentType on the form, or undefined to omit it entirely */
    contentType?: string;
    /** where the JSON-schema `type` is declared */
    typeAt: "affordance" | "form" | "both" | "nowhere";
    /** the JSON-schema `type`, "number" unless said otherwise */
    schemaType?: string;
}

const SCENARIOS: Scenario[] = [
    {
        key: "A",
        description: "no contentType, type on affordance (plain WoT TD)",
        contentType: undefined,
        typeAt: "affordance",
    },
    {
        key: "B",
        description: "octet-stream, type on affordance  <-- the TD from issue #1400",
        contentType: "application/octet-stream",
        typeAt: "affordance",
    },
    {
        key: "C",
        description: "opcua+uabinary, type on affordance",
        contentType: UABINARY,
        typeAt: "affordance",
    },
    {
        key: "D",
        description: "opcua+uabinary, type on form only",
        contentType: UABINARY,
        typeAt: "form",
    },
    {
        key: "E",
        description: "opcua+uabinary, type in both places",
        contentType: UABINARY,
        typeAt: "both",
    },
    {
        key: "F",
        description: "opcua+uabinary;type=Variant, object type on affordance",
        contentType: `${UABINARY};type=Variant`,
        typeAt: "affordance",
        schemaType: "object",
    },
    {
        key: "G",
        description: "application/opcua+json, type on affordance",
        contentType: "application/opcua+json",
        typeAt: "affordance",
        schemaType: "object",
    },
];

function makeTD(s: Scenario): WoT.ThingDescription {
    const schemaType = s.schemaType ?? "number";
    const form: Record<string, unknown> = {
        href: `/?id=${NODE}`,
        op: ["readproperty"],
    };
    if (s.contentType !== undefined) {
        form.contentType = s.contentType;
    }
    if (s.typeAt === "form" || s.typeAt === "both") {
        form.type = schemaType;
    }

    const property: Record<string, unknown> = {
        description: "a Double holding 42.0",
        readOnly: true,
        forms: [form],
    };
    if (s.typeAt === "affordance" || s.typeAt === "both") {
        property.type = schemaType;
    }

    return {
        "@context": "https://www.w3.org/2019/wot/td/v1",
        "@type": ["Thing"],
        securityDefinitions: { nosec_sc: { scheme: "nosec" } },
        security: "nosec_sc",
        title: `contentType scenario ${s.key}`,
        base: endpoint,
        properties: { special: property },
    } as unknown as WoT.ThingDescription;
}

interface Outcome {
    key: string;
    description: string;
    contentType: string;
    typeAt: string;
    ok: boolean;
    value?: unknown;
    valueType?: string;
    error?: string;
}

describe("contentType end-to-end matrix (issue #1400)", function () {
    this.timeout(60000);

    let opcuaServer: OPCUAServer;
    let servient: Servient;
    let wot: typeof WoT;
    const outcomes: Outcome[] = [];

    before(async function () {
        opcuaServer = await startServer();
        servient = new Servient();
        servient.addClientFactory(new OPCUAClientFactory());
        wot = await servient.start();
    });

    after(async function () {
        await servient.shutdown();
        await opcuaServer.shutdown();

        // Shows the behaviour without reading the assertions one by one.
        // Prints only with BINDING_OPCUA_TEST_VERBOSE=1; see report-table.ts.
        printTable({
            title: "contentType matrix: reading a Double (42.0) over OPC UA",
            subtitle: "where `type` is declared varies per row; x marks a refusal",
            headers: ["id", "contentType", "type declared on", "result"],
            rows: outcomes.map((o) => [
                o.key,
                o.contentType,
                o.typeAt,
                o.ok ? `${JSON.stringify(o.value)} (${o.valueType})` : shortVerdict(o.error),
            ]),
            maxWidth: 46,
        });
    });

    for (const s of SCENARIOS) {
        it(`scenario ${s.key}: ${s.description}`, async function () {
            const thing = await wot.consume(makeTD(s));
            const outcome: Outcome = {
                key: s.key,
                description: s.description,
                contentType: s.contentType ?? "(omitted)",
                typeAt: s.typeAt,
                ok: false,
            };
            try {
                const read = await thing.readProperty("special");
                const value = await read.value();
                outcome.ok = true;
                outcome.value = value;
                outcome.valueType = typeof value;
            } catch (err) {
                outcome.error = (err as Error).message;
            }
            outcomes.push(outcome);

            switch (s.key) {
                case "A":
                    // no contentType is application/json (W3C WoT TD 1.1), which an opc.tcp form
                    // no longer takes
                    expect(outcome.ok).to.equal(false);
                    expect(outcome.error).to.match(/needs contentType 'application\/opcua\+uabinary'/);
                    break;
                case "B":
                    // WoT OPC UA Binding 1.0 names application/octet-stream; its 1.1 replacement
                    // is application/opcua+uabinary, and the message says so
                    expect(outcome.ok).to.equal(false);
                    expect(outcome.error).to.match(/Use 'application\/opcua\+uabinary'/);
                    expect(outcome.error, "the error should name the offending contentType").to.match(/octet-stream/);
                    break;
                case "C":
                case "E":
                    expect(outcome.ok, `${s.key} should succeed: ${outcome.error}`).to.equal(true);
                    expect(outcome.value).to.equal(EXPECTED);
                    break;
                case "D":
                    // core refuses before decoding: a `type` on the form is not the schema of
                    // the affordance
                    expect(outcome.ok).to.equal(false);
                    expect(outcome.error).to.match(/No schema type defined/);
                    break;
                case "F":
                    expect(outcome.ok, `F should succeed: ${outcome.error}`).to.equal(true);
                    expect(outcome.value).to.deep.equal({ UaType: 11, Value: EXPECTED });
                    break;
                case "G":
                    expect(outcome.ok).to.equal(false);
                    expect(outcome.error).to.match(/Use 'application\/opcua\+uabinary;type=DataValue'/);
                    break;
            }
            info(`scenario ${s.key}: ${outcome.ok ? "OK " + JSON.stringify(outcome.value) : "THROW " + outcome.error}`);
        });
    }

    it("reports the matrix", function () {
        expect(outcomes.length).to.equal(SCENARIOS.length);
    });
});
