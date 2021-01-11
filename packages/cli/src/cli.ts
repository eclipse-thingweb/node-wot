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

// default implementation of W3C WoT Servient (http(s) and file bindings)
import DefaultServient from "./cli-default-servient";

// tools
import fs = require("fs");
import * as dotenv from 'dotenv';
import * as path from "path";

const argv = process.argv.slice(2); // remove "node" and executable
const defaultFile = "wot-servient.conf.json";
const baseDir = ".";

var clientOnly: boolean = false;

var flagArgConfigfile = false;
var flagArgCompilerModule = false;
var compilerModule:string;
var flagScriptArgs = false;
var scriptArgs:Array<string> = [];
var confFile: string;

interface DebugParams {
    shouldBreak: boolean,
    host: string,
    port: Number
}
var debug: DebugParams;

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
                console.info("[cli]",`WoT-Servient using config file '${open}'`);
                resolve(config);
            }
        });
    });
}

const loadCompilerFunction = function (compilerModule: string | undefined){
    if (compilerModule) {
       
        const compilerMod = require(compilerModule);   
        
        if(!compilerMod.create){ throw new Error("No create function defined for "+ compilerModule);}

        const compilerObject = compilerMod.create()

        if (!compilerObject.compile) { throw new Error("No compile function defined for create return object"); }
        return compilerObject.compile
    }
    return undefined
}

const loadEnvVariables = function () {
    const env = dotenv.config();

    //ignore file not found but throw otherwise
    if (env.error && (env.error as any).code && (env.error as any).code != "ENOENT") {
        throw env.error;
    }
    return env;
}

const runScripts =async function(servient: DefaultServient, scripts: Array<string>,debug?: DebugParams) {
    
    const env = loadEnvVariables();

    const launchScripts = (scripts : Array<string> ) => {
        const compile = loadCompilerFunction(compilerModule);
        scripts.forEach((fname : string) => {
            console.info("[cli]","WoT-Servient reading script", fname);
            fs.readFile(fname, "utf8", (err, data) => {
                if (err) {
                    console.error("[cli]","WoT-Servient experienced error while reading script", err);
                } else {
                    // limit printout to first line
                    console.info("[cli]",`WoT-Servient running script '${data.substr(0, data.indexOf("\n")).replace("\r", "")}'... (${data.split(/\r\n|\r|\n/).length} lines)`);

                    fname = path.resolve(fname)
                    servient.runPrivilegedScript(data, fname,{
                        argv: scriptArgs,
                        env: env.parsed,
                        compiler: compile
                        });
                }
            });
        });
    }
    
    const inspector = require('inspector');
    if(debug  && debug.shouldBreak){
        // Activate inspector only if is not already opened and wait for the debugger to attach
        !inspector.url() && inspector.open(debug.port,debug.host, true)

        // Set a breakpoint at the first line of of first script
        // the breakpoint gives time to inspector clients to set their breakpoints
        const session = new inspector.Session();
        session.connect();
        session.post("Debugger.enable", (error: any) => {
            if(error){
                console.warn("[cli]","Cannot set breakpoint; reason: cannot enable debugger")
                console.warn(error)
            }
           
            session.post("Debugger.setBreakpointByUrl", {
                lineNumber: 0,
                url: "file:///" + path.resolve(scripts[0]).replace(/\\/g, '/')
            }, (err: any) => {
                if (err) {
                    console.warn("[cli]","Cannot set breakpoint")
                    console.warn("[cli]",error)
                }
                launchScripts(scripts)
            })
        });

    }else{
        // Activate inspector only if is not already opened and don't wait
        debug && !inspector.url() && inspector.open(debug.port, debug.host, false);
        launchScripts(scripts)
    }
    
}

const runAllScripts = function(servient: DefaultServient,debug?: DebugParams) {
    fs.readdir(baseDir, (err, files) => {
        if (err) {
            console.warn("[cli]","WoT-Servient experienced error while loading directory", err);
            return;
        }

        // unhidden .js files
        let scripts = files.filter( (file) => {
            return (file.substr(0, 1) !== "." && file.slice(-3) === ".js");
        });
        console.info("[cli]",`WoT-Servient using current directory with ${scripts.length} script${scripts.length>1 ? "s" : ""}`);
        
        runScripts(servient, scripts.map(filename => path.resolve(path.join(baseDir, filename))),debug);
    });
}

