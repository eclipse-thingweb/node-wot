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
import { loadEnvVariables } from "../../src/utils/load-env-variables";

should();

@suite("loadEnvVariables utility")
class LoadEnvVariablesTest {
    private originalEnv!: NodeJS.ProcessEnv;

    beforeEach() {
        this.originalEnv = { ...process.env };
    }

    afterEach() {
        process.env = this.originalEnv;
    }

    @test "should filter environment variables by prefix"() {
        process.env.WOT_SERVIENT_HTTP_PORT = "8080";
        process.env.WOT_SERVIENT_COAP_PORT = "5683";
        process.env.OTHER_VAR = "value";

        const result = loadEnvVariables();

        expect(result).to.have.property("HTTP_PORT", "8080");
        expect(result).to.have.property("COAP_PORT", "5683");
        expect(result).to.not.have.property("OTHER_VAR");
    }

    @test "should return empty object when no matching variables are found"() {
        delete process.env.WOT_SERVIENT_HTTP_PORT;
        delete process.env.WOT_SERVIENT_COAP_PORT;

        const result = loadEnvVariables();

        expect(result).to.be.an("object");
        expect(Object.keys(result).length).to.equal(0);
    }

    @test "should use custom prefix"() {
        process.env.CUSTOM_PREFIX_VAR1 = "value1";
        process.env.CUSTOM_PREFIX_VAR2 = "value2";
        process.env.WOT_SERVIENT_VAR3 = "value3";

        const result = loadEnvVariables("CUSTOM_PREFIX_");

        expect(result).to.have.property("VAR1", "value1");
        expect(result).to.have.property("VAR2", "value2");
        expect(result).to.not.have.property("VAR3");
    }

    @test "should remove prefix from keys"() {
        process.env.WOT_SERVIENT_MYKEY = "myvalue";

        const result = loadEnvVariables();

        expect(result).to.have.property("MYKEY", "myvalue");
        expect(Object.keys(result)).to.not.include("WOT_SERVIENT_MYKEY");
    }
}
