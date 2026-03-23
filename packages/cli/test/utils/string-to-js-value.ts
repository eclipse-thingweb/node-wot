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
import { stringToJSValue } from "../../src/utils/string-to-js-value";

should();

@suite("stringToJSValue utility")
class StringToJSValueTest {
    @test "should convert numeric string to number"() {
        expect(stringToJSValue("42")).to.equal(42);
        expect(stringToJSValue("0")).to.equal(0);
        expect(stringToJSValue("1000")).to.equal(1000);
    }

    @test "should convert string 'true' to boolean true"() {
        expect(stringToJSValue("true")).to.equal(true);
    }

    @test "should convert string 'false' to boolean false"() {
        expect(stringToJSValue("false")).to.equal(false);
    }

    @test "should return original string for non-numeric, non-boolean values"() {
        expect(stringToJSValue("hello")).to.equal("hello");
        expect(stringToJSValue("myValue")).to.equal("myValue");
    }

    @test "should handle floating point numbers"() {
        expect(stringToJSValue("3.14")).to.equal(3.14);
        expect(stringToJSValue("0.5")).to.equal(0.5);
    }

    @test "should handle negative numbers"() {
        expect(stringToJSValue("-42")).to.equal(-42);
        expect(stringToJSValue("-3.14")).to.equal(-3.14);
    }

    @test "should return string for non-strictly-boolean values"() {
        expect(stringToJSValue("True")).to.equal("True");
        expect(stringToJSValue("False")).to.equal("False");
        expect(stringToJSValue("TRUE")).to.equal("TRUE");
    }
}
