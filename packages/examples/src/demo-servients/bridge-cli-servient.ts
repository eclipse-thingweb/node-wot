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

// global W3C WoT Scripting API definitions
import * as WoT from "wot-typescript-definitions";
// node-wot implementation of W3C WoT Servient
import { Servient, Helpers } from "@node-wot/core";
// protocols used
import { HttpServer } from "@node-wot/binding-http";

import { FileClientFactory } from "@node-wot/binding-file";
import { HttpClientFactory } from "@node-wot/binding-http";
import { HttpsClientFactory } from "@node-wot/binding-http";
import { CoapClientFactory } from "@node-wot/binding-coap";
import { CoapsClientFactory } from "@node-wot/binding-coap";

export default class BridgeServient extends Servient {
    private static readonly defaultConfig = {
        http: {
            port: 8080,
            selfSigned: false,
        },
    };

    public readonly config: any;

    public constructor(password: string, config?: any) {
        super();

        // init config
        this.config = typeof config === "object" ? config : BridgeServient.defaultConfig;
        if (!this.config.http) this.config.http = BridgeServient.defaultConfig.http;

        // load credentials from config
        this.addCredentials(this.config.credentials);

        // remove secrets from original for displaying config (already added)
        if (this.config.credentials) delete this.config.credentials;

        // display
        console.info("BridgeServient configured with");
        console.dir(this.config);

        // http server for local control and monitoring
        let httpServer =
            typeof this.config.http.port === "number" ? new HttpServer(this.config.http.port) : new HttpServer();
        this.addServer(httpServer);

        // clients for consuming
        this.addClientFactory(new FileClientFactory());
        this.addClientFactory(new HttpClientFactory(this.config.http));
        this.addClientFactory(new HttpsClientFactory(this.config.http));
        this.addClientFactory(new CoapClientFactory());
        this.addClientFactory(new CoapsClientFactory());
    }

    /**
     * start
     */
    public start(): Promise<typeof WoT> {
        return new Promise<typeof WoT>((resolve, reject) => {
            super
                .start()
                .then((myWoT) => {
                    console.info("BridgeServient started");

                    // pass on WoTFactory
                    resolve(myWoT);
                })
                .catch((err) => reject(err));
        });
    }
}
