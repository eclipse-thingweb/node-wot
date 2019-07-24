/********************************************************************************
 * Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
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

import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import { expect, should, assert } from "chai";
// should must be called to augment all variables
should();

import Servient from "../src/servient";


@suite("the runtime of servient")
class WoTRuntimeTest {

    static servient: Servient;
    static WoT: WoT.WoT;

    static before() {
        this.servient = new Servient();
        console.log("before starting test suite");
    }

    static after() {
        console.log("after finishing test suite");
        this.servient.shutdown();
    }

    @test "should catch synchronous errors"() {

        let failNowScript = `throw new Error("Synchronous error in Servient sandbox");`;

        assert.doesNotThrow( () => { WoTRuntimeTest.servient.runScript(failNowScript); });
        assert.doesNotThrow( () => { WoTRuntimeTest.servient.runPrivilegedScript(failNowScript); });
    }

    @test "should catch bad errors"() {

        let failNowScript = `throw "Bad synchronous error in Servient sandbox";`;

        assert.doesNotThrow( () => { WoTRuntimeTest.servient.runScript(failNowScript); });
        assert.doesNotThrow( () => { WoTRuntimeTest.servient.runPrivilegedScript(failNowScript); });
    }

    @test "should catch asynchronous errors"() {

        let failThenScript = `setTimeout( () => { throw new Error("Asynchronous error in Servient sandbox"); }, 1);`;

        assert.doesNotThrow( () => { WoTRuntimeTest.servient.runScript(failThenScript); });
        assert.doesNotThrow( () => { WoTRuntimeTest.servient.runPrivilegedScript(failThenScript); });
    }

    @test "should catch bad asynchronous errors"() {

        let failThenScript = `setTimeout( () => { throw "Bad asynchronous error in Servient sandbox"; }, 1);`;

        assert.doesNotThrow( () => { WoTRuntimeTest.servient.runScript(failThenScript); });
        assert.doesNotThrow( () => { WoTRuntimeTest.servient.runPrivilegedScript(failThenScript); });
    }
}
