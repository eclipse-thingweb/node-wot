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
import { should, expect, use as chaiUse } from "chai";
import { buildConfig, buildConfigFromFile, defaultConfiguration, Configuration } from "../src/configuration";
import Ajv, { ValidateFunction } from "ajv";
import ConfigSchema from "../src/generated/wot-servient-schema.conf";
import chaiAsPromised from "chai-as-promised";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { ValidationError } from "ajv";

should();
chaiUse(chaiAsPromised);

@suite("Configuration management")
class ConfigurationTest {
    private static validator: ValidateFunction<Configuration>;
    private testFilePath!: string;

    static before() {
        const ajv = new Ajv({ strict: true, allErrors: true });
        ConfigurationTest.validator = ajv.compile(ConfigSchema) as ValidateFunction<Configuration>;
    }

    before() {
        this.testFilePath = join(__dirname, "./resources", "test-config-" + Date.now() + ".json");
    }

    after() {
        try {
            unlinkSync(this.testFilePath);
        } catch {
            // File may not exist
        }
    }

    @test async "should use default configuration when none provided"() {
        const result = await buildConfig({}, defaultConfiguration, {}, ConfigurationTest.validator);

        expect(result).to.have.property("http");
        expect(result.http.port).to.equal(8080);
        expect(result.coap.port).to.equal(5683);
        expect(result.logLevel).to.equal("warn");
    }

    @test async "should handle credentials in config"() {
        const config = { ...defaultConfiguration, credentials: { THING_ID_1: { username: "user", password: "pass" } } };
        const result = await buildConfig({}, config, {}, ConfigurationTest.validator);

        expect(result.credentials).to.have.property("THING_ID_1");
    }

    @test async "should merge environment variables with defaults"() {
        const env = { HTTP_PORT: "9000" };
        const result = await buildConfig({}, defaultConfiguration, env, ConfigurationTest.validator);

        expect(result.http.port).to.equal(9000);
    }

    @test async "should apply config parameters"() {
        const options = { configParams: { http: { port: 8888 } } };
        const result = await buildConfig(options, defaultConfiguration, {}, ConfigurationTest.validator);

        expect(result.http.port).to.equal(8888);
    }

    @test async "should merge environment variables and config parameters"() {
        const env = { HTTP_PORT: "9000" };
        const options = { configParams: { coap: { port: 6000 } } };
        const result = await buildConfig(options, defaultConfiguration, env, ConfigurationTest.validator);

        expect(result.http.port).to.equal(9000);
        expect(result.coap.port).to.equal(6000);
    }

    @test "should validate merged configuration"() {
        const options = { configParams: { http: { port: "invalid" } } };

        expect(buildConfig(options, defaultConfiguration, {}, ConfigurationTest.validator)).to.eventually.throw(
            ValidationError
        );
    }

    @test async "should apply default values to provided config"() {
        const customConfig = { http: { port: 8888 } };
        const result = await buildConfig({}, customConfig, {}, ConfigurationTest.validator);

        expect(result.http.port).to.equal(8888);
        expect(result.coap.port).to.equal(defaultConfiguration.coap.port);
        expect(result.logLevel).to.equal(defaultConfiguration.logLevel);
    }

    @test async "should read and build config from file"() {
        const config = { http: { port: 7777 } };
        writeFileSync(this.testFilePath, JSON.stringify(config));

        const result = await buildConfigFromFile({}, this.testFilePath, {}, ConfigurationTest.validator);

        expect(result.http.port).to.equal(7777);
    }

    @test async "should merge file config with environment variables"() {
        const config = { http: { port: 7777 } };
        writeFileSync(this.testFilePath, JSON.stringify(config));

        const env = { COAP_PORT: "6000" };
        const result = await buildConfigFromFile({}, this.testFilePath, env, ConfigurationTest.validator);

        expect(result.http.port).to.equal(7777);
        expect(result.coap.port).to.equal(6000);
    }

    @test async "should handle configFile option"() {
        const config = { http: { port: 5555 } };
        writeFileSync(this.testFilePath, JSON.stringify(config));

        const options = { configFile: this.testFilePath };
        const result = await buildConfigFromFile(options, this.testFilePath, {}, ConfigurationTest.validator);

        expect(result.http.port).to.equal(5555);
    }

    @test "should throw error for invalid config file"() {
        writeFileSync(this.testFilePath, "{ invalid json }");

        expect(buildConfigFromFile({}, this.testFilePath, {}, ConfigurationTest.validator)).to.eventually.throw();
    }

    @test async "should convert string env variables to appropriate types"() {
        const env = { HTTP_PORT: "8080", SERVIENT_CLIENTONLY: "true", COAP_PORT: "5683" };
        const result = await buildConfig({}, defaultConfiguration, env, ConfigurationTest.validator);

        expect(result.http.port).to.equal(8080);
        expect(result.servient.clientOnly).to.equal(true);
        expect(result.coap.port).to.equal(5683);
    }
}
