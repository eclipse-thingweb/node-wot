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
import { parseConfigParams } from "../../src/parsers/config-params-parser";
import { InvalidArgumentError } from "commander";
import Ajv, { ValidateFunction } from "ajv";
import ConfigSchema from "../../src/generated/wot-servient-schema.conf";
import { Configuration } from "../../src/configuration";

should();

@suite("parseConfigParams parser")
class ConfigParamsParserTest {
    private static validator: ValidateFunction<Configuration>;

    static before() {
        const ajv = new Ajv({ strict: true, allErrors: true });
        ConfigParamsParserTest.validator = ajv.compile(ConfigSchema) as ValidateFunction<Configuration>;
    }

    @test "should parse valid config parameter"() {
        const result = parseConfigParams("http.port:=8080", undefined, ConfigParamsParserTest.validator);

        expect(result).to.have.property("http");
        expect((result as any).http).to.have.property("port", 8080);
    }

    @test "should parse nested config parameter"() {
        const result = parseConfigParams("servient.clientOnly:=true", undefined, ConfigParamsParserTest.validator);

        expect(result).to.have.property("servient");
        expect((result as any).servient).to.have.property("clientOnly", true);
    }

    @test "should throw error for invalid key-value format"() {
        expect(() => parseConfigParams("invalid_format", undefined, ConfigParamsParserTest.validator)).to.throw(
            InvalidArgumentError
        );
    }

    @test "should throw error for missing colon-equals separator"() {
        expect(() => parseConfigParams("http.port=8080", undefined, ConfigParamsParserTest.validator)).to.throw(
            InvalidArgumentError
        );
    }

    @test "should throw error for invalid config parameter"() {
        expect(() =>
            parseConfigParams("nonexistent.path:=value", undefined, ConfigParamsParserTest.validator)
        ).to.throw(InvalidArgumentError);
    }

    @test "should merge with previous parameters"() {
        let result = parseConfigParams("http.port:=8080", undefined, ConfigParamsParserTest.validator);
        result = parseConfigParams("coap.port:=5683", result, ConfigParamsParserTest.validator);

        expect(result).to.have.property("http");
        expect(result).to.have.property("coap");
        expect((result as any).http.port).to.equal(8080);
        expect((result as any).coap.port).to.equal(5683);
    }

    @test "should handle boolean values"() {
        const result = parseConfigParams("servient.clientOnly:=true", undefined, ConfigParamsParserTest.validator);

        expect((result as any).servient.clientOnly).to.equal(true);
    }

    @test "should handle numeric values"() {
        const result = parseConfigParams("http.port:=9000", undefined, ConfigParamsParserTest.validator);

        expect((result as any).http.port).to.equal(9000);
    }

    @test "should override previous parameter"() {
        let result = parseConfigParams("http.port:=8080", undefined, ConfigParamsParserTest.validator);
        result = parseConfigParams("http.port:=9000", result, ConfigParamsParserTest.validator);

        expect((result as any).http.port).to.equal(9000);
    }
}