// main
for( let i = 0; i < argv.length; i++){ 
    if (flagArgConfigfile) {
        flagArgConfigfile = false;
        confFile = argv[i];
        argv.splice(i, 1);
        i--;

    } else if (flagScriptArgs){ 
        scriptArgs.push(argv[i])
        argv.splice(i, 1);
        i--;
    } else if (flagArgCompilerModule) {
        flagArgCompilerModule = false;
        compilerModule = argv[i]
        argv.splice(i, 1);
        i--;
    } else if (argv[i] === "--") {
        // next args are script args
        flagScriptArgs = true;
        argv.splice(i, 1);
        i--;
    } else if (argv[i].match(/^(-c|--clientonly|\/c)$/i)) {
        clientOnly = true;
        argv.splice(i, 1);
        i--;
    
    } else if (argv[i].match(/^(-cp|--compiler|\/cp)$/i)) {
        flagArgCompilerModule = true;
        argv.splice(i, 1);
        i--;
    } else if (argv[i].match(/^(-f|--configfile|\/f)$/i)) {
        flagArgConfigfile = true;
        argv.splice(i, 1);
        i--;

    } else if (argv[i].match(/^(-i|-ib|--inspect(-brk)?(=([a-z]*|[\d .]*):?(\d*))?|\/i|\/ib)$/i)) {
        let matches = argv[i].match(/^(-i|-ib|--inspect(-brk)?(=([a-z]*|[\d .]*):?(\d*))?|\/i|\/ib)$/i)
        debug = {
            shouldBreak: matches[2] === "-brk" || matches[1] === "-ib" || matches[1] === "/ib",
            host: matches[4] ? matches[4] : "127.0.0.1",     // default host
            port: matches[5] ? parseInt(matches[5]) : 9229   // default port
        }

        argv.splice(i, 1);
        i--;

    } else if (argv[i].match(/^(-v|--version|\/c)$/i)) {
        console.log( require('@node-wot/core/package.json').version );
        process.exit(0);

    } else if (argv[i].match(/^(-h|--help|\/?|\/h)$/i)) {
        console.log(`Usage: wot-servient [options] [SCRIPT]... -- [ARGS]...
       wot-servient
       wot-servient examples/scripts/counter.js examples/scripts/example-event.js
       wot-servient -c counter-client.js
       wot-servient -f ~/mywot.conf.json examples/testthing/testthing.js
       wot-servient examples/testthing/testthing.js -- script_arg1 script_arg2

Run a WoT Servient in the current directory.
If no SCRIPT is given, all .js files in the current directory are loaded.
If one or more SCRIPT is given, these files are loaded instead of the directory.
If the file 'wot-servient.conf.json' exists, that configuration is applied.

Options:
  -v,  --version                   display node-wot version
  -i,  --inspect[=[host:]port]     activate inspector on host:port (default: 127.0.0.1:9229)
  -ib, --inspect-brk[=[host:]port] activate inspector on host:port and break at start of user script
  -c,  --clientonly                do not start any servers
                                   (enables multiple instances without port conflicts)
  -cp,  --compiler <module>        load module as a compiler 
                                   (The module must export a create function which returns
                                    an object with a compile method)
  -f,  --configfile <file>         load configuration from specified file
  -h,  --help                      show this help

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
  ---------------------------------------------------------------------------
  All entries in the config file structure are optional
  ---------------------------------------------------------------------------
  CLIENTONLY      : boolean setting if no servers shall be started (default=false)
  STATIC          : string with hostname or IP literal for static address config
  RUNSCRIPT       : boolean to activate the 'runScript' Action (default=false)
  HPORT           : integer defining the HTTP listening port
  PROXY           : object with "href" field for the proxy URI,
                                "scheme" field for either "basic" or "bearer", and
                                corresponding credential fields as defined below
  ALLOW           : boolean whether self-signed certificates should be allowed
  BROKER-URL      : URL to an MQTT broker that publisher and subscribers will use
  BROKER-UNIQUEID : unique id set by mqtt client while connecting to broker
  MQTT_VERSION    : number indicating the MQTT protocol version to be used (3, 4, or 5)
  THING_IDx       : string with TD "id" for which credentials should be configured
  TOKEN           : string for providing a Bearer token
  USERNAME        : string for providing a Basic Auth username
  PASSWORD        : string for providing a Basic Auth password
  ---------------------------------------------------------------------------
 
Environment variables must be provided in a .env file in the current working directory. 

Example:
VAR1=Value1
VAR2=Value2`);
        process.exit(0);
    }
}

readConf(confFile)
    .then((conf) => {
        return new DefaultServient(clientOnly, conf);
    })
    .catch((err) => {
        if (err.code === "ENOENT" && !confFile) {
            console.warn("[cli]",`WoT-Servient using defaults as '${defaultFile}' does not exist`);
            return new DefaultServient(clientOnly);
        } else {
            console.error("[cli]","WoT-Servient config file error:", err.message);
            process.exit(err.errno);
        }
    })
    .then((servient) => {
        servient.start()
            .then(() => {
                if (argv.length>0) {
                    console.info("[cli]",`WoT-Servient loading ${argv.length} command line script${argv.length>1 ? "s" : ""}`);
                    return runScripts(servient, argv, debug);
                } else {
                    return runAllScripts(servient, debug);
                }
            })
            .catch((err) => {
                console.error("[cli]","WoT-Servient cannot start:", err.message);
            });
    })
    .catch((err) => console.error("[cli]","WoT-Servient main error:", err.message));
