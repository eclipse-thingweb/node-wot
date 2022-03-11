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

const METHOD_OBJ: any = {};
METHOD_OBJ["GET-CONFIG"] = {
    "get-config": {
        $: { xmlns: "urn:ietf:params:xml:ns:netconf:base:1.0" },
        source: { candidate: {} },
        filter: { $: { type: "subtree" } },
    },
};
METHOD_OBJ["EDIT-CONFIG"] = {
    "edit-config": { $: { xmlns: "urn:ietf:params:xml:ns:netconf:base:1.0" }, target: { candidate: {} }, config: {} },
};
METHOD_OBJ.COMMIT = { commit: { $: { xmlns: "urn:ietf:params:xml:ns:netconf:base:1.0" } } };
METHOD_OBJ.RPC = {};

export class Client {
    private router: any;

    constructor() {
        this.router = null;
    }

    getRouter(): any {
        return this.router;
    }

    deleteRouter(): void {
        this.router = null;
    }

    async initializeRouter(host: string, port: number, credentials: any): Promise<void> {
        if (this.router && this.router.connected) {
            // close the old one
            this.closeRouter();
        }
        this.router = {};
        this.router.host = host;
        this.router.port = port;
        this.router.username = credentials.username;
        if (credentials.privateKey) {
            this.router.pkey = await fsPromises.readFile(credentials.privateKey, { encoding: "utf8" });
        }
        if (credentials.password) {
            this.router.password = credentials.password;
        }
        return new Promise((resolve, reject) => {
            resolve(undefined);
        });
    }

    openRouter(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.router.connected) {
                // close the old one
                this.closeRouter();
            }
            this.router = new nodeNetconf.Client(this.router);
            this.router.open((err?: string) => {
                if (err) {
                    reject(err);
                } else {
                    console.debug(
                        "[binding-netconf]",
                        `New NetConf router opened connection with host ${this.router.host}, port ${this.router.port}, username ${this.router.username}`
                    );
                    resolve(undefined);
                }
            });
        });
    }

    rpc(xpathQuery: string, method: string, NSs: any, target: string, payload?: any): any {
        return new Promise((resolve, reject) => {
            if (payload) {
                xpathQuery = xpath2json.addLeaves(xpathQuery, payload);
            }
            const objRequest = xpath2json.xpath2json(xpathQuery, NSs);
            let finalRequest: any = {};
            finalRequest = JSON.parse(JSON.stringify(METHOD_OBJ[method])); // clone the METHOD_OBJ
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
            this.router.rpc(finalRequest, (err: string, results: any) => {
                if (err) {
                    reject(err);
                }
                resolve(results);
            });
        });
    }

    closeRouter(): void {
        this.router.sshConn.end();
        this.router.connected = false;
    }
}
