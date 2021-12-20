/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { HttpServer, HttpClientFactory, HttpsClientFactory } from "@node-wot/binding-http";
// import { WebSocketServer } from "@node-wot/binding-websockets";
import { CoapServer, CoapClientFactory, CoapsClientFactory } from "@node-wot/binding-coap";
import { MqttBrokerServer, MqttClientFactory } from "@node-wot/binding-mqtt";
import { FileClientFactory } from "@node-wot/binding-file";

export default class DefaultServient extends Servient {
    private static readonly defaultConfig = {
        servient: {
            clientOnly: false,
            scriptAction: false,
        },
        http: {
            port: 8080,
            selfSigned: false,
        },
        coap: {
            port: 5683,
        },
        log: {
            level: "info",
        },
    };

    public readonly config: any;
    // current log level
    public logLevel: string;

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public constructor(clientOnly: boolean, config?: any) {
        super();

        // init config
        this.config =
            typeof config === "object"
                ? mergeConfigs(DefaultServient.defaultConfig, config)
                : DefaultServient.defaultConfig;

        // apply flags
        if (clientOnly) {
            if (!this.config.servient) {
                this.config.servient = {};
            }
            this.config.servient.clientOnly = true;
        }

        // set log level before any output
        this.setLogLevel(this.config.log.level);

        // load credentials from config
        this.addCredentials(this.config.credentials);

        // remove secrets from original for displaying config (already added)
        if (this.config.credentials) delete this.config.credentials;

        // display
        console.debug("[cli/default-servient]", "DefaultServient configured with");
        console.dir(this.config);

        // apply config
        if (typeof this.config.servient.staticAddress === "string") {
            Helpers.setStaticAddress(this.config.servient.staticAddress);
        }

        let coapServer: CoapServer | undefined;
        if (!this.config.servient.clientOnly) {
            if (this.config.http) {
                const httpServer = new HttpServer(this.config.http);
                this.addServer(httpServer);

                // re-use httpServer (same port)
                // this.addServer(new WebSocketServer(httpServer));
            }
            if (this.config.coap) {
                coapServer =
                    typeof this.config.coap.port === "number"
                        ? new CoapServer(this.config.coap.port)
                        : new CoapServer();
                this.addServer(coapServer);
            }
            if (this.config.mqtt) {
                const mqttBrokerServer = new MqttBrokerServer({
                    uri: this.config.mqtt.broker,
                    user: typeof this.config.mqtt.username === "string" ? this.config.mqtt.username : undefined,
                    psw: typeof this.config.mqtt.password === "string" ? this.config.mqtt.password : undefined,
                    clientId: typeof this.config.mqtt.clientId === "string" ? this.config.mqtt.clientId : undefined,
                    protocolVersion:
                        typeof this.config.mqtt.protocolVersion === "number"
                            ? this.config.mqtt.protocolVersion
                            : undefined,
                });
                this.addServer(mqttBrokerServer);
            }
        }

        this.addClientFactory(new FileClientFactory());
        this.addClientFactory(new HttpClientFactory(this.config.http));
        this.addClientFactory(new HttpsClientFactory(this.config.http));
        this.addClientFactory(new CoapClientFactory(coapServer));
        this.addClientFactory(new CoapsClientFactory());
        this.addClientFactory(new MqttClientFactory());
    }

