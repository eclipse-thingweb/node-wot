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

import * as WoT from "wot-typescript-definitions";

import WoTImpl from "./wot-impl";
import ExposedThing from "./exposed-thing";
import { ProtocolClientFactory, ProtocolServer, ProtocolClient } from "./protocol-interfaces";
import ContentManager, { ContentCodec } from "./content-serdes";
import { v4 } from "uuid";
import { createLoggers } from "./logger";
import { Helpers } from "./core";

const { debug, warn } = createLoggers("core", "servient");

export default class Servient {
    private servers: Array<ProtocolServer> = [];
    private clientFactories: Map<string, ProtocolClientFactory> = new Map<string, ProtocolClientFactory>();
    private things: Map<string, ExposedThing> = new Map<string, ExposedThing>();
    private credentialStore: Map<string, Array<unknown>> = new Map<string, Array<unknown>>();

    #wotInstance?: typeof WoT;
    #shutdown = false;

    /** add a new codec to support a mediatype; offered mediatypes are listed in TDs */
    public addMediaType(codec: ContentCodec, offered = false): void {
        ContentManager.addCodec(codec, offered);
    }

    public expose(thing: ExposedThing): Promise<void> {
        if (this.servers.length === 0) {
            warn(`Servient has no servers to expose Things`);
            return new Promise<void>((resolve) => {
                resolve();
            });
        }

        debug(`Servient exposing '${thing.title}'`);

        // What is a good way to to convey forms information like contentType et cetera for interactions
        const tdTemplate: WoT.ThingDescription = Helpers.structuredClone(thing) as WoT.ThingDescription;

        // initializing forms fields
        thing.forms = [];
        for (const property of Object.values(thing.properties)) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            property.forms = [];
        }
        for (const action of Object.values(thing.actions)) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            action.forms = [];
        }
        for (const event of Object.values(thing.events)) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            event.forms = [];
        }

        const serverPromises: Promise<void>[] = [];
        this.servers.forEach((server) => {
            serverPromises.push(server.expose(thing, tdTemplate));
        });

        return new Promise<void>((resolve, reject) => {
            Promise.all(serverPromises)
                .then(() => resolve())
                .catch((err) => reject(err));
        });
    }

    public addThing(thing: ExposedThing): boolean {
        if (!thing.id) {
            thing.id = "urn:uuid:" + v4();
            warn(`Servient generating ID for '${thing.title}': '${thing.id}'`);
        }

        if (!this.things.has(thing.id)) {
            this.things.set(thing.id, thing);
            debug(`Servient reset ID '${thing.id}' with '${thing.title}'`);
            return true;
        } else {
            return false;
        }
    }

    public destroyThing(thingId: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            if (this.things.has(thingId)) {
                debug(`Servient destroying thing with id '${thingId}'`);
                this.things.delete(thingId);
                const serverPromises: Promise<boolean>[] = [];
                this.servers.forEach((server) => {
                    serverPromises.push(server.destroy(thingId));
                });
                Promise.all(serverPromises)
                    .then(() => resolve(true))
                    .catch((err) => reject(err));
            } else {
                warn(`Servient was asked to destroy thing but failed to find thing with id '${thingId}'`);
                resolve(false);
            }
        });
    }

    public getThing(id: string): ExposedThing | undefined {
        if (this.things.has(id)) {
            return this.things.get(id);
        } else return undefined;
    }

    // FIXME should be getThingDescriptions (breaking change)
    public getThings(): Record<string, WoT.ThingDescription> {
        debug(`Servient getThings size == '${this.things.size}'`);
        const ts: { [key: string]: WoT.ThingDescription } = {};
        this.things.forEach((thing, id) => {
            ts[id] = thing.getThingDescription();
        });
        return ts;
    }

    public addServer(server: ProtocolServer): boolean {
        // add all exposed Things to new server
        this.things.forEach((thing, id) => server.expose(thing));

        this.servers.push(server);
        return true;
    }

    public getServers(): Array<ProtocolServer> {
        // return a copy -- FIXME: not a deep copy
        return this.servers.slice(0);
    }

    public addClientFactory(clientFactory: ProtocolClientFactory): void {
        debug(`Servient adding client factory for '${clientFactory.scheme}'`);
        this.clientFactories.set(clientFactory.scheme, clientFactory);
    }

    public removeClientFactory(scheme: string): boolean {
        debug(`Servient removing client factory for '${scheme}'`);
        this.clientFactories.get(scheme)?.destroy();
        return this.clientFactories.delete(scheme);
    }

    public hasClientFor(scheme: string): boolean {
        debug(`Servient checking for '${scheme}' scheme in ${this.clientFactories.size} ClientFactories`);
        return this.clientFactories.has(scheme);
    }

    public getClientFor(scheme: string): ProtocolClient {
        const clientFactory = this.clientFactories.get(scheme);
        if (clientFactory) {
            debug(`Servient creating client for scheme '${scheme}'`);
            return clientFactory.getClient();
        } else {
            // FIXME returning null was bad - Error or Promise?
            // h0ru5: caller cannot react gracefully - I'd throw Error
            throw new Error(`Servient has no ClientFactory for scheme '${scheme}'`);
        }
    }

    public getClientSchemes(): string[] {
        return Array.from(this.clientFactories.keys());
    }

    public addCredentials(credentials: Record<string, unknown>): void {
        for (const [credentialKey, credentialValue] of Object.entries(credentials ?? {})) {
            debug(`Servient storing credentials for '${credentialKey}'`);
            const currentCredentials = this.credentialStore.get(credentialKey) ?? [];
            if (currentCredentials.length === 0) {
                this.credentialStore.set(credentialKey, currentCredentials);
            }
            currentCredentials.push(credentialValue);
        }
    }

    /**
     * @deprecated use retrieveCredentials() instead which may return multiple credentials
     *
     * @param identifier id
     */
    public getCredentials(identifier: string): unknown {
        debug(`Servient looking up credentials for '${identifier}' (@deprecated)`);
        const currentCredentials = this.credentialStore.get(identifier);
        if (currentCredentials && currentCredentials.length > 0) {
            // return first
            return currentCredentials[0];
        } else {
            return undefined;
        }
    }

    public retrieveCredentials(identifier: string): Array<unknown> | undefined {
        debug(`Servient looking up credentials for '${identifier}'`);
        return this.credentialStore.get(identifier);
    }

    // will return WoT object
    public async start(): Promise<typeof WoT> {
        if (this.#wotInstance !== undefined) {
            debug("Servient started already -> nop -> returning previous WoT implementation");
            return this.#wotInstance;
        }
        if (this.#shutdown) {
            throw Error("Servient cannot be started (again) since it was already stopped");
        }

        const serverStatus: Array<Promise<void>> = [];
        this.servers.forEach((server) => serverStatus.push(server.start(this)));
        this.clientFactories.forEach((clientFactory) => clientFactory.init());

        await Promise.all(serverStatus);
        return (this.#wotInstance = new WoTImpl(this));
    }

    public async shutdown(): Promise<void> {
        if (this.#wotInstance === undefined) {
            throw Error("Servient cannot be shutdown, wasn't even started");
        }
        if (this.#shutdown) {
            debug("Servient shutdown already -> nop");
            return;
        }

        this.clientFactories.forEach((clientFactory) => clientFactory.destroy());

        const promises = this.servers.map((server) => server.stop());
        await Promise.all(promises);
        this.#shutdown = true;
        this.#wotInstance = undefined; // clean-up reference
    }
}
