#!/usr/bin/env node
/********************************************************************************
 * Copyright (c) 2018 - 2021 Contributors to the Eclipse Foundation
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

// global W3C WoT Scripting API definitions
// using core definitions instead of 'wot-typescript-definitions' to avoid typing error
import _ from "@node-wot/core";
// node-wot implementation of W3C WoT Servient
import { Servient } from "@node-wot/core";

// node-wot implementation of W3C WoT Servient
import CoapServient from "./coap-servient";

// tools
import fs = require("fs");
import * as path from "path";

const confFile = "my-cli.conf.json";
const baseDir = ".";

const readConf = function (): Promise<any> {
    return new Promise((resolve, reject) => {
        fs.readFile(path.join(baseDir, confFile), "utf-8", (err, data) => {
            if (err) {
                reject(err);
            }
            if (data) {
                const config = JSON.parse(data);
                console.info("my-cli using conf file", confFile);
                resolve(config);
            }
        });
    });
};

const runScripts = function (srv: CoapServient, scripts: Array<string>): void {
    scripts.forEach((fname) => {
        console.info("my-cli reading script", fname);
        fs.readFile(fname, "utf8", (err, data) => {
            if (err) {
                console.error("WoT-Servient experienced error while reading script", err);
            } else {
                // limit printout to first line
                console.info(`my-cli running script '${data.substr(0, data.indexOf("\n"))}...'`);
                srv.runPrivilegedScript(data, fname);
            }
        });
    });
};

const runAllScripts = function (srv: CoapServient): void {
    const scriptDir = path.join(baseDir, srv.config.servient.scriptDir);
    fs.readdir(scriptDir, (err, files) => {
        if (err) {
            console.warn("my-cli experienced error while loading directory", err);
            return;
        }

        // unhidden .js files
        let scripts = files.filter((file) => {
            return file.substr(0, 1) !== "." && file.slice(-3) === ".js";
        });
        console.info(
            `my-cli loading directory '${scriptDir}' with ${scripts.length} script${scripts.length > 1 ? "s" : ""}`
        );

        runScripts(
            srv,
            scripts.map((value) => path.join(scriptDir, value))
        );
    });
};

// main
if (process.argv.length > 2) {
    process.argv.slice(2).forEach((arg) => {
        if (arg.match(/^(-h|--help|\/?|\/h)$/i)) {
            console.log(`Usage: my-cli [SCRIPT]...
Run a WoT Servient in the current directory. Automatically loads all .js files in the directory.
If my-cli.conf.json exists, that configuration is applied and scripts in 'scriptDir' are loaded.
If one or more SCRIPT is given, these files are loaded instead of the directory.
If no script is found, the Servient is still started and provides a 'runScript' Action.
Examples: my-cli
          my-cli ../../scripts/counter.js

my-cli.conf.json:
{
    "servient": {
        "scriptDir": AUTORUN,
        "scriptAction": RUNSCRIPT
    },
    "coap": {
        "port": PORT
    }
}
  AUTORUN is a path string for the directory to load at startup
  RUNSCRIPT is a boolean indicating whether to provide the 'runScript' Action
  PORT is a number defining the CoAP listening port`);
            process.exit(0);
        }
    });
}
readConf()
    .then((conf) => {
        return new CoapServient(conf);
    })
    .catch((err) => {
        if (err.code == "ENOENT") {
            console.warn("my-cli using defaults as 'coap-servient.conf.json' does not exist");
            return new CoapServient();
        } else {
            console.error("my-cli config file error: " + err.message);
            process.exit(err.errno);
        }
    })
    .then((servient) => {
        servient
            .start()
            .then(() => {
                if (process.argv.length > 2) {
                    console.info(
                        `my-cli loading ${process.argv.length - 2} command line script${
                            process.argv.length - 2 > 1 ? "s" : ""
                        }`
                    );
                    return runScripts(servient, process.argv.slice(2));
                } else {
                    return runAllScripts(servient);
                }
            })
            .catch((err) => {
                console.error("my-cli cannot start: " + err.message);
            });
    })
    .catch((err) => console.error(err));
