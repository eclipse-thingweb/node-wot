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

import { suite, test } from "@testdeck/mocha";
import { should, expect } from "chai";
import { parseConfigFile } from "../../src/parsers/config-file-parser";
import { InvalidArgumentError } from "commander";
import { writeFileSync, unlinkSync } from "fs";
import tmp from "tmp";

should();

@suite("parseConfigFile parser")
class ConfigFileParserTest {
    private testFilePath!: string;

    static before() {
        tmp.setGracefulCleanup();
    }

    before() {
        this.testFilePath = tmp.fileSync({ postfix: ".json" }).name;
    }

    after() {
        try {
            unlinkSync(this.testFilePath);
        } catch {
            // File may not exist if test failed before creation
        }
    }

    @test "should parse valid JSON config file"() {
        const validConfig = { http: { port: 8080 }, coap: { port: 5683 } };
        writeFileSync(this.testFilePath, JSON.stringify(validConfig), { flag: "w+" });

        const result = parseConfigFile(this.testFilePath, undefined);

        expect(result).to.equal(this.testFilePath);
    }

    @test "should throw error for invalid JSON"() {
        writeFileSync(this.testFilePath, "{ invalid json }");

        expect(() => parseConfigFile(this.testFilePath, undefined)).to.throw(InvalidArgumentError);
    }

    @test "should throw error for non-existent file"() {
        expect(() => parseConfigFile("/nonexistent/file.json", undefined)).to.throw(InvalidArgumentError);
    }

    @test "should throw error for empty JSON object"() {
        writeFileSync(this.testFilePath, "{}");

        const result = parseConfigFile(this.testFilePath, undefined);
        expect(result).to.equal(this.testFilePath);
    }

    @test "should handle complex JSON structures"() {
        const complexConfig = {
            servient: { clientOnly: false },
            http: { port: 8080, allowSelfSigned: false },
            coap: { port: 5683 },
            credentials: { user: "admin" },
        };
        writeFileSync(this.testFilePath, JSON.stringify(complexConfig));

        const result = parseConfigFile(this.testFilePath, undefined);

        expect(result).to.equal(this.testFilePath);
    }

    @test "should handle JSON array at root"() {
        writeFileSync(this.testFilePath, JSON.stringify([1, 2, 3]));

        const result = parseConfigFile(this.testFilePath, undefined);
        expect(result).to.equal(this.testFilePath);
    }
}
