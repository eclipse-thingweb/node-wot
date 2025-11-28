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
import { setLogLevel } from "../../src/utils/set-log-level";
import * as logger from "debug";

should();

@suite("setLogLevel utility")
class SetLogLevelTest {
    @test "should set debug log level"() {
        setLogLevel("debug");
        // Verify by checking that debug enables all node-wot loggers
        expect(logger.enabled("node-wot:test")).to.be.true;
    }

    @test "should set info log level"() {
        setLogLevel("info");
        // info level should enable error, warn, and info logs
        expect(logger.enabled("node-wot:test:error")).to.be.true;
        expect(logger.enabled("node-wot:test:warn")).to.be.true;
        expect(logger.enabled("node-wot:test:info")).to.be.true;
    }

    @test "should set warn log level"() {
        setLogLevel("warn");
        // warn level should enable error and warn logs
        expect(logger.enabled("node-wot:test:error")).to.be.true;
        expect(logger.enabled("node-wot:test:warn")).to.be.true;
    }

    @test "should set error log level"() {
        setLogLevel("error");
        // error level should only enable error logs
        expect(logger.enabled("node-wot:test:error")).to.be.true;
    }

    @test "should disable all loggers before reconfiguring"() {
        setLogLevel("debug");
        expect(logger.enabled("node-wot:test")).to.be.true;

        setLogLevel("error");
        // After switching to error level, debug logs should be disabled
        expect(logger.enabled("node-wot:test:debug")).to.be.false;
    }
}
