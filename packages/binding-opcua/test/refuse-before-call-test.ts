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

// A form whose contentType the binding refuses must be refused before any OPC UA service runs:
// a method that ran cannot be undone, and a monitored item would sample for nothing.
// The connection is a fake that counts the service calls, so no server is needed.

import { expect } from "chai";
import { Readable } from "stream";
import { Content } from "@node-wot/core";
import { DataValue } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";

import { OPCUAForm, OPCUAProtocolClient } from "../src/opcua-protocol-client";

const href = "opc.tcp://localhost:1/?id=ns=1;s=Thing";

function fakeClient() {
    const calls: string[] = [];
    const session = {
        read: async () => {
            calls.push("Read");
            return new DataValue({ value: { dataType: "Double", value: 1 } });
        },
        getArgumentDefinition: async () => {
            calls.push("GetArgumentDefinition");
            return { inputArguments: [], outputArguments: [] };
        },
        call: async () => {
            calls.push("Call");
            return { statusCode: StatusCodes.Good, outputArguments: [] };
        },
    };
    const subscription = {
        monitor: async () => {
            calls.push("CreateMonitoredItems");
            return { on: () => undefined, once: () => undefined, terminate: async () => undefined };
        },
    };
    const client = new OPCUAProtocolClient();
    (client as unknown as { _withConnection: unknown })._withConnection = async (
        _form: OPCUAForm,
        next: (c: unknown) => Promise<unknown>
    ) => next({ session, subscription, namespaceArray: ["http://opcfoundation.org/UA/", "urn:test"] });
    return { client, calls };
}

async function refusal(promise: Promise<unknown>): Promise<Error> {
    try {
        await promise;
    } catch (err) {
        return err as Error;
    }
    throw new Error("expected a refusal");
}

describe("binding-opcua refuses a contentType before calling the server", () => {
    const legacy: [string, string | undefined][] = [
        ["no contentType", undefined],
        ["application/json", "application/json"],
    ];

    for (const [label, contentType] of legacy) {
        it(`invokeaction with ${label}: the method does not run`, async () => {
            const { client, calls } = fakeClient();
            const form: OPCUAForm = { href, contentType, "opcua:method": "ns=1;s=Start" };
            const err = await refusal(client.invokeResource(form, new Content("", Readable.from([]))));
            expect(err.message).to.match(/opcua\+uabinary/);
            expect(calls).to.eql([]);
        });

        it(`readproperty with ${label}: no Read`, async () => {
            const { client, calls } = fakeClient();
            const err = await refusal(client.readResource({ href, contentType }));
            expect(err.message).to.match(/opcua\+uabinary/);
            expect(calls).to.eql([]);
        });

        it(`observeproperty with ${label}: no monitored item`, async () => {
            const { client, calls } = fakeClient();
            const err = await refusal(client.subscribeResource({ href, contentType }, () => undefined));
            expect(err.message).to.match(/opcua\+uabinary/);
            expect(calls).to.eql([]);
        });
    }
});
