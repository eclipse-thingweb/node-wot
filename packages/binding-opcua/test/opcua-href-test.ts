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

import { expect } from "chai";

import { OPCUAProtocolClient } from "../src/opcua-protocol-client";

describe("OPCUA Hrefs", () => {
    it("Example-1", () => {
        const form = { href: "opc.tcp://192.168.120.237:4840/?id=ns=10;i=12345" };
        const nodeId = OPCUAProtocolClient.getNodeId(form);
        expect(nodeId).equal("ns=10;i=12345");
    });
    it("Example-2", () => {
        const form = { href: "opc.tcp://192.168.120.237:4840/?id=nsu=http://widgets.com/schemas/hello;s=水 World" };
        const nodeId = OPCUAProtocolClient.getNodeId(form);
        expect(nodeId).equal("nsu=http://widgets.com/schemas/hello;s=水 World");
    });
    it("Example-3 #", () => {
        const form = { href: "opc.tcp://192.168.120.237:4840/?id=nsu=http://example.com/hello%23;s=temperature" };
        const nodeId = OPCUAProtocolClient.getNodeId(form);
        expect(nodeId).equal("nsu=http://example.com/hello#;s=temperature"); // %23 -> #
    });
    it("Example-4 &", () => {
        const form = { href: "opc.tcp://192.168.120.237:4840/?id=nsu=http://example.com/a%26b" };
        const nodeId = OPCUAProtocolClient.getNodeId(form);
        expect(nodeId).equal("nsu=http://example.com/a&b"); // %26 -> &
    });
    it("Example-5 relative", () => {
        const form = { href: "/?id=ns=10;i=12345" };
        expect(() => OPCUAProtocolClient.getNodeId(form)).to.throw(Error, "Invalid URL");
    });
});
