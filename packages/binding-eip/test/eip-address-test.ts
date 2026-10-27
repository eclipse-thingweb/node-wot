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
import { parseEipHref } from "../src/eip-address";

describe("EtherNet/IP href parsing", () => {
    it("parses host, default port, route path and tag of the sample TD", () => {
        const address = parseEipHref("eip://192.168.178.122/1,0/Local:2:O");
        expect(address).to.deep.equal({
            host: "192.168.178.122",
            port: 44818,
            routePath: ["1", "0"],
            tagPath: "Local:2:O",
            byteOffset: 0,
        });
    });

    it("parses an explicit port", () => {
        expect(parseEipHref("eip://10.0.0.1:44819/1,0/MotorSpeed").port).to.equal(44819);
    });

    it("strips the brackets of IPv6 literals", () => {
        const address = parseEipHref("eip://[::1]/1,0/Program:Packaging.Counter");
        expect(address.host).to.equal("::1");
        expect(address.tagPath).to.equal("Program:Packaging.Counter");
    });

    it("keeps a multi-hop route path with an embedded IP address", () => {
        const address = parseEipHref("eip://10.0.0.1/1,4,2,192.168.1.20,1,0/Recipe");
        expect(address.routePath).to.deep.equal(["1", "4", "2", "192.168.1.20", "1", "0"]);
        expect(address.tagPath).to.equal("Recipe");
    });

    it("assumes route path 1,0 when it is omitted", () => {
        const address = parseEipHref("eip://10.0.0.1/MotorSpeed");
        expect(address.routePath).to.deep.equal(["1", "0"]);
        expect(address.tagPath).to.equal("MotorSpeed");
    });

    it("percent-decodes the tag path", () => {
        expect(parseEipHref("eip://h/1,0/Recipe%5B3%5D.SetPoint").tagPath).to.equal("Recipe[3].SetPoint");
        expect(parseEipHref("eip://h/1,0/Odd%2FName").tagPath).to.equal("Odd/Name");
    });

    it("reads the byte offset from the offset query parameter", () => {
        expect(parseEipHref("eip://h/1,0/Status?offset=12").byteOffset).to.equal(12);
    });

    it("rejects other schemes", () => {
        expect(() => parseEipHref("http://h/1,0/Tag")).to.throw("scheme");
    });

    it("rejects a missing host", () => {
        expect(() => parseEipHref("eip:///1,0/Tag")).to.throw();
    });

    it("rejects a missing tag path", () => {
        expect(() => parseEipHref("eip://h/1,0")).to.throw("tag");
        expect(() => parseEipHref("eip://h/1,0/")).to.throw("tag");
    });

    it("rejects an unencoded slash inside the tag path", () => {
        expect(() => parseEipHref("eip://h/1,0/a/b")).to.throw("%2F");
    });

    it("rejects malformed route paths", () => {
        expect(() => parseEipHref("eip://h/1/Tag")).to.throw("route");
        expect(() => parseEipHref("eip://h/1,x/Tag")).to.throw("route");
        expect(() => parseEipHref("eip://h/0,1/Tag")).to.throw("route");
        expect(() => parseEipHref("eip://h/1,300/Tag")).to.throw("route");
    });

    it("rejects malformed percent-encoding", () => {
        expect(() => parseEipHref("eip://h/1,0/Bad%ZZ")).to.throw("tag");
    });

    it("rejects unsupported or malformed query parameters", () => {
        expect(() => parseEipHref("eip://h/1,0/Tag?3")).to.throw("query");
        expect(() => parseEipHref("eip://h/1,0/Tag?offset=-1")).to.throw("offset");
        expect(() => parseEipHref("eip://h/1,0/Tag?offset=abc")).to.throw("offset");
    });
});
