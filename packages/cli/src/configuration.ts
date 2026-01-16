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

import { FromSchema } from "json-schema-to-ts";
import schema from "./generated/wot-servient-schema.conf";
import { DotenvParseOutput } from "dotenv";
import _ from "lodash";
import { readFile } from "fs/promises";
import { ValidateFunction, ValidationError } from "ajv";
import { stringToJSValue } from "./utils";
import { createLoggers } from "@node-wot/core";

const { debug } = createLoggers("cli", "cli-default-servient");

type Merge<T, U> = { [K in keyof T as K extends keyof U ? never : K]: T[K] } & {
    [L in keyof U & keyof T]: Merge<T[L], U[L]>;
} & { [J in keyof U as J extends keyof T ? never : J]: U[J] };

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
type Generalize<T> = T extends number
    ? number
    : T extends string
      ? string
      : T extends boolean
        ? boolean
        : T extends Array<infer U>
          ? Array<Generalize<U>>
          : T extends object
            ? { [K in keyof T]: Generalize<T[K]> }
            : T;
export type Configuration = FromSchema<typeof schema>;

export const defaultConfiguration = Object.freeze({
    servient: {
        clientOnly: false,
    },
    http: {
        port: 8080,
        allowSelfSigned: false,
    },
    coap: {
        port: 5683,
    },
    credentials: {},
    log: { level: "warn" },
} as const satisfies Configuration);

export type ConfigurationAfterDefaults = Merge<Configuration, Generalize<Mutable<typeof defaultConfiguration>>>;

/**
 * Helper function to convert an ENV key to a camelCased path
 * using the schema as reference (e.g., SERVIENT_STATICADDRESS -> servient.staticAddress)
 */
function envKeyToConfigPath(envKey: string): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let properties: { [x: string]: any } = schema.properties;
    const pathParts = envKey.toLowerCase().replace(/__/g, ".").replace(/_/g, ".").split(".");
    let path = "";
    for (const part of pathParts) {
        const matchedProperty = Object.keys(properties).find((prop) => prop.toLowerCase() === part);
        if (matchedProperty != null) {
            path += (path.length > 0 ? "." : "") + matchedProperty;
            const nextProperty = properties[matchedProperty as keyof typeof properties];
            if ("properties" in nextProperty) {
                properties = nextProperty.properties;
            }
        } else {
            // If no matching property is found, append the original part we are going to catch
            // errors in the validation phase later
            path += (path.length > 0 ? "." : "") + part;
        }
    }
    return path;
}

export async function buildConfig(
    options: Record<string, unknown>,
    configuration: Configuration,
    dotEnvConfigParameters: DotenvParseOutput,
    validator: ValidateFunction<Configuration>
): Promise<ConfigurationAfterDefaults> {
    let config = configuration;

    for (const [key, value] of Object.entries(dotEnvConfigParameters)) {
        debug("Applying env variable %s=%s", key, value);
        const path = envKeyToConfigPath(key);
        debug("Mapped to config path %s", path);
        const obj = _.set({}, path, stringToJSValue(value));
        config = _.merge(config, obj);
    }

    if (options?.configParams != null) {
        config = _.merge(config, options.configParams);
    }

    config = _.merge({}, defaultConfiguration, config);

    if (!validator(config)) {
        throw new ValidationError(validator.errors ?? []);
    }

    return config as ConfigurationAfterDefaults;
}

export async function buildConfigFromFile(
    options: Record<string, unknown>,
    defaultFile: string,
    dotEnvConfigParameters: DotenvParseOutput,
    validator: ValidateFunction<Configuration>
): Promise<ConfigurationAfterDefaults> {
    let fileToOpen = defaultFile;

    if (typeof options.configFile === "string") {
        fileToOpen = options.configFile;
    }

    const configFileData = JSON.parse(await readFile(fileToOpen, "utf-8"));

    return buildConfig(options, configFileData, dotEnvConfigParameters, validator);
}
