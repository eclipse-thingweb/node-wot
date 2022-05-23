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
 * Protocol test suite for CoAP binding definitions
 */

import { suite, test } from "@testdeck/mocha";
import { expect } from "chai";
import { blockSizeToOptionValue } from "../src/coap";

@suite("CoAP Binding Definitions")
class CoapDefinitionsTest {
    @test "should map raw blocksizes to the correct option value"() {
        expect(blockSizeToOptionValue(16)).to.eq(0);
        expect(blockSizeToOptionValue(32)).to.eq(1);
        expect(blockSizeToOptionValue(64)).to.eq(2);
        expect(blockSizeToOptionValue(128)).to.eq(3);
        expect(blockSizeToOptionValue(256)).to.eq(4);
        expect(blockSizeToOptionValue(512)).to.eq(5);
        expect(blockSizeToOptionValue(1024)).to.eq(6);
    }
}
