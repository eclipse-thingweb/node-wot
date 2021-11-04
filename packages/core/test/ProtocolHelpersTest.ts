/* eslint-disable no-unused-expressions */
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
 * Basic test suite for helper functions
 * uncomment the @skip to see failing tests
 *
 * h0ru5: there is currently some problem with VSC failing to recognize experimentalDecorators option, it is present in both tsconfigs
 */

import { suite, test } from "@testdeck/mocha";

@suite("Protocol Helpers")
class ProtocolHelpersTest {
    @test.skip "should get form index "() {
        /** */
    }
    @test.skip "should get form index with defaults for property"() {
        /** */
    }
    @test.skip "should get form index with defaults for action"() {
        /** */
    }
    @test.skip "should get form index with defaults for event"() {
        /** */
    }
}
