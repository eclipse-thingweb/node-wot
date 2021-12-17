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

// global W3C WoT Scripting API definitions
import * as WoT from "wot-typescript-definitions";
// node-wot implementation of W3C WoT Servient
import { Servient, Helpers } from "@node-wot/core";
// protocols used
import { CoapServer } from "@node-wot/binding-coap";
import { CoapClientFactory } from "@node-wot/binding-coap";

export default class CoapServient extends Servient {
    private static readonly defaultServientConf = {
        servient: {
            scriptDir: ".",
            scriptAction: false,
        },
        coap: {
            port: 5683,
        },
    };

    public readonly config: any = CoapServient.defaultServientConf;

    public constructor(config?: any) {
        super();

        Object.assign(this.config, config);
        console.info("CoapServient configured with", this.config);

        let coapServer =
            typeof this.config.coap.port === "number" ? new CoapServer(this.config.coap.port) : new CoapServer();
        this.addServer(coapServer);
        this.addClientFactory(new CoapClientFactory());

        // loads credentials from the configuration
        this.addCredentials(this.config.credentials);
    }

    /**
     * start
     */
    public start(): Promise<WoT.WoT> {
        return new Promise<WoT.WoT>((resolve, reject) => {
            super
                .start()
                .then((WoT) => {
                    console.info("CoapServient started");

                    WoT.produce({
                        title: "servient",
                        actions: {
                            log: {
                                input: {
                                    type: "string",
                                },
                                output: {
                                    type: "string",
                                },
                            },
                            shutdown: {
                                output: {
                                    type: "string",
                                },
                            },
                            runScript: {
                                input: {
                                    type: "string",
                                },
                                output: {
                                    type: "string",
                                },
                            },
                        },
                    }).then((thing) => {
                        console.log("Produced " + thing.getThingDescription().title);

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
                                console.log("runnig script", script);
                                this.runScript(script);
                                resolve();
                            });
                        });
                        thing
                            .expose()
                            .then(() => {
                                // pass on WoTFactory
                                resolve(WoT);
                            })
                            .catch((err) => reject(err));
                    });
                })
                .catch((err) => reject(err));
        });
    }
}
