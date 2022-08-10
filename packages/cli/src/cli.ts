#!/usr/bin/env node
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

// default implementation of W3C WoT Servient (http(s) and file bindings)
import DefaultServient from "./cli-default-servient";

// tools
import fs = require("fs");
import * as dotenv from "dotenv";
import * as path from "path";
import { Command, InvalidArgumentError, Argument } from "commander";
import Ajv, { ValidateFunction, ErrorObject } from "ajv";
import ConfigSchema from "./wot-servient-schema.conf.json";
import _ from "lodash";
import { version } from "@node-wot/core/package.json";
import { createLoggers } from "@node-wot/core";

const { error, info, warn } = createLoggers("cli", "cli");

const program = new Command();
const ajv = new Ajv({ strict: true });
const schemaValidator = ajv.compile(ConfigSchema) as ValidateFunction;
const defaultFile = "wot-servient.conf.json";
const baseDir = ".";

const dotEnvConfigParamters: DotEnvConfigParameter = {};

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

// Typings
type DotEnvConfigParameter = {
    [key: string]: unknown;
};
interface DebugParams {
    shouldBreak: boolean;
    host: string;
    port: number;
}

// Parsers & validators
function parseIp(value: string, previous: string) {
    if (!/^([a-z]*|[\d.]*)(:[0-9]{2,5})?$/.test(value)) {
        throw new InvalidArgumentError("Invalid host:port combo");
    }

    return value;
}
function parseConfigFile(filename: string, previous: string) {
    try {
        const open = filename || path.join(baseDir, defaultFile);
        const data = fs.readFileSync(open, "utf-8");
        if (!schemaValidator(JSON.parse(data))) {
            throw new InvalidArgumentError(
                `Config file contains invalid an JSON: ${(schemaValidator.errors ?? [])
                    .map((o: ErrorObject) => o.message)
                    .join("\n")}`
            );
        }
        return filename;
    } catch (err) {
        throw new InvalidArgumentError(`Error reading config file: ${err}`);
    }
}
function parseConfigParams(param: string, previous: unknown) {
    // Validate key-value pair
    if (!/^([a-zA-Z0-9_.]+):=([a-zA-Z0-9_]+)$/.test(param)) {
        throw new InvalidArgumentError("Invalid key-value pair");
    }
    const fieldNamePath = param.split(":=")[0];
    const fieldNameValue = param.split(":=")[1];
    let fieldNameValueCast;
    if (Number(fieldNameValue)) {
        fieldNameValueCast = +fieldNameValue;
    } else if (fieldNameValue === "true" || fieldNameValue === "false") {
        fieldNameValueCast = Boolean(fieldNameValue);
    } else {
        fieldNameValueCast = fieldNamePath;
    }

    // Build object using dot-notation JSON path
    const obj = _.set({}, fieldNamePath, fieldNameValueCast);
    if (!schemaValidator(obj)) {
        throw new InvalidArgumentError(
            `Config parameter '${param}' is not valid: ${(schemaValidator.errors ?? [])
                .map((o: ErrorObject) => o.message)
                .join("\n")}`
        );
    }
    // Concatenate validated paramters
    let result = previous ?? {};
    result = _.merge(result, obj);
    return result;
}

// CLI options declaration
program
    .option("-i, --inspect [host]:[port]", "activate inspector on host:port (default: 127.0.0.1:9229)", parseIp)
    .option("-ib, --inspect-brk [host]:[port]", "activate inspector on host:port (default: 127.0.0.1:9229)", parseIp)
    .option("-c, --client-only", "do not start any servers (enables multiple instances without port conflicts)")
    .option("-cp, --compiler <module>", "load module as a compiler")
    .option(
        "-f, --config-file <file>",
        "load configuration from specified file",
        parseConfigFile,
        "wot-servient.conf.json"
    )
    .option(
        "-p, --config-params <param...>",
        "override configuration paramters [key1:=value1 key2:=value2 ...] (e.g. http.port:=8080)",
        parseConfigParams
    );

// CLI arguments
program.addArgument(
    new Argument(
        "[files...]",
        "script files to execute. If no script is given, all .js files in the current directory are loaded. If one or more script is given, these files are loaded instead of the directory."
    )
);

program.parse(process.argv);
const options = program.opts();
const args = program.args;

// .env parsing
const env: dotenv.DotenvConfigOutput = dotenv.config();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (env.error && (env.error as any).code && (env.error as any).code !== "ENOENT") {
    throw env.error;
} else if (env.parsed) {
    for (const [key, value] of Object.entries(env.parsed)) {
        // Parse and validate on configfile-related entries
        if (key.startsWith("config.")) {
            dotEnvConfigParamters[key.replace("config.", "")] = value;
        }
    }
}

