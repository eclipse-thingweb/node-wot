/********************************************************************************
 * Copyright (c) 2018 - 2020 Contributors to the Eclipse Foundation
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

import {NodeVM, CompilerFunction} from "vm2";

import * as WoT from "wot-typescript-definitions";

import WoTImpl from "./wot-impl";
import Helpers from "./helpers";
import ExposedThing from "./exposed-thing";
import { ProtocolClientFactory, ProtocolServer, ProtocolClient } from "./protocol-interfaces"
import { default as ContentManager, ContentCodec } from "./content-serdes";

export default class Servient {
    private servers: Array<ProtocolServer> = [];
    private clientFactories: Map<string, ProtocolClientFactory> = new Map<string, ProtocolClientFactory>();
    private things: Map<string, ExposedThing> = new Map<string, ExposedThing>();
    private credentialStore: Map<string, Array<any>> = new Map<string, Array<any>>();

    private uncaughtListeners:Array<(...args:any)=>void> = []

    /** runs the script in a new sandbox */
    public runScript(code: string, filename = 'script') {

        let context = {
            "WoT": new WoTImpl(this),
            "WoTHelpers": new Helpers(this)
        };

        const vm = new NodeVM({
            sandbox: context
        })

        let listener = (err:Error) => {
            this.logScriptError(`Asynchronous script error '${filename}'`, err)
            //TODO: clean up script resources
            process.exit(1)
        }
        process.prependListener('uncaughtException',listener)
        this.uncaughtListeners.push(listener)

        try {
            return vm.run(code, filename)
        } catch (err) {
            this.logScriptError(`Servient found error in privileged script '${filename}'`, err)
        }
    }

    /** runs the script in privileged context (dangerous) - means here: scripts can require */
    public runPrivilegedScript(code: string, filename = 'script',options:ScriptOptions={}) {
    
        let context = {
            "WoT": new WoTImpl(this),
            "WoTHelpers": new Helpers(this)
        };

        const vm = new NodeVM({
            sandbox:context,
            require: {
                external: true
            },
            argv: options.argv,
            compiler: options.compiler,
            env: options.env
        })
        
        let listener = (err: Error) => {
            this.logScriptError(`Asynchronous script error '${filename}'`, err)
            //TODO: clean up script resources
            process.exit(1)
        }
        process.prependListener('uncaughtException', listener)
        this.uncaughtListeners.push(listener)

        try {
            return vm.run(code,filename)
        } catch (err) {
            this.logScriptError(`Servient found error in privileged script '${filename}'`,err)
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
        console.error("[core/servient]",`Servient caught ${description} ${message}`);
    }

    /** add a new codec to support a mediatype; offered mediatypes are listed in TDs */
    public addMediaType(codec: ContentCodec, offered: boolean = false) {
        ContentManager.addCodec(codec, offered);
    }

    public expose(thing: ExposedThing): Promise<void> {

        if (this.servers.length === 0) {
            console.warn("[core/servient]",`Servient has no servers to expose Things`);
            return new Promise<void>((resolve) => { resolve(); });
        }

        console.debug("[core/servient]",`Servient exposing '${thing.title}'`);

        // What is a good way to to convey forms information like contentType et cetera for interactions
        let tdTemplate: WoT.ThingDescription = JSON.parse(JSON.stringify(thing));

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
        this.servers.forEach( (server) => { serverPromises.push(server.expose(thing, tdTemplate)); });

        return new Promise<void>((resolve, reject) => {
            Promise.all(serverPromises).then( () => resolve() ).catch( (err) => reject(err) );
        });
    }
    
    public addThing(thing: ExposedThing): boolean {

        if (thing.id === undefined) {
            thing.id = "urn:uuid:" + require("uuid").v4();
            console.warn("[core/servient]",`Servient generating ID for '${thing.title}': '${thing.id}'`);
        }

        if (!this.things.has(thing.id)) {
            this.things.set(thing.id, thing);
            console.debug("[core/servient]",`Servient reset ID '${thing.id}' with '${thing.title}'`);
            return true;
        } else {
            return false;
        }
    }

    public getThing(id: string): ExposedThing {
        if (this.things.has(id)) {
            return this.things.get(id);
        } else return null;
    }

    // FIXME should be getThingDescriptions (breaking change)
    public getThings(): object {
        console.debug("[core/servient]",`Servient getThings size == '${this.things.size}'`);
        let ts : { [key: string]: object } = {};
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
        this.clientFactories.set(clientFactory.scheme, clientFactory);
    }

    public hasClientFor(scheme: string): boolean {
        console.debug("[core/servient]",`Servient checking for '${scheme}' scheme in ${this.clientFactories.size} ClientFactories`);
        return this.clientFactories.has(scheme);
    }

    public getClientFor(scheme: string): ProtocolClient {
        if (this.clientFactories.has(scheme)) {
            console.debug("[core/servient]",`Servient creating client for scheme '${scheme}'`);
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
                console.debug("[core/servient]",`Servient storing credentials for '${i}'`);
                let currentCredentials : Array<any> = this.credentialStore.get(i);
                if(!currentCredentials) {
                    currentCredentials = [];
                    this.credentialStore.set(i, currentCredentials);
                }
                currentCredentials.push(credentials[i]);
            }
        }
    }

    /**
     * @deprecated use retrieveCredentials() instead which may return multiple credentials
     * 
     * @param identifier id
     */
    public getCredentials(identifier: string): any {
        console.debug("[core/servient]", `Servient looking up credentials for '${identifier}' (@deprecated)`);
        let currentCredentials: Array<any> = this.credentialStore.get(identifier);
        if (currentCredentials && currentCredentials.length > 0) {
            // return first
            return currentCredentials[0];
        } else {
            return undefined;
        }
    }

    public retrieveCredentials(identifier: string): Array<any> {
        console.debug("[core/servient]", `Servient looking up credentials for '${identifier}'`);
        return this.credentialStore.get(identifier);
    }

    // will return WoT object
    public start(): Promise<WoT.WoT> {
        let serverStatus: Array<Promise<void>> = [];
        this.servers.forEach((server) => serverStatus.push(server.start(this)));
        this.clientFactories.forEach((clientFactory) => clientFactory.init());

        return new Promise<WoT.WoT>((resolve, reject) => {
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

        this.uncaughtListeners.forEach(listener =>{
            process.removeListener("uncaughtException",listener);
        })
    }
}

export interface ScriptOptions {
    argv?:Array<string>;
    compiler?: CompilerFunction;
    env?:Object;
}
