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
import Servient from "@node-wot/core";
// protocols used
import { HttpServer } from "@node-wot/binding-http";
import { WebSocketServer } from "@node-wot/binding-websockets";
import { CoapServer } from "@node-wot/binding-coap";
import { MqttBrokerServer } from "@node-wot/binding-mqtt"; 
import { FileClientFactory } from "@node-wot/binding-file";
import { HttpClientFactory } from "@node-wot/binding-http";
import { HttpsClientFactory } from "@node-wot/binding-http";
import { CoapClientFactory } from "@node-wot/binding-coap";
import { CoapsClientFactory } from "@node-wot/binding-coap";
import { MqttClientFactory }  from "@node-wot/binding-mqtt";

export default class DefaultServient extends Servient {

    private static readonly defaultServientConf = {
        servient: {
            clientOnly: false,
            scriptDir: ".",
            scriptAction: false
        },
        http: {
            port: 8080,
            selfSigned: false
        },
        coap: {
            port: 5683
        }
    }

    public readonly config: any = DefaultServient.defaultServientConf;

    public constructor(config?: any) {
        super();

        Object.assign(this.config, config);
        // remove secrets from original for displaying config (still in copy on this)
        if(config && config.credentials) delete config.credentials;
        console.info("DefaultServient configured with", config);

        if (!this.config.servient.clientOnly) {
            let httpServer = (typeof this.config.http.port === "number") ? new HttpServer(this.config.http.port) : new HttpServer();
            this.addServer(httpServer);

            // re-use httpServer (same port)
            this.addServer(new WebSocketServer(httpServer));

            // optional servers based on wot-servient.conf.json
            if (this.config.coap !== undefined) {
                let coapServer = (typeof this.config.coap.port === "number") ? new CoapServer(this.config.coap.port) : new CoapServer();
                this.addServer(coapServer);
            }
            if (this.config.mqtt !== undefined) {
                let mqttBrokerServer = new MqttBrokerServer(this.config.mqtt.broker, (typeof this.config.mqtt.username === "string") ? this.config.mqtt.username : undefined, (typeof this.config.mqtt.password === "number") ? this.config.mqtt.password : undefined);
                this.addServer(mqttBrokerServer);
            }
        }

        this.addClientFactory(new FileClientFactory());
        this.addClientFactory(new HttpClientFactory(this.config.http));
        this.addClientFactory(new HttpsClientFactory(this.config.http));
        this.addClientFactory(new CoapClientFactory());
        this.addClientFactory(new CoapsClientFactory());

        // optional clients based on wot-servient.conf.json
        if (this.config.mqtt !== undefined) {
            this.addClientFactory(new MqttClientFactory()); //TODO pass client config
        }
        
        // loads credentials from the configuration
        this.addCredentials(this.config.credentials);
    }

    /**
     * start
     */
    public start(): Promise<WoT.WoTFactory> {

        return new Promise<WoT.WoTFactory>((resolve, reject) => {
            super.start().then(myWoT => {
                console.info("DefaultServient started");

                // TODO think about builder pattern that starts with produce() ends with expose(), which exposes/publishes the Thing
                let thing = myWoT.produce(`{
                    "name": "servient",
                    "description": "node-wot CLI Servient",
                    "system": "${process.arch}"
                }`)
                    .addProperty("things", {
                        writable: true,
                        observable: false,
                        type: "string"
                    })
                    .addAction("log", {
                        input: { type: "string" },
                        output: { type: "string" }
                    })
                    .setActionHandler(
                        "log",
                        (msg: any) => {
                            return new Promise((resolve, reject) => {
                                console.info(msg);
                                resolve(`logged '${msg}'`);
                            });
                        }
                    )
                    .addAction("shutdown", {
                        output: { type: "string" }
                    })
                    .setActionHandler(
                        "shutdown",
                        () => {
                            return new Promise((resolve, reject) => {
                                console.info("shutting down by remote");
                                this.shutdown();
                                resolve();
                            });
                        }
                    );

                if (this.config.servient.scriptAction) {
                    thing
                        .addAction("runScript", {
                            input: { type: "string" },
                            output: { type: "string" }
                        })
                        .setActionHandler(
                            "runScript",
                            (script: string) => {
                                return new Promise((resolve, reject) => {
                                    console.log("runnig script", script);
                                    this.runScript(script);
                                    resolve();
                                });
                            }
                        );
                }

                // pass WoTFactory on
                resolve(myWoT);

            }).catch(err => {
                console.trace(`error building CLI Management Thing: ${err}`);
                reject(err)
            });
        });
    }
}
