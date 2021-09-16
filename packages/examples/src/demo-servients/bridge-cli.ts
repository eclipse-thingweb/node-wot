#!/usr/bin/env node
/********************************************************************************
 * Copyright (c) 2020 - 2021 Contributors to the Eclipse Foundation
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
import BridgeServient from "./bridge-cli-servient";

// tools
import fs = require("fs");
import * as path from "path";

const argv = process.argv.slice(2); // remove "node" and executable
const defaultFile = "bridge-servient.conf.json";
const baseDir = ".";

var flagArgConfigfile = false;
var confFile: string;
var flagArgPassword = false;
var password: string;

const readConf = function (filename: string): Promise<any> {
    return new Promise((resolve, reject) => {
        let open = filename ? filename : path.join(baseDir, defaultFile);
        fs.readFile(open, "utf-8", (err, data) => {
            if (err) {
                reject(err);
            }
            if (data) {
                let config: any;
                try {
                    config = JSON.parse(data);
                } catch (err) {
                    reject(err);
                }
                console.info(`Bridge-Servient using config file '${open}'`);
                resolve(config);
            }
        });
    });
};

const runScripts = function (servient: BridgeServient, scripts: Array<string>) {
    scripts.forEach((fname) => {
        console.info("Bridge-Servient reading script", fname);
        fs.readFile(fname, "utf8", (err, data) => {
            if (err) {
                console.error("Bridge-Servient experienced error while reading script", err);
            } else {
                // limit printout to first line
                console.info(
                    `Bridge-Servient running script '${data.substr(0, data.indexOf("\n")).replace("\r", "")}'... (${
                        data.split(/\r\n|\r|\n/).length
                    } lines)`
                );
                servient.runPrivilegedScript(data, fname);
            }
        });
    });
};

const runAllScripts = function (servient: BridgeServient) {
    fs.readdir(baseDir, (err, files) => {
        if (err) {
            console.warn("Bridge-Servient experienced error while loading directory", err);
            return;
        }

        // unhidden .js files
        let scripts = files.filter((file) => {
            return file.substr(0, 1) !== "." && file.slice(-3) === ".js";
        });
        console.info(
            `Bridge-Servient using curring directory with ${scripts.length} script${scripts.length > 1 ? "s" : ""}`
        );

        runScripts(
            servient,
            scripts.map((filename) => path.join(baseDir, filename))
        );
    });
};

// main
if (argv.length > 0) {
    let argvCopy = argv.slice(0);
    argvCopy.forEach((arg) => {
        if (flagArgConfigfile) {
            flagArgConfigfile = false;
            confFile = arg;
            argv.shift();
        } else if (flagArgPassword) {
            flagArgPassword = false;
            password = arg;
            argv.shift();
        } else if (arg.match(/^(-f|--configfile|\/f)$/i)) {
            flagArgConfigfile = true;
            argv.shift();
        } else if (arg.match(/^(-p|--password|\/p)$/i)) {
            flagArgPassword = true;
            argv.shift();
        } else if (arg.match(/^(-v|--version|\/c)$/i)) {
            console.log(require("@node-wot/core/package.json").version);
            process.exit(0);
        } else if (arg.match(/^(-h|--help|\/?|\/h)$/i)) {
            console.log(`Usage: bridge-servient [options] [SCRIPT]...
       bridge-servient
       bridge-servient examples/scripts/counter.js examples/scripts/example-event.js
       bridge-servient -f ~/mybridge.conf.json testthing.js
       bridge-servient -p myOracleSecret

Run a WoT Servient in the current directory.
If no SCRIPT is given, all .js files in the current directory are loaded.
If one or more SCRIPT is given, these files are loaded instead of the directory.
If the file 'bridge-servient.conf.json' exists, that configuration is applied.

Options:
  -v, --version           display node-wot version
  -f, --configfile=file   load configuration from specified file
  -p, --password=secret   pass the password for the Oracle trust store
  -h, --help              show this help

  bridge-servient.conf.json syntax:
{
    "http": {
        "port": HPORT,
        "proxy": PROXY,
        "allowSelfSigned": ALLOW
    },
    "fujitsu": {
        "remote": FREMOTE
    },
    "oracle": {
        "store": OSTORE
    }
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

bridge-servient.conf.json fields:
  ---------------------------------------------------------------------------
  All entries in the config file structure are optional
  ---------------------------------------------------------------------------
  HPORT      : integer defining the HTTP listening port
  PROXY      : object with "href" field for the proxy URI,
                           "scheme" field for either "basic" or "bearer", and
                           corresponding credential fields as defined below
  ALLOW      : boolean whether self-signed certificates should be allowed
  FREMOTE    : URI for the Fujitsu remote proxy
  OSTORE     : file name of the Oracle IoT CS trust store
  THING_IDx  : string with TD "id" for which credentials should be configured
  TOKEN      : string for providing a Bearer token
  USERNAME   : string for providing a Basic Auth username
  PASSWORD   : string for providing a Basic Auth password`);
            process.exit(0);
        }
    });
} // argv

readConf(confFile)
    .then((conf) => {
        return new BridgeServient(password, conf);
    })
    .catch((err) => {
        if (err.code === "ENOENT" && !confFile) {
            console.warn(`Bridge-Servient using defaults as '${defaultFile}' does not exist`);
            return new BridgeServient(password);
        } else {
            console.error("Bridge-Servient config file error:", err.message);
            process.exit(err.errno);
        }
    })
    .then((servient) => {
        servient
            .start()
            .then(() => {
                if (argv.length > 0) {
                    console.info(
                        `Bridge-Servient loading ${argv.length} command line script${argv.length > 1 ? "s" : ""}`
                    );
                    return runScripts(servient, argv);
                } else {
                    return runAllScripts(servient);
                }
            })
            .catch((err) => {
                console.error("Bridge-Servient cannot start:", err.message);
            });
    })
    .catch((err) => console.error("Bridge-Servient main error:", err.message));
