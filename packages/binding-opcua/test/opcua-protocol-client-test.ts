/********************************************************************************
 * Copyright (c) 2025 Contributors to the Eclipse Foundation
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

import debugFactory from "debug";
import { expect } from "chai";
import { OPCUAServer } from "node-opcua-server";

import { startServer } from "./fixture/basic-opcua-server";
import { OPCUAForm, OPCUAProtocolClient } from "../src/opcua-protocol-client";

const debug = debugFactory("binding-opcua:test");

describe("OPCUA Protocol Client", function () {
    this.timeout(20000);

    let opcuaServer: OPCUAServer;
    let endpoint: string;
    before(async () => {
        opcuaServer = await startServer();
        endpoint = opcuaServer.getEndpointUrl();
        debug(`endpoint =  ${endpoint}`);
    });
    after(async () => {
        await opcuaServer.shutdown();
    });

    it("should read temperature and pressure property without recreating a connection", async () => {
        const client = new OPCUAProtocolClient();

        try {
            const form1: OPCUAForm = {
                href: `${endpoint}?id=ns=1;s=Temperature`,
                contentType: "application/json",
            };

            await client.readResource(form1);
            expect(client.connectionCount).equals(1);

            await client.readResource(form1);
            expect(client.connectionCount).equals(1);

            const form2: OPCUAForm = {
                href: `${endpoint}?id=ns=1;s=Pressure`,
                contentType: "application/json",
            };

            await client.readResource(form2);

            // connection should be reused, eventhough hrefs differ
            expect(client.connectionCount).equals(1);
        } finally {
            await client.stop();
        }
    });
});
