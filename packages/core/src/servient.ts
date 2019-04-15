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

import * as WoT from "wot-typescript-definitions";

import WoTImpl from "./wot-impl";
import ExposedThing from "./exposed-thing";
import { ProtocolClientFactory, ProtocolServer, ProtocolClient } from "./protocol-interfaces"
import { default as ContentManager, ContentCodec } from "./content-serdes";

export default class Servient {
    private servers: Array<ProtocolServer> = [];
    private clientFactories: Map<string, ProtocolClientFactory> = new Map<string, ProtocolClientFactory>();
    private things: Map<string, ExposedThing> = new Map<string, ExposedThing>();
    private credentialStore: Map<string, any> = new Map<string, any>();

    /** runs the script in a new sandbox */
    public runScript(code: string, filename = 'script') {
        
        let script;

        try {
            script = new vm.Script(code);
        } catch (err) {
            let scriptPosition = err.stack.match(/evalmachine\.<anonymous>\:([0-9]+)\n/)[1];
            console.error(`Servient found error in '${filename}' at line ${scriptPosition}\n    ${err}`);
            return;
        }

        let context = vm.createContext({
            "WoT": new WoTImpl(this),
            "console": console,
            // augmented scheduling functions that catch errors
            "setInterval": (handler: (...args: any[]) => void, ms: number, ...args: any[]) => {
                return setInterval( () => {
                    try {
                        handler(args);
                    } catch(err) {
                        this.logScriptError(`async error in setInterval() in '${filename}'`, err);
                    }
                }, ms);
            },
            "clearInterval": clearInterval,
            "setTimeout": (handler: (...args: any[]) => void, ms: number, ...args: any[]) => {
                return setTimeout( () => {
                    try {
                        handler(args);
                    } catch(err) {
                        this.logScriptError(`async error in setTimeout() in '${filename}'`, err);
                    }
                }, ms);
            },
            "clearTimeout": clearTimeout,
            "setImmediate": (handler: (...args: any[]) => void, ...args: any[]) => {
                return setImmediate( () => {
                    try {
                        handler(args);
                    } catch(err) {
                        this.logScriptError(`async error in setImmediate() in '${filename}'`, err);
                    }
                });
            },
            "clearImmediate": clearImmediate
        });
        let options = {
            "filename": filename,
            "displayErrors": true
        };
        try {
            script.runInContext(context, options);
        } catch (err) {
            this.logScriptError(`error in '${filename}'`, err);
        }
    }

    /** runs the script in privileged context (dangerous) - means here: scripts can require */
    public runPrivilegedScript(code: string, filename = 'script') {
        
        let script;

        try {
            script = new vm.Script(code);
        } catch (err) {
            let scriptPosition = err.stack.match(/evalmachine\.<anonymous>\:([0-9]+)\n/)[1];
            console.error(`Servient found error in privileged script '${filename}' at line ${scriptPosition}\n    ${err}`);
            return;
        }

        let context = vm.createContext({
            "WoT": new WoTImpl(this),
            "console": console,
            // augmented scheduling functions that catch errors
            "setInterval": (handler: (...args: any[]) => void, ms: number, ...args: any[]) => {
                return setInterval( () => {
                    try {
                        handler(args);
                    } catch(err) {
                        this.logScriptError(`async error in setInterval() in privileged '${filename}'`, err);
                    }
                }, ms);
            },
            "clearInterval": clearInterval,
            "setTimeout": (handler: (...args: any[]) => void, ms: number, ...args: any[]) => {
                return setTimeout( () => {
                    try {
                        handler(args);
                    } catch(err) {
                        this.logScriptError(`async error in setTimeout() in privileged '${filename}'`, err);
                    }
                }, ms);
            },
            "clearTimeout": clearTimeout,
            "setImmediate": (handler: (...args: any[]) => void, ...args: any[]) => {
                return setImmediate( () => {
                    try {
                        handler(args);
                    } catch(err) {
                        this.logScriptError(`async error in setImmediate() in privileged '${filename}'`, err);
                    }
                });
            },
            "clearImmediate": clearImmediate,
            // privileged items
            "require": require
        });
        let options = {
            "filename": filename,
            "displayErrors": true
        };
        try {
            script.runInContext(context, options);
        } catch (err) {
            this.logScriptError(`error in privileged '${filename}'`, err);
        }
    }

    private logScriptError(description: string, error: any): void {
        let message: string;
        if (typeof error==="object" && error.stack) {
            let match = error.stack.match(/evalmachine\.<anonymous>\:([0-9]+\:[0-9]+)/);
            if (Array.isArray(match)) {
                message = `and halted at line ${match[1]}\n    ${error}`;
            } else {
                message = `and halted with ${error.stack}`;
            }
        } else {
            message = `that threw ${typeof error} instead of Error\n    ${error}`;
        }
        console.error(`Servient caught ${description} ${message}`);
    }

    /** add a new codec to support a mediatype; offered mediatypes are listed in TDs */
    public addMediaType(codec: ContentCodec, offered: boolean = false) {
        ContentManager.addCodec(codec, offered);
    }

    public expose(thing: ExposedThing): Promise<void> {

        if (this.servers.length === 0) {
            console.warn(`Servient has no servers to expose Things`);
            return new Promise<void>((resolve) => { resolve(); });
        }

        console.log(`Servient exposing '${thing.name}'`);

        // initializing forms fields
        thing.forms = [];
        for (let name in thing.properties) {
            thing.properties[name].forms = [];
        }
        for (let name in thing.actions) {
            thing.actions[name].forms = [];
        }
        for (let name in thing.events) {
            thing.events[name].forms = [];
        }

        let serverPromises: Promise<void>[] = [];
        this.servers.forEach( (server) => { serverPromises.push(server.expose(thing)); });

        return new Promise<void>((resolve, reject) => {
            Promise.all(serverPromises).then( () => resolve() ).catch( (err) => reject(err) );
        });
    }
    
    public addThing(thing: ExposedThing): boolean {

        if (thing.id === undefined) {
            console.warn(`Servient generating ID for '${thing.name}'`);
            thing.id = "urn:uuid:" + require("uuid").v4();
        }

        if (!this.things.has(thing.id)) {
            this.things.set(thing.id, thing);
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
        this.clientFactories.set(clientFactory.scheme, clientFactory);
    }

    public hasClientFor(scheme: string): boolean {
        console.debug(`Servient checking for '${scheme}' scheme in ${this.clientFactories.size} ClientFactories`);
        return this.clientFactories.has(scheme);
    }

    public getClientFor(scheme: string): ProtocolClient {
        if (this.clientFactories.has(scheme)) {
            console.debug(`Servient creating client for scheme '${scheme}'`);
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

    public addCredentials(credentials: any) {
        if (typeof credentials === "object") {
            for (let i in credentials) {
                console.log(`Servient storing credentials for '${i}'`);
                this.credentialStore.set(i, credentials[i]);
            }
        }
    }
    public getCredentials(identifier: string): any {
        console.log(`Servient looking up credentials for '${identifier}'`);
        return this.credentialStore.get(identifier);
    }

    // will return WoT object
    public start(): Promise<WoT.WoTFactory> {
        let serverStatus: Array<Promise<void>> = [];
        this.servers.forEach((server) => serverStatus.push(server.start(this)));
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