    /**
     * start
     */
    public start(): Promise<typeof WoT> {
        return new Promise<typeof WoT>((resolve, reject) => {
            super
                .start()
                .then((myWoT) => {
                    console.info("[cli/default-servient]", "DefaultServient started");

                    // TODO think about builder pattern that starts with produce() ends with expose(), which exposes/publishes the Thing
                    myWoT
                        .produce({
                            title: "servient",
                            description: "node-wot CLI Servient",
                            properties: {
                                things: {
                                    type: "object",
                                    description: "Get things",
                                    observable: false,
                                    readOnly: true,
                                },
                            },
                            actions: {
                                setLogLevel: {
                                    description: "Set log level",
                                    input: { oneOf: [{ type: "string" }, { type: "number" }] },
                                    output: { type: "string" },
                                },
                                shutdown: {
                                    description: "Stop servient",
                                    output: { type: "string" },
                                },
                                runScript: {
                                    description: "Run script",
                                    input: { type: "string" },
                                    output: { type: "string" },
                                },
                            },
                        })
                        .then((thing) => {
                            thing.setActionHandler("setLogLevel", async (level) => {
                                const ll = await Helpers.parseInteractionOutput(level);
                                return new Promise((resolve, reject) => {
                                    if (typeof ll === "number") {
                                        this.setLogLevel(ll as number);
                                    } else if (typeof ll === "string") {
                                        this.setLogLevel(ll as string);
                                    } else {
                                        // try to convert it to strings
                                        this.setLogLevel(ll + "");
                                    }
                                    resolve(`Log level set to '${this.logLevel}'`);
                                });
                            });
                            thing.setActionHandler("shutdown", () => {
                                return new Promise((resolve, reject) => {
                                    console.debug("[cli/default-servient]", "shutting down by remote");
                                    this.shutdown();
                                    resolve(undefined);
                                });
                            });
                            thing.setActionHandler("runScript", async (script) => {
                                const scriptv = await Helpers.parseInteractionOutput(script);
                                return new Promise((resolve, reject) => {
                                    console.debug("[cli/default-servient]", "running script", scriptv);
                                    this.runScript(scriptv as string);
                                    resolve(undefined);
                                });
                            });
                            thing.setPropertyReadHandler("things", () => {
                                return new Promise((resolve, reject) => {
                                    console.debug("[cli/default-servient]", "returnings things");
                                    resolve(this.getThings());
                                });
                            });
                            thing
                                .expose()
                                .then(() => {
                                    // pass on WoTFactory
                                    resolve(myWoT);
                                })
                                .catch((err) => reject(err));
                        });
                })
                .catch((err) => reject(err));
        });
    }

    // Save default loggers (needed when changing log levels)
    private readonly loggers: any = {
        warn: console.warn,
        info: console.info,
        debug: console.debug,
    };

    private setLogLevel(logLevel: string | number): void {
        if (logLevel === "error" || logLevel === 0) {
            console.warn = () => {
                /* nothing */
            };
            console.info = () => {
                /* nothing */
            };
            console.debug = () => {
                /* nothing */
            };

            this.logLevel = "error";
        } else if (logLevel === "warn" || logLevel === "warning" || logLevel === 1) {
            console.warn = this.loggers.warn;
            console.info = () => {
                /* nothing */
            };
            console.debug = () => {
                /* nothing */
            };

            this.logLevel = "warn";
        } else if (logLevel === "info" || logLevel === 2) {
            console.warn = this.loggers.warn;
            console.info = this.loggers.info;
            console.debug = () => {
                /* nothing */
            };

            this.logLevel = "info";
        } else if (logLevel === "debug" || logLevel === 3) {
            console.warn = this.loggers.warn;
            console.info = this.loggers.info;
            console.debug = this.loggers.debug;

            this.logLevel = "debug";
        } else {
            // Fallback to default ("info")
            console.warn = this.loggers.warn;
            console.info = this.loggers.info;
            console.debug = () => {
                /* nothing */
            };

            this.logLevel = "info";
        }
    }
}

/**
 * Helper function merging default parameters into a custom config file.
 *
 * @param {object} target - an object containing default config parameters
 * @param {object} source - an object containing custom config parameters
 *
 * @return {object} The new config file containing both custom and default parameters
 */
function mergeConfigs(target: any, source: any): any {
    const output = Object.assign({}, target);
    Object.keys(source).forEach((key) => {
        if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
        } else {
            if (isObject(target[key]) && isObject(source[key])) {
                output[key] = mergeConfigs(target[key], source[key]);
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        }
    });
    return output;
}

// Helper function needed for `mergeConfigs` function
function isObject(item: unknown) {
    return item && typeof item === "object" && !Array.isArray(item);
}
