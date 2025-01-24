/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
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

/**
 * Basic test suite to demonstrate test setup
 * uncomment the @skip to see failing tests
 *
 * h0ru5: there is currently some problem with VSC failing to recognize experimentalDecorators option, it is present in both tsconfigs
 */

import { suite, test } from "@testdeck/mocha";
import { should, assert } from "chai";
import DefaultServient from "../src/cli-default-servient";

import fs from "fs";
import { EventEmitter } from "stream";
// should must be called to augment all variables
should();

@suite("Test suite for script runtime")
class WoTRuntimeTest {
    static servient: DefaultServient;

    static WoT: typeof WoT;

    exit: (code?: number) => never = () => {
        throw new Error("");
    };

    static async before() {
        EventEmitter.setMaxListeners(20);
        this.servient = new DefaultServient(true);
        await this.servient.start();
    }

    beforeEach() {
        this.exit = process.exit;
    }

    afterEach() {
        process.exit = this.exit;
    }

    static async after(): Promise<void> {
        await this.servient.shutdown();
    }

    @test "should provide cli args"() {
        const envScript = `process.argv[0]`;

        const test = WoTRuntimeTest.servient.runScript(envScript, undefined, { argv: ["myArg"] });
        assert.equal(test, "myArg");
    }

    @test "should use the compiler function"() {
        const envScript = `this is not js`;

        const test = WoTRuntimeTest.servient.runScript(envScript, undefined, {
            compiler: () => {
                return "'ok'";
            },
        });
        assert.equal(test, "ok");
    }

    @test "should provide env variables"() {
        const envScript = `process.env.MY_VAR`;
        const test = WoTRuntimeTest.servient.runScript(envScript, undefined, { env: { MY_VAR: "test" } });
        assert.equal(test, "test");
    }

    @test "should hide system env variables"() {
        const envScript = `module.exports = process.env.OS`;

        const test = WoTRuntimeTest.servient.runScript(envScript);
        assert.equal(test, undefined);
    }

    @test "should require node builtin module"() {
        const envScript = `require("fs")`;

        const test = WoTRuntimeTest.servient.runScript(envScript);
        assert.equal(test, fs);
    }

    @test "should catch synchronous errors"() {
        const failNowScript = `throw new Error("Synchronous error in Servient sandbox");`;

        assert.doesNotThrow(() => {
            WoTRuntimeTest.servient.runScript(failNowScript);
        });
    }

    @test "should catch bad errors"() {
        const failNowScript = `throw "Bad synchronous error in Servient sandbox";`;

        assert.doesNotThrow(() => {
            WoTRuntimeTest.servient.runScript(failNowScript);
        });
    }

    @test "should catch bad asynchronous errors"(done: Mocha.Done) {
        // Mocha does not like string errors: https://github.com/trufflesuite/ganache-cli/issues/658
        // so here I am removing its listeners for uncaughtException.
        // WARNING:  Remove this line as soon the issue is resolved.
        const listeners = this.clearUncaughtListeners();
        let called = false;

        this.mockupProcessExitWithFunction(() => {
            if (!called) {
                done();
                this.restoreUncaughtListeners(listeners);
                called = true;
            }
        });

        const failThenScript = `setTimeout( () => { throw "Bad asynchronous error in Servient sandbox"; }, 1);`;

        assert.doesNotThrow(() => {
            WoTRuntimeTest.servient.runScript(failThenScript);
        });
    }

    private mockupProcessExitWithFunction(func: () => void) {
        // Mockup is needed cause servient will call process.exit()
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        process.exit = func;
    }

    private clearUncaughtListeners() {
        const listeners = process.listeners("uncaughtException");
        process.removeAllListeners("uncaughtException");
        return listeners;
    }

    private restoreUncaughtListeners(listeners: Array<NodeJS.UncaughtExceptionListener>) {
        listeners.forEach((element) => {
            process.on("uncaughtException", element);
        });
    }
}
