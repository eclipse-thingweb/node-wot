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
import DefaultServient, { ScriptOptions } from "./cli-default-servient";

// tools
import * as path from "path";
import { Command, Argument } from "commander";
import Ajv, { ValidateFunction } from "ajv";
import ConfigSchema from "./wot-servient-schema.conf.json";
import { version } from "@node-wot/core/package.json";
import { createLoggers } from "@node-wot/core";
import { buildConfig } from "./config-builder";
import { loadCompiler, loadEnvVariables } from "./utils";
import { runScripts } from "./script-runner";
import { readdir } from "fs/promises";
import * as logger from "debug";
import { parseConfigFile, parseConfigParams, parseIp } from "./parsers";

const { error, info, warn, debug } = createLoggers("cli", "cli");

const program = new Command();
const ajv = new Ajv({ strict: true });
const schemaValidator = ajv.compile(ConfigSchema) as ValidateFunction;
const defaultFile = "wot-servient.conf.json";
const baseDir = ".";

// General commands
program
    .name("wot-servient")
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
wot-servient.conf.json syntax:
{
    "servient": {
        "clientOnly": CLIENTONLY,
        "staticAddress": STATIC,
        "scriptAction": RUNSCRIPT
    },
    "http": {
        "port": HPORT,
        "address": HADDRESS,
        "baseUri": HBASEURI,
        "urlRewrite": HURLREWRITE,
        "proxy": PROXY,
        "allowSelfSigned": ALLOW
    },
    "mqtt" : {
        "broker": BROKER-URL,
        "username": BROKER-USERNAME,
        "password": BROKER-PASSWORD,
        "clientId": BROKER-UNIQUEID,
        "protocolVersion": MQTT_VERSION
    },
    "credentials": {
        THING_ID1: {
            "token": TOKEN
        },
        THING_ID2: {
            "username": USERNAME,
            "password": PASSWORD
        }
    }
}

wot-servient.conf.json fields:
  CLIENTONLY      : boolean setting if no servers shall be started (default=false)
  STATIC          : string with hostname or IP literal for static address config
  RUNSCRIPT       : boolean to activate the 'runScript' Action (default=false)
  HPORT           : integer defining the HTTP listening port
  HADDRESS        : string defining HTTP address
  HBASEURI        : string defining HTTP base URI
  HURLREWRITE     : map (from URL -> to URL) defining HTTP URL rewrites
  PROXY           : object with "href" field for the proxy URI,
                                "scheme" field for either "basic" or "bearer", and
                                corresponding credential fields as defined below
  ALLOW           : boolean whether self-signed certificates should be allowed
  BROKER-URL      : URL to an MQTT broker that publisher and subscribers will use
  BROKER-UNIQUEID : unique id set by MQTT client while connecting to the broker
  MQTT_VERSION    : number indicating the MQTT protocol version to be used (3, 4, or 5)
  THING_IDx       : string with TD "id" for which credentials should be configured
  TOKEN           : string for providing a Bearer token
  USERNAME        : string for providing a Basic Auth username
  PASSWORD        : string for providing a Basic Auth password
  ---------------------------------------------------------------------------

Environment variables must be provided in a .env file in the current working directory.

Example:
VAR1=Value1
VAR2=Value2`
);

// CLI options declaration
program
    .option("-i, --inspect [host]:[port]", "activate inspector on host:port (default: 127.0.0.1:9229)", parseIp)
    .option("-ib, --inspect-brk [host]:[port]", "activate inspector on host:port (default: 127.0.0.1:9229)", parseIp)
    .option("-c, --client-only", "do not start any servers (enables multiple instances without port conflicts)")
    .option("-cp, --compiler <module>", "load module as a compiler")
    .option("-f, --config-file <file>", "load configuration from specified file", (value, previous) =>
        parseConfigFile(value, previous, schemaValidator)
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

program.action(async function (_, options, cmd) {
    if (process.env.DEBUG == null) {
        // by default enable error logs and warnings
        // user can override it using DEBUG env
        logger.enable("node-wot:**:error");
        logger.enable("node-wot:**:warn");
    }

    const args = cmd.args;
    const env = loadEnvVariables();
    const defaultFilePath = path.join(baseDir, defaultFile);
    let servient: DefaultServient;

    debug("command line options %O", options);
    debug("command line arguments %O", args);
    debug("command line environment variables", args);

    try {
        const config = await buildConfig(options, defaultFilePath, env);
        servient = new DefaultServient(options.clientOnly, config);
    } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code !== "ENOENT" || options.configFile != null) {
            error("WoT-Servient config file error. %O", err);
            process.exit((err as NodeJS.ErrnoException).errno ?? 1);
        }

        warn(`WoT-Servient using defaults as %s does not exist`, defaultFile);
        servient = new DefaultServient(options.clientOnly);
    }

    await servient.start();

    const scriptOptions: ScriptOptions = {
        env,
        argv: args,
        compiler: loadCompiler(options.compiler),
    };

    if (args.length > 0) {
        return runScripts(servient, args, scriptOptions, options.inspect ?? options.inspectBrk);
    }

    const files = await readdir(baseDir);
    const scripts = files.filter((file) => !file.startsWith(".") && file.slice(-3) === ".js");

    info(`WoT-Servient using current directory with %d script${scripts.length > 1 ? "s" : ""}`, scripts.length);

    return runScripts(servient, args, scriptOptions, options.inspect ?? options.inspectBrk);
});

program.parse(process.argv);
