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

// global W3C WoT Scripting API definitions
import * as WoT from "wot-typescript-definitions";
// node-wot implementation of W3C WoT Servient 
import { Servient, Helpers } from "@node-wot/core";
// protocols used
import { HttpServer } from "@node-wot/binding-http";
import { FileClientFactory } from "@node-wot/binding-file";
import { ModbusClientFactory } from "@node-wot/binding-modbus";



export default class ModbusServient extends Servient {

    private static readonly defaultConfig = {
        servient: {
            clientOnly: true,
            scriptAction: false
        }
    }

    public readonly config: any;

    public constructor(clientOnly: boolean, config?: any) {
        super();
        this.config = (typeof config === "object") ? config : ModbusServient.defaultConfig;
        if (typeof this.config.servient.staticAddress === "string") {
            Helpers.setStaticAddress(this.config.servient.staticAddress);
        }
        if (!this.config.servient.clientOnly) {

            if (this.config.http !== undefined) {
                let httpServer = new HttpServer(this.config.http);
                this.addServer(httpServer);

            }
        }

        this.addClientFactory(new FileClientFactory());
	    this.addClientFactory(new ModbusClientFactory());
    }

    /**
     * start
     */
 public start(): Promise<WoT.WoT> {

        return new Promise<WoT.WoT>((resolve, reject) => {
            super.start().then((myWoT) => {
                console.info("DefaultServient started");

                // TODO think about builder pattern that starts with produce() ends with expose(), which exposes/publishes the Thing
                myWoT.produce({
                    "title": "servient",
                    "description": "node-wot CLI Servient",
                    properties: {
                        things: {
                            type: "object",
                            description: "Get things",
                            observable: false,
                            readOnly: true
                        }
                    },
                    actions: {
                        log: {
                            description: "Enable logging",
                            input: { type: "string" },
                            output: { type: "string" }
                        },
                        shutdown: {
                            description: "Stop servient",
                            output: { type: "string" }
                        },
                        runScript: {
                            description: "Run script",
                            input: { type: "string" },
                            output: { type: "string" }
                        }
                    }
                })
                    .then((thing) => {
                        thing.setActionHandler("log", (msg) => {
                            return new Promise((resolve, reject) => {
                                console.info(msg);
                                resolve(`logged '${msg}'`);
                            });
                        });
                        thing.setActionHandler("shutdown", () => {
                            return new Promise((resolve, reject) => {
                                console.info("shutting down by remote");
                                this.shutdown();
                                resolve();
                            });
                        });
                        thing.setActionHandler("runScript", (script) => {
                            return new Promise((resolve, reject) => {
                                console.log("running script", script);
                                this.runScript(script);
                                resolve();
                            });
                        });
                        thing.setPropertyReadHandler("things", () => {
                            return new Promise((resolve, reject) => {
                                console.log("returnings things");
                                resolve(this.getThings());
                            });
                        });
                        thing.expose().then(() => {
                            // pass on WoTFactory
                            resolve(myWoT as WoT.WoT);
                        }).catch((err) => reject(err));
                    });
                }).catch((err) => reject(err));
        });
    }
     
}
