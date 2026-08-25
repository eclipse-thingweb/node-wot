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
// `contentType` and schema-`type` placement actually does today. Written for
// issue #1400 and PRs #1402 / #1449.
//
// OPC-10101 v1.00 6.5.3: "If the default serialization of the OPC UA server is
// used, the contentType should be assigned with the value application/octet-stream."
//
// The server exposes SpecialVariable, a Double holding 42.0.
//

import { expect } from "chai";
import { Servient, createLoggers } from "@node-wot/core";
import { OPCUAServer } from "node-opcua";

import { OPCUAClientFactory } from "../src";
import { startServer } from "./fixture/basic-opcua-server";

const { info } = createLoggers("binding-opcua", "octet-stream-e2e-test");

const endpoint = "opc.tcp://localhost:7890";
const NODE = "nsu=http://example.org/SpecialNamespace/;s=SpecialVariable";
const EXPECTED = 42.0;

/** One row of the matrix: how the TD is written, and what came back. */
interface Scenario {
    key: string;
    description: string;
    /** contentType on the form, or undefined to omit it entirely */
    contentType?: string;
    /** where the JSON-schema `type` is declared */
    typeAt: "affordance" | "form" | "both" | "nowhere";
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
        description: "octet-stream, type on form (undocumented workaround)",
        contentType: "application/octet-stream",
        typeAt: "form",
    },
    {
        key: "D",
        description: "octet-stream, type in both places",
        contentType: "application/octet-stream",
        typeAt: "both",
    },
    {
        key: "E",
        description: "octet-stream, no type anywhere",
        contentType: "application/octet-stream",
        typeAt: "nowhere",
    },
    {
        key: "G",
        description: "application/opcua+json, no type declared (control for F)",
        contentType: "application/opcua+json",
        typeAt: "nowhere",
    },
    {
        key: "F",
        description: "explicit application/opcua+json, type on affordance",
        contentType: "application/opcua+json",
        typeAt: "affordance",
    },
];

function makeTD(s: Scenario): WoT.ThingDescription {
    const form: Record<string, unknown> = {
        href: `/?id=${NODE}`,
        op: ["readproperty"],
    };
    if (s.contentType !== undefined) {
        form.contentType = s.contentType;
    }
    if (s.typeAt === "form" || s.typeAt === "both") {
        form.type = "number";
    }

    const property: Record<string, unknown> = {
        description: "a Double holding 42.0",
        readOnly: true,
        forms: [form],
    };
    if (s.typeAt === "affordance" || s.typeAt === "both") {
        property.type = "number";
    }

    return {
        "@context": "https://www.w3.org/2019/wot/td/v1",
        "@type": ["Thing"],
        securityDefinitions: { nosec_sc: { scheme: "nosec" } },
        security: "nosec_sc",
        title: `octet-stream scenario ${s.key}`,
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

        // Print the matrix so the behaviour is visible without reading assertions.
        // Deliberately console output, not the logger: the table is the deliverable.
        const line = (t: string) => console.info(t);
        line("");
        line("=== contentType matrix: read a Double (42.0) over OPC UA ===");
        line("  id  contentType                type@        result");
        for (const o of outcomes) {
            const verdict = o.ok ? `OK     ${JSON.stringify(o.value)} (${o.valueType})` : `THROW  ${o.error}`;
            line(`  ${o.key}   ${o.contentType.padEnd(26)} ${o.typeAt.padEnd(12)} ${verdict}`);
        }
        line("");
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

            // Assert the CURRENT behaviour of eclipse/master, so this test turns red
            // the moment #1400 is actually fixed. Each expectation below is a bug
            // except scenario A, which is merely non-conformant.
            switch (s.key) {
                case "A":
                    // works, but OPC-10101 6.5.3 says the default should be octet-stream
                    expect(outcome.ok, "A should currently succeed").to.equal(true);
                    expect(outcome.value).to.equal(EXPECTED);
                    break;
                case "B":
                case "C":
                case "D":
                case "E":
                    // Before the content-negotiation fix these failed inside core's
                    // OctetstreamCodec with "dataType.toLowerCase is not a function".
                    // Now the binding rejects them itself, naming the form and the
                    // actual OPC UA dataType, and pointing at a usable alternative.
                    expect(outcome.ok, `${s.key} should fail: the value is not a ByteString`).to.equal(false);
                    expect(outcome.error).to.match(/only supported when the value is a ByteString/);
                    expect(outcome.error, "the error should name the offending form").to.match(/SpecialVariable/);
                    break;
                case "F":
                    expect(outcome.ok).to.equal(false);
                    expect(outcome.error).to.match(/Invalid value according to DataSchema/);
                    break;
                case "G":
                    expect(outcome.ok).to.equal(false);
                    expect(outcome.error).to.match(/No schema type defined/);
                    break;
            }
            info(`scenario ${s.key}: ${outcome.ok ? "OK " + JSON.stringify(outcome.value) : "THROW " + outcome.error}`);
        });
    }

    it("reports the matrix", function () {
        expect(outcomes.length).to.equal(SCENARIOS.length);
    });
});
