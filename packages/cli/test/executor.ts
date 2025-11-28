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
import { Executor, WoTContext } from "../src/executor";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { Helpers } from "@node-wot/core";

should();

@suite("Executor")
class ExecutorTest {
    private executor!: Executor;
    private testFilePath!: string;
    private mockWoTContext!: WoTContext;

    before() {
        this.executor = new Executor();
        this.testFilePath = join(__dirname, "./resources", "test-script-" + Date.now());
        this.mockWoTContext = {
            // We are not using WoT inside this testing scripts
            runtime: {} as typeof WoT,
            helpers: {} as Helpers,
        };
    }

    after() {
        try {
            unlinkSync(this.testFilePath + ".js");
        } catch {
            // File may not exist
        }
        try {
            unlinkSync(this.testFilePath + ".mjs");
        } catch {
            // File may not exist
        }
        try {
            unlinkSync(this.testFilePath + ".ts");
        } catch {
            // File may not exist
        }
        try {
            unlinkSync(this.testFilePath + ".tsx");
        } catch {
            // File may not exist
        }
    }

    @test async "should execute JavaScript file"() {
        const scriptContent = "module.exports = 'test result';";
        writeFileSync(this.testFilePath + ".js", scriptContent);

        const result = await this.executor.exec(this.testFilePath + ".js", this.mockWoTContext);

        expect(result).to.equal("test result");
    }

    @test async "should have WoT defined"() {
        const scriptContent = "module.exports = typeof global.WoT !== 'undefined';";
        writeFileSync(this.testFilePath + ".js", scriptContent);

        const result = await this.executor.exec(this.testFilePath + ".js", this.mockWoTContext);

        expect(result).to.be.true;
    }

    @test async "should handle module exports"() {
        const scriptContent = "module.exports = { message: 'hello' };";
        writeFileSync(this.testFilePath + ".js", scriptContent);

        const result = await this.executor.exec(this.testFilePath + ".js", this.mockWoTContext);

        expect(result).to.have.property("message", "hello");
    }

    @test async "should detect TypeScript files by .ts extension"() {
        const scriptContent = "export const value: number = 42;";
        writeFileSync(this.testFilePath + ".ts", scriptContent);

        const { value } = (await this.executor.exec(this.testFilePath + ".ts", this.mockWoTContext)) as {
            value: number;
        };

        expect(value).to.be.eq(42);
    }

    @test async "should handle .mjs files as ES modules"() {
        const filePath = this.testFilePath + ".mjs";
        const scriptContent = "export const value = 'es module';";
        writeFileSync(filePath, scriptContent);

        const { value } = (await this.executor.exec(filePath, this.mockWoTContext)) as { value: string };
        expect(value).to.be.eq("es module");
    }
}