// Functions
async function buildConfig(): Promise<unknown> {
    const fileToOpen = options.configFile || path.join(baseDir, defaultFile);
    let configFileData = {};

    // JSON config file
    try {
        configFileData = JSON.parse(await fs.promises.readFile(fileToOpen, "utf-8"));
    } catch (err) {
        error(`WoT-Servient config file error: ${err}`);
    }

    // .env file
    for (const [key, value] of Object.entries(dotEnvConfigParamters)) {
        const obj = _.set({}, key, value);
        configFileData = _.merge(configFileData, obj);
    }

    // CLI arguments
    if (options.configParams) {
        configFileData = _.merge(configFileData, options.configParams);
    }

    return configFileData;
}
const loadCompilerFunction = function (compilerModule: string | undefined) {
    if (compilerModule) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const compilerMod = require(compilerModule);

        if (!compilerMod.create) {
            throw new Error("No create function defined for " + compilerModule);
        }

        const compilerObject = compilerMod.create();

        if (!compilerObject.compile) {
            throw new Error("No compile function defined for create return object");
        }
        return compilerObject.compile;
    }
    return undefined;
};
const loadEnvVariables = function () {
    const env: dotenv.DotenvConfigOutput = dotenv.config();

    // ignore file not found but throw otherwise
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (env.error && (env.error as any).code && (env.error as any).code !== "ENOENT") {
        throw env.error;
    }
    return env;
};

const runScripts = async function (servient: DefaultServient, scripts: Array<string>, debug?: DebugParams) {
    const env = loadEnvVariables();

    const launchScripts = (scripts: Array<string>) => {
        const compile = loadCompilerFunction(options.compiler);
        scripts.forEach((fname: string) => {
            info(`WoT-Servient reading script ${fname}`);
            fs.readFile(fname, "utf8", (err, data) => {
                if (err) {
                    error(`WoT-Servient experienced error while reading script. ${err}`);
                } else {
                    // limit printout to first line
                    info(
                        `WoT-Servient running script '${data.substr(0, data.indexOf("\n")).replace("\r", "")}'... (${
                            data.split(/\r\n|\r|\n/).length
                        } lines)`
                    );

                    fname = path.resolve(fname);
                    servient.runPrivilegedScript(data, fname, {
                        argv: args,
                        env: env.parsed,
                        compiler: compile,
                    });
                }
            });
        });
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const inspector = require("inspector");
    if (debug && debug.shouldBreak) {
        // Activate inspector only if is not already opened and wait for the debugger to attach
        !inspector.url() && inspector.open(debug.port, debug.host, true);

        // Set a breakpoint at the first line of of first script
        // the breakpoint gives time to inspector clients to set their breakpoints
        const session = new inspector.Session();
        session.connect();
        session.post("Debugger.enable", (error: Error) => {
            if (error) {
                warn("Cannot set breakpoint; reason: cannot enable debugger");
                warn(error.toString());
            }

            session.post(
                "Debugger.setBreakpointByUrl",
                {
                    lineNumber: 0,
                    url: "file:///" + path.resolve(scripts[0]).replace(/\\/g, "/"),
                },
                (err: Error) => {
                    if (err) {
                        warn("Cannot set breakpoint");
                        warn(error.toString());
                    }
                    launchScripts(scripts);
                }
            );
        });
    } else {
        // Activate inspector only if is not already opened and don't wait
        debug && !inspector.url() && inspector.open(debug.port, debug.host, false);
        launchScripts(scripts);
    }
};

const runAllScripts = function (servient: DefaultServient, debug?: DebugParams) {
    fs.readdir(baseDir, (err, files) => {
        if (err) {
            warn(`WoT-Servient experienced error while loading directory. ${err}`);
            return;
        }

        // unhidden .js files
        const scripts = files.filter((file) => {
            return file.substr(0, 1) !== "." && file.slice(-3) === ".js";
        });
        info(`WoT-Servient using current directory with ${scripts.length} script${scripts.length > 1 ? "s" : ""}`);

        runScripts(
            servient,
            scripts.map((filename) => path.resolve(path.join(baseDir, filename))),
            debug
        );
    });
};

buildConfig()
    .then((conf) => {
        return new DefaultServient(options.clientOnly, conf);
    })
    .catch((err) => {
        if (err.code === "ENOENT" && !options.configFile) {
            warn(`WoT-Servient using defaults as '${defaultFile}' does not exist`);
            return new DefaultServient(options.clientOnly);
        } else {
            error(`"WoT-Servient config file error. ${err}`);
            process.exit(err.errno);
        }
    })
    .then((servient) => {
        servient
            .start()
            .then(() => {
                if (args.length > 0) {
                    info(`WoT-Servient loading ${args.length} command line script${args.length > 1 ? "s" : ""}`);
                    return runScripts(servient, args, options.inspect || options.inspectBrk);
                } else {
                    return runAllScripts(servient, options.inspect || options.inspectBrk);
                }
            })
            .catch((err) => {
                error(`WoT-Servient cannot start. ${err}`);
            });
    })
    .catch((err) => error(`WoT-Servient main error. ${err}`));
