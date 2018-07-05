#!/usr/bin/env node
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
import DefaultServient from "./default-servient";

// tools
import fs = require("fs");
import * as path from "path";

const argv = process.argv.slice(2);
const confFile = "wot-servient.conf.json";
const baseDir = ".";

var clientOnly: boolean = false;
var file: string;

const readConf = function () : Promise<any> {
    return new Promise((resolve, reject) => {

        let open = file!==undefined ? file : path.join(baseDir, confFile);

        fs.readFile(open, "utf-8", (err, data) => {
            if (err) {
                reject(err);
            }
            if (data) {
                const config = JSON.parse(data);
                console.info("WoT-Servient using conf file", open);

                // apply cli flags
                if (clientOnly) config.servient.clientOnly = true;
                
                resolve(config);
            }
        });
    });
}

const runScripts = function(srv : DefaultServient, scripts : Array<string>) : void {
    scripts.forEach((fname) => {
        console.info("WoT-Servient reading script", fname);
        fs.readFile(fname, "utf8", (err, data) => {
            if (err) {
                console.error("WoT-Servient experienced error while reading script", err);
            } else {
                // limit printout to first line
                console.info(`WoT-Servient running script '${data.substr(0, data.indexOf("\n")).replace("\r", "")}'... (${data.split(/\r\n|\r|\n/).length} lines)`);
                srv.runPrivilegedScript(data, fname);
            }
        });
    });
}

const runAllScripts = function(srv : DefaultServient) : void {
    const scriptDir = path.join(baseDir, srv.config.servient.scriptDir);
    fs.readdir(scriptDir, (err, files) => {
        if (err) {
            console.warn("WoT-Servient experienced error while loading directory", err);
            return;
        }

        // unhidden .js files
        let scripts = files.filter( (file) => {
            return (file.substr(0, 1) !== "." && file.slice(-3) === ".js");
        });
        console.info(`WoT-Servient loading directory '${scriptDir}' with ${scripts.length} script${scripts.length>1 ? "s" : ""}`);
        
        runScripts(srv, scripts.map(value => path.join(scriptDir, value)));
    });
}

// main
if (argv.length>0) {
    argv.forEach( (arg) => {
        if (arg.match(/^(-h|--help|\/?|\/h)$/i)) {
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
  -c, --clientonly        do not start any servers
                          (enables multiple instances without port conflicts)
  -f, --configfile=file   load configuration from specified file
  -h, --help              show this help

wot-servient.conf.json syntax:
{
    "servient": {
        "clientOnly": CLIENTONLY,
        "scriptDir": AUTORUN,
        "scriptAction": RUNSCRIPT
    },
    "http": {
        "port": HPORT,
        "proxy": PROXY,
        "allowSelfSigned": ALLOW
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
  AUTORUN    : string with path of directory to load at startup (default=".")
  RUNSCRIPT  : boolean to activate the 'runScript' Action (default=false)
  HPORT      : integer defining the HTTP listening port
  PROXY      : object with "href" field for the proxy URI,
                           "scheme" field for either "basic" or "bearer", and
                           corresponding credential fields as defined below
  ALLOW      : boolean whether self-signed certificates should be allowed
  THING_IDx  : string with TD "id" for which credentials should be configured
  TOKEN      : string for providing a Bearer token
  USERNAME   : string for providing a Basic Auth username
  PASSWORD   : string for providing a Basic Auth password`);
            process.exit(0);

        } else if (arg.match(/^(-c|--clientonly|\/c)$/i)) {
            console.log(`WoT-Servient in client-only mode`);
            clientOnly = true;
            argv.shift();
        
        } else if (arg.match(/^(-f|--configfile|\/f)$/i)) {
            console.log(`WoT-Servient in client-only mode`);
            clientOnly = true;
            argv.shift();
        }
    });
}

readConf()
    .then((conf) => {
        return new DefaultServient(conf);
    })
    .catch(err => {
        if (err.code == 'ENOENT') {
            console.warn("WoT-Servient using defaults as 'wot-servient.conf.json' does not exist");
            return new DefaultServient();
        } else {
            console.error("WoT-Servient config file error: " + err.message);
            process.exit(err.errno);
        }
    })
    .then(servient => {
        servient.start()
            .then( () => {
                if (argv.length>0) {
                    console.info(`WoT-Servient loading ${argv.length} command line script${argv.length>1 ? "s" : ""}`);
                    return runScripts(servient, argv);
                } else {
                    return runAllScripts(servient);
                }
            })
        .catch( err => {
            console.error("WoT-Servient cannot start: " + err.message);
        });
    })
    .catch(err => console.error(err));
