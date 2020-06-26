#!/usr/bin/env node
/********************************************************************************
 * Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
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

import ModbusServient from "./cli-modbus-servient";

// tools
import fs = require("fs");
import * as path from "path";

const argv = process.argv.slice(2); // remove "node" and executable
const defaultFile = "wot-modbus-servient.conf.json";
const baseDir = ".";

var clientOnly: boolean = true;

var flagArgConfigfile = false;
var confFile: string;

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
                console.info(`WoT-Servient using config file '${open}'`);
                resolve(config);
            }
        });
    });
}

const runScripts = function(servient: ModbusServient, scripts: Array<string>) {
    scripts.forEach((fname) => {
        console.info("WoT-Servient reading script", fname);
        fs.readFile(fname, "utf8", (err, data) => {
            if (err) {
                console.error("WoT-Servient experienced error while reading script", err);
            } else {
                // limit printout to first line
                console.info(`WoT-Servient running script '${data.substr(0, data.indexOf("\n")).replace("\r", "")}'... (${data.split(/\r\n|\r|\n/).length} lines)`);
                servient.runPrivilegedScript(data, fname);
            }
        });
    });
}

const runAllScripts = function(servient: ModbusServient) {
    fs.readdir(baseDir, (err, files) => {
        if (err) {
            console.warn("WoT-Servient experienced error while loading directory", err);
            return;
        }

        // unhidden .js files
        let scripts = files.filter( (file) => {
            return (file.substr(0, 1) !== "." && file.slice(-3) === ".js");
        });
        console.info(`WoT-Servient using current directory with ${scripts.length} script${scripts.length>1 ? "s" : ""}`);
        
        runScripts(servient, scripts.map(filename => path.join(baseDir, filename)));
    });
}

// main
for( let i = 0; i < argv.length; i++){ 
    if (flagArgConfigfile) {
        flagArgConfigfile = false;
        confFile = argv[i];
        argv.splice(i, 1);
        i--;

    } else if (argv[i].match(/^(-c|--clientonly|\/c)$/i)) {
        clientOnly = true;
        argv.splice(i, 1);
        i--;
    
    } else if (argv[i].match(/^(-f|--configfile|\/f)$/i)) {
        flagArgConfigfile = true;
        argv.splice(i, 1);
        i--;

    } else if (argv[i].match(/^(-v|--version|\/c)$/i)) {
        console.log( require('@node-wot/core/package.json').version );
        process.exit(0);

    } else if (argv[i].match(/^(-h|--help|\/?|\/h)$/i)) {
        console.log(`Usage: wot-servient [options] [SCRIPT]...
       wot-servient
       wot-servient examples/scripts/counter.js examples/scripts/example-event.js
       wot-servient -c counter-client.js
       wot-servient -f ~/mywot.conf.json examples/testthing/testthing.js

Run a WoT Servient in the current directory.
If no SCRIPT is given, all .js files in the current directory are loaded.
If one or more SCRIPT is given, these files are loaded instead of the directory.
If the file 'wot-servient.conf.json' exists, that configuration is applied.

Options:
  -v, --version            display node-wot version
  -c, --clientonly         do not start any servers
                           (enables multiple instances without port conflicts)
  -f, --configfile <file>  load configuration from specified file
  -h, --help               show this help

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
        "broker" : "BROKER-URL",
        "username" : "USERNAME",
        "password" : "PASSWORD",
        "clientId" : "UNIQUEID",
        "port": 1883 
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
  ---------------------------------------------------------------------------
  All entries in the config file structure are optional
  ---------------------------------------------------------------------------
  CLIENTONLY : boolean setting if no servers shall be started (default=false)
  STATIC     : string with hostname or IP literal for static address config
  RUNSCRIPT  : boolean to activate the 'runScript' Action (default=false)
  HPORT      : integer defining the HTTP listening port
  PROXY      : object with "href" field for the proxy URI,
                           "scheme" field for either "basic" or "bearer", and
                           corresponding credential fields as defined below
  ALLOW      : boolean whether self-signed certificates should be allowed
  THING_IDx  : string with TD "id" for which credentials should be configured
  UNIQUEID   : unique id set by mqtt client while connecting to broker
  BROKER-URL : URL to an MQTT broker that publisher and subscribers will use
  TOKEN      : string for providing a Bearer token
  USERNAME   : string for providing a Basic Auth username
  PASSWORD   : string for providing a Basic Auth password`);
        process.exit(0);
    }
}

readConf(confFile)
    .then((conf) => {
        console.log(conf)
        return new ModbusServient(clientOnly, conf);
    })
    .catch((err) => {
        if (err.code === "ENOENT" && !confFile) {
            console.warn(`WoT-Servient using defaults as '${defaultFile}' does not exist`);
            return new ModbusServient(clientOnly);
        } else {
            console.error("WoT-Servient config file error:", err.message);
            process.exit(err.errno);
        }
    })
    .then((servient) => {
        servient.start()
            .then(() => {
                if (argv.length>0) {
                    console.info(`WoT-Servient loading ${argv.length} command line script${argv.length>1 ? "s" : ""}`);
                    return runScripts(servient, argv);
                } else {
                    return runAllScripts(servient);
                }
            })
            .catch((err) => {
                console.error("WoT-Servient cannot start:", err.message);
            });
    })
    .catch((err) => console.error("WoT-Servient main error:", err.message));
