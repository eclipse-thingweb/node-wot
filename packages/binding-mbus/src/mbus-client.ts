/********************************************************************************
 * Copyright (c) 2021 Contributors to the Eclipse Foundation
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

/**
 * M-Bus master based on node-mbus
 */
import { MBusForm } from "./mbus";

import { ProtocolClient, Content, createDebugLogger } from "@node-wot/core";
import { SecurityScheme } from "@node-wot/td-tools";
import { MBusConnection, PropertyOperation } from "./mbus-connection";

import { Subscription } from "rxjs/Subscription";
import { ThingDescription } from "wot-typescript-definitions";

const debug = createDebugLogger("binding-mbus", "mbus-client");

const DEFAULT_PORT = 805;
const DEFAULT_TIMEOUT = 1000;

export default class MBusClient implements ProtocolClient {
    private _connections: Map<string, MBusConnection>;

    constructor() {
        this._connections = new Map();
    }

    readResource(form: MBusForm): Promise<Content> {
        return this.performOperation(form) as Promise<Content>;
    }

    writeResource(form: MBusForm, content: Content): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            throw new Error("Method not implemented.");
        });
    }

    invokeResource(form: MBusForm, content: Content): Promise<Content> {
        return new Promise<Content>((resolve, reject) => {
            throw new Error("Method not implemented.");
        });
    }

    unlinkResource(form: MBusForm): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            throw new Error("Method not implemented.");
        });
    }

    public subscribeResource(
        form: MBusForm,
        next: (value: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ): Promise<Subscription> {
        return new Promise<Subscription>((resolve, reject) => {
            throw new Error("Method not implemented.");
        });
    }

    async start(): Promise<void> {
        // do nothing
    }

    async stop(): Promise<void> {
        this._connections.forEach((connection) => {
            connection.close();
        });
    }

    setSecurity(metadata: SecurityScheme[], credentials?: never): boolean {
        return false;
    }

    private async performOperation(form: MBusForm): Promise<Content | void> {
        // get host and port
        const parsed = new URL(form.href);
        const port = parsed.port ? parseInt(parsed.port, 10) : DEFAULT_PORT;

        form = this.validateAndFillDefaultForm(form);

        const host = parsed.hostname;
        const hostAndPort = host + ":" + port;

        this.overrideFormFromURLPath(form);

        // find or create connection
        let connection = this._connections.get(hostAndPort);

        if (!connection) {
            debug(`Creating new MbusConnection for ${hostAndPort}`);
            this._connections.set(
                hostAndPort,
                new MBusConnection(host, port, { connectionTimeout: form["mbus:timeout"] || DEFAULT_TIMEOUT })
            );
            connection = this._connections.get(hostAndPort);
        } else {
            debug(`Reusing MbusConnection for ${hostAndPort}`);
        }
        // create operation
        const operation = new PropertyOperation(form);

        // enqueue the operation at the connection
        connection.enqueue(operation);

        // return a promise to execute the operation
        return connection.execute(operation);
    }

    private overrideFormFromURLPath(input: MBusForm) {
        const parsed = new URL(input.href);
        const pathComp = parsed.pathname.split("/");
        const query = parsed.searchParams;

        input["mbus:unitID"] = parseInt(pathComp[1], 10) || input["mbus:unitID"];
        input["mbus:offset"] = parseInt(query.get("offset"), 10) || input["mbus:offset"];
        input["mbus:timeout"] = parseInt(query.get("timeout"), 10) || input["mbus:timeout"];
    }

    private validateAndFillDefaultForm(form: MBusForm): MBusForm {
        const result: MBusForm = { ...form };

        if (form["mbus:unitID"] === undefined || form["mbus:unitID"] === null) {
            throw new Error("Malformed form: unitID must be defined");
        }
        if (form["mbus:offset"] === undefined || form["mbus:offset"] === null) {
            throw new Error("Malformed form: offset must be defined");
        }

        result["mbus:timeout"] = form["mbus:timeout"] ? form["mbus:timeout"] : DEFAULT_TIMEOUT;

        return result;
    }

    discoverDirectly(uri: string): Promise<ThingDescription> {
        throw new Error("Method not implemented.");
    }
}
