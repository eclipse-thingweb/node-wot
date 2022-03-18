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
import * as nodeNetconf from "node-netconf";
import * as xpath2json from "./xpath2json";
import { promises as fsPromises } from "fs";
import { NetConfCredentials, RpcMethod } from "./netconf";

type RouterParams = {
    host: string;
    username: string;
    port?: number;
    password?: string;
    pkey?: string;
};

const METHOD_OBJ = {
    "GET-CONFIG": {
        "get-config": {
            $: { xmlns: "urn:ietf:params:xml:ns:netconf:base:1.0" },
            source: { candidate: {} },
            filter: { $: { type: "subtree" } },
        },
    },
    "EDIT-CONFIG": {
        "edit-config": {
            $: { xmlns: "urn:ietf:params:xml:ns:netconf:base:1.0" },
            target: { candidate: {} },
            config: {},
        },
    },
    COMMIT: { commit: { $: { xmlns: "urn:ietf:params:xml:ns:netconf:base:1.0" } } },
    RPC: {},
};
export class Client {
    private router: nodeNetconf.Client;

    private connected: boolean;

    private routerParams: RouterParams;

    constructor() {
        this.router = null;
        this.connected = false;
    }

    getRouter(): nodeNetconf.Client {
        return this.router;
    }

    deleteRouter(): void {
        this.router = null;
    }

    async initializeRouter(host: string, port: number, credentials: NetConfCredentials): Promise<void> {
        if (this.connected) {
            // close the old one
            this.closeRouter();
        }
        this.routerParams = {
            host,
            port,
            username: credentials.username,
            password: credentials?.password,
        };
        if (credentials.privateKey) {
            this.routerParams.pkey = await fsPromises.readFile(credentials.privateKey, { encoding: "utf8" });
        }

        return new Promise((resolve, reject) => {
            resolve(undefined);
        });
    }

    openRouter(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.connected) {
                // close the old one
                this.closeRouter();
            }
            this.router = new nodeNetconf.Client(this.routerParams);
            this.router.open((err?: string) => {
                if (err) {
                    reject(err);
                } else {
                    console.debug(
                        "[binding-netconf]",
                        `New NetConf router opened connection with host ${this.routerParams.host}, port ${this.routerParams.port}, username ${this.routerParams.username}`,
                    );
                    this.connected = true;
                    resolve(undefined);
                }
            });
        });
    }

    rpc(
        xpathQuery: string,
        method: RpcMethod,
        NSs: Record<string, string>,
        target: string,
        payload?: unknown,
    ): Promise<unknown> {
        return new Promise((resolve, reject) => {
            if (payload) {
                xpathQuery = xpath2json.addLeaves(xpathQuery, payload);
            }
            const objRequest = xpath2json.xpath2json(xpathQuery, NSs);
            let finalRequest = JSON.parse(JSON.stringify(METHOD_OBJ[method])); // clone the METHOD_OBJ
            switch (method) {
                case "EDIT-CONFIG": {
                    finalRequest["edit-config"].config = Object.assign(finalRequest["edit-config"].config, objRequest);
                    finalRequest["edit-config"].target = {};
                    finalRequest["edit-config"].target[target] = {};
                    break;
                }
                case "COMMIT": {
                    break;
                }
                case "RPC": {
                    finalRequest = objRequest; // just take the rpc as was created starting from xpath
                    break;
                }
                case "GET-CONFIG":
                default: {
                    finalRequest["get-config"].filter = Object.assign(finalRequest["get-config"].filter, objRequest);
                    finalRequest["get-config"].source = {};
                    finalRequest["get-config"].source[target] = {};
                    break;
                }
            }
            this.router.rpc(finalRequest, (err: string, results: unknown) => {
                if (err) {
                    reject(err);
                }
                resolve(results);
            });
        });
    }

    closeRouter(): void {
        this.router.close();
        this.connected = false;
    }
}
