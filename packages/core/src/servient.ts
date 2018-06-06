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

import * as vm from "vm";

import WoTImpl from "./wot-impl";
import ExposedThing from "./exposed-thing";
import { ProtocolClientFactory, ProtocolServer, ResourceListener, ProtocolClient } from "./resource-listeners/protocol-interfaces"
import { default as ContentSerdes, ContentCodec } from "./content-serdes";
import { Thing } from "@node-wot/td-tools";
import * as TD from "@node-wot/td-tools";
import * as Helpers from "./helpers";

export default class Servient {
    private servers: Array<ProtocolServer> = [];
    private clientFactories: Map<string, ProtocolClientFactory> = new Map<string, ProtocolClientFactory>();
    private things: Map<string, ExposedThing> = new Map<string, ExposedThing>();
    private listeners: Map<string, ResourceListener> = new Map<string, ResourceListener>();
    private offeredMediaTypes: Array<string> = [ContentSerdes.DEFAUT]
    private credentialStore: Map<string, any> = new Map<string, any>();

    /** runs the script in a new sandbox */
    public runScript(code: string, filename = 'script') {
        let script = new vm.Script(code);
        let context = vm.createContext({
            'WoT': new WoTImpl(this),
            'console': console,
            'setInterval': setInterval,
            'setTimeout': setTimeout
        });
        let options = {
            "filename": filename,
            "displayErrors": true
        };
        try {
            script.runInContext(context, options);
        } catch (err) {
            let scriptPosition = err.stack.match(/at evalmachine\.<anonymous>\:([0-9]+\:[0-9]+)\n/)[1];
            console.error(`Servient caught error in privileged '${filename}' and halted at line ${scriptPosition}\n    ${err}`);
        }
    }

    /** runs the script in privileged context (dangerous) - means here: scripts can require */
    public runPrivilegedScript(code: string, filename = 'script') {
        let script = new vm.Script(code);
        let context = vm.createContext({
            'WoT': new WoTImpl(this),
            'console': console,
            'setInterval': setInterval,
            'setTimeout': setTimeout,
            'require': require
        });
        let options = {
            "filename": filename,
            "displayErrors": true
        };
        try {
            script.runInContext(context, options);
        } catch (err) {
            let scriptPosition = err.stack.match(/at evalmachine\.<anonymous>\:([0-9]+\:[0-9]+)\n/)[1];
            console.error(`Servient caught error in privileged '${filename}' and halted at line ${scriptPosition}\n    ${err}`);
        }
    }

    /** add a new codec to support a mediatype */
    public addMediaType(codec: ContentCodec, offered: boolean = false): void {
        ContentSerdes.addCodec(codec);
        if (offered) this.offeredMediaTypes.push(codec.getMediaType());
    }

    /** retun all media types that this servient supports */
    public getSupportedMediaTypes(): Array<string> {
        return ContentSerdes.getSupportedMediaTypes();
    }

    /** return only the media types that should be offered in the TD */
    public getOffereddMediaTypes(): Array<string> {
        // return a copy
        return this.offeredMediaTypes.slice(0);
    }

    public chooseLink(links: Array<TD.InteractionForm>): string {
        // TODO add an effective way of choosing a link
        // @mkovatsc order of ClientFactories added could decide priority
        return (links.length > 0) ? links[0].href : "nope://none";
    }

    public addResourceListener(path: string, resourceListener: ResourceListener) {
        // TODO debug-level
        console.log(`Servient adding ${resourceListener.constructor.name} '${path}'`);
        this.listeners.set(path, resourceListener);
        this.servers.forEach(srv => srv.addResource(path, resourceListener));
    }

    public removeResourceListener(path: string) {
        // TODO debug-level
        console.log(`Servient removing ResourceListener '${path}'`);
        this.listeners.delete(path);
        this.servers.forEach(srv => srv.removeResource(path));
    }

    public addServer(server: ProtocolServer): boolean {
        this.servers.push(server);
        this.listeners.forEach((listener, path) => server.addResource(path, listener));
        return true;
    }

    public getServers(): Array<ProtocolServer> {
        // return a copy -- FIXME: not a deep copy
        return this.servers.slice(0);
    }

    public addClientFactory(clientFactory: ProtocolClientFactory): void {
        this.clientFactories.set(clientFactory.scheme, clientFactory);
    }

    public hasClientFor(scheme: string): boolean {
        // TODO debug-level
        console.log(`Servient checking for '${scheme}' scheme in ${this.clientFactories.size} ClientFactories`);
        return this.clientFactories.has(scheme);
    }

    public getClientFor(scheme: string): ProtocolClient {
        if (this.clientFactories.has(scheme)) {
            // TODO debug-level
            console.log(`Servient creating client for scheme '${scheme}'`);
            return this.clientFactories.get(scheme).getClient();
        } else {
            // FIXME returning null was bad - Error or Promise?
            // h0ru5: caller cannot react gracefully - I'd throw Error
            throw new Error(`Servient has no ClientFactory for scheme '${scheme}'`);
        }
    }

    public getClientSchemes(): string[] {
        return Array.from(this.clientFactories.keys());
    }

    public addThingFromTD(thing: Thing): boolean {
        // TODO loop through all properties and add properties
        // TODO loop through all actions and add actions
        return false;
    }

    public addThing(thing: ExposedThing): boolean {
        if (!this.things.has(thing.name)) {
            this.things.set(thing.name, thing);
            return true;
        } else {
            return false;
        }
    }

    public getThing(name: string): ExposedThing {
        if (this.things.has(name)) {
            return this.things.get(name);
        } else return null;
    }

    public addCredentials(credentials: any) {
        if (typeof credentials === "object") {
            for (let i in credentials) {
                this.credentialStore.set(i, credentials[i]);
            }
        }
    }
    public getCredentials(identifier: string): any {
        let credentials = this.credentialStore.get(identifier);
        if (!credentials) console.error(`Servient missing credentials for '${identifier}'`);
        return credentials;
    }

    // will return WoT object
    public start(): Promise<WoT.WoTFactory> {
        let serverStatus: Array<Promise<void>> = [];
        this.servers.forEach((server) => serverStatus.push(server.start()));
        this.clientFactories.forEach((clientFactory) => clientFactory.init());

        return new Promise<WoT.WoTFactory>((resolve, reject) => {
            Promise.all(serverStatus)
                .then(() => {
                    resolve(new WoTImpl(this));
                })
                .catch(err => {
                    reject(err);
                });
        });
    }

    public shutdown(): void {
        this.clientFactories.forEach((clientFactory) => clientFactory.destroy());
        this.servers.forEach((server) => server.stop());
    }
}
