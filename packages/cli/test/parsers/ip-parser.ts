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

import { suite, test } from "@testdeck/mocha";
import { should, expect } from "chai";
import { parseIp } from "../../src/parsers/ip-parser";
import { InvalidArgumentError } from "commander";

should();

@suite("parseIp parser")
class IpParserTest {
    @test "should parse valid IP address with port"() {
        const result = parseIp("127.0.0.1:9229", "");
        expect(result).to.equal("127.0.0.1:9229");
    }

    @test "should parse valid hostname with port"() {
        const result = parseIp("localhost:8080", "");
        expect(result).to.equal("localhost:8080");
    }

    @test "should parse valid port only"() {
        const result = parseIp(":9229", "");
        expect(result).to.equal(":9229");
    }

    @test "should parse IP address without port"() {
        const result = parseIp("192.168.1.1", "");
        expect(result).to.equal("192.168.1.1");
    }

    @test "should throw error for invalid format"() {
        expect(() => parseIp("invalid@address:9229", "")).to.throw(InvalidArgumentError);
    }

    @test "should throw error for port too short"() {
        expect(() => parseIp("127.0.0.1:1", "")).to.throw(InvalidArgumentError);
    }

    @test "should accept single-char hostname"() {
        const result = parseIp("a:9229", "");
        expect(result).to.equal("a:9229");
    }

    @test "should accept full IP address ranges"() {
        const result = parseIp("192.168.0.255:65535", "");
        expect(result).to.equal("192.168.0.255:65535");
    }
}
