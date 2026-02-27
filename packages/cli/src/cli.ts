/********************************************************************************
 * Copyright (c) 2018 Contributors to the Eclipse Foundation
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

// default implementation of W3C WoT Servient (http(s) and file bindings)
import DefaultServient from "./cli-default-servient";

// tools
import * as path from "path";
import { Command, Argument, Option } from "commander";
import Ajv, { ValidateFunction } from "ajv";
import ConfigSchema from "./generated/wot-servient-schema.conf";
import version from "./generated/version";
import { createLoggers, Helpers } from "@node-wot/core";
import { loadEnvVariables } from "./utils";
import { runScripts } from "./script-runner";
import { readdir } from "fs/promises";
import { parseConfigFile, parseConfigParams } from "./parsers";
import { setLogLevel } from "./utils/set-log-level";
import { buildConfig, buildConfigFromFile, Configuration, defaultConfiguration } from "./configuration";
import { cloneDeep } from "lodash";

const { error, info, warn, debug } = createLoggers("cli", "cli");

const program = new Command();
const ajv = new Ajv({ strict: true, allErrors: true });
const schemaValidator = ajv.compile(ConfigSchema) as ValidateFunction<Configuration>;
const defaultFile = "wot-servient.conf.json";
const baseDir = ".";

// General commands
program
    .name("node-wot")
    .description(
        `
Run a WoT Servient in the current directory.
    `
    )
    .helpOption("-h, --help", "show this help")
    .version(version, "-v, --version", "display node-wot version");

// Help infos
program.addHelpText(
    "after",
    `
Configuration

Settings can be applied through three methods, in order of precedence (highest to lowest):

1.  Command-Line Parameters (-p path.to.set=value)
2.  Environment Variables (NODE_WOT_PATH_TO_SET=value) (supports .env files too)
3.  Configuration File

For the complete list of available configuration fields and their data types, run:

node-wot schema

In your configuration files you can the following to enable IDE config validation:

{
    "$schema": "./node_modules/@node-wot/cli/dist/wot-servient-schema.conf.json"
    ...
}
    `
);

// CLI options declaration
program
    .option("-c, --client-only", "do not start any servers (enables multiple instances without port conflicts)")
    .addOption(
        new Option(
            "-ll, --logLevel <string>",
            "choose the desired log level. WARNING: if DEBUG env variable is specified this option gets overridden."
        ).choices(["debug", "info", "warn", "error"])
    )
    .option(
        "-f, --config-file <file>",
        "load configuration from specified file (default: $(pwd)/wot-servient.conf.json)",
        (value, previous) => parseConfigFile(value, previous)
    )
    .option(
        "-p, --config-params <param...>",
        "override configuration parameters [key1:=value1 key2:=value2 ...] (e.g. http.port:=8080)",
        (value, previous) => parseConfigParams(value, previous, schemaValidator)
    );

// CLI arguments
program.addArgument(
    new Argument(
        "[files...]",
        "script files to execute. If no script is given, all .js files in the current directory are loaded. If one or more script is given, these files are loaded instead of the directory."
    )
);

program
    .command("schema")
    .description("prints the json schema for the configuration file")
    .action(() => {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(ConfigSchema, null, 2));
    });

program.action(async function (_, options, cmd) {
    // Allow user to personalized the env
    if (process.env.DEBUG == null) {
        // by default enable error logs and warnings
        // user can override using command line option
        // or later by config file.
        setLogLevel(options.logLevel ?? "warn");
    }

    const args = cmd.args;
    const env = loadEnvVariables();
    const defaultFilePath = path.join(baseDir, defaultFile);
    let servient: DefaultServient;

    debug("command line options %O", options);
    debug("command line arguments %O", args);
    debug("command line environment variables", args);

    try {
        const config = await buildConfigFromFile(options, defaultFilePath, env, schemaValidator);
        setLogLevel(options.logLevel ?? config.log.level);
        config.servient.clientOnly = options.clientOnly ?? config.servient.clientOnly;
        servient = new DefaultServient(config);
    } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code !== "ENOENT" || options.configFile != null) {
            error("node-wot configuration file error:\n%O\nClose.", err);
            process.exit((err as NodeJS.ErrnoException).errno ?? 1);
        }

        warn(`node-wot using defaults as %s does not exist`, defaultFile);

        const config = await buildConfig(options, cloneDeep(defaultConfiguration), env, schemaValidator);
        config.servient.clientOnly = options.clientOnly ?? config.servient.clientOnly;
        servient = new DefaultServient(config);
    }

    const runtime = await servient.start();
    const helpers = new Helpers(servient);

    if (args.length > 0) {
        return runScripts({ runtime, helpers }, args, options.inspect ?? options.inspectBrk);
    }

    const files = await readdir(baseDir);
    const scripts = files.filter((file) => !file.startsWith(".") && file.slice(-3) === ".js");

    info(`node-wot using current directory with %d script${scripts.length > 1 ? "s" : ""}`, scripts.length);

    return runScripts({ runtime, helpers }, scripts, options.inspect ?? options.inspectBrk);
});

program.parse(process.argv);
