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

import * as TD from "@node-wot/td-tools";

import Servient from "./servient";
import * as Helpers from "./helpers";

import { ProtocolClient } from "./resource-listeners/protocol-interfaces";

import ContentSerdes from "./content-serdes"

import { Subscribable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';

export default class ConsumedThing extends TD.Thing implements WoT.ConsumedThing {

    /** A map of interactable Thing Properties with read()/write()/subscribe() functions */
    properties: {
        [key: string]: WoT.ThingProperty
    };

    /** A map of interactable Thing Actions with invoke() function */
    actions: {
        [key: string]: WoT.ThingAction;
    }

    /** A map of interactable Thing Events with subscribe() function */
    events: {
        [key: string]: WoT.ThingEvent;
    }
    
    private getServient: () => Servient;
    private getClients: () => Map<string, ProtocolClient>;

    constructor(servient: Servient) {
        super();

        this.getServient = () => { return servient; };
        this.getClients = (new class {
            clients: Map<string, ProtocolClient> = new Map<string, ProtocolClient>();
            getMap = () => { return this.clients };
        }).getMap;
    }

    extendInteractions(): void {
        for (let propertyName in this.properties) {
            let newProp = Helpers.extend(this.properties[propertyName], new ConsumedThingProperty(propertyName, this));
            this.properties[propertyName] = newProp;
        }
        for (let actionName in this.actions) {
            let newAction = Helpers.extend(this.actions[actionName], new ConsumedThingAction(actionName, this));
            this.actions[actionName] = newAction;
        }
        for (let eventName in this.events) {
            let newEvent = Helpers.extend(this.events[eventName], new ConsumedThingEvent(eventName, this));
            this.events[eventName] = newEvent;
        }
    }
    
    // utility for Property, Action, and Event
    getClientFor(forms: Array<TD.Form>): ClientAndForm {
        if (forms.length === 0) {
            throw new Error(`ConsumedThing '${this.name}' has no links for this interaction`);
        }

        let schemes = forms.map(link => Helpers.extractScheme(link.href))
        let cacheIdx = schemes.findIndex(scheme => this.getClients().has(scheme))

        if (cacheIdx !== -1) {
            // from cache
            console.debug(`ConsumedThing '${this.name}' chose cached client for '${schemes[cacheIdx]}'`);
            let client = this.getClients().get(schemes[cacheIdx]);
            let form = forms[cacheIdx];
            return { client: client, form: form };
        } else {
            // new client
            console.debug(`ConsumedThing '${this.name}' has no client in cache (${cacheIdx})`);
            let srvIdx = schemes.findIndex(scheme => this.getServient().hasClientFor(scheme));
            
            if (srvIdx === -1) throw new Error(`ConsumedThing '${this.name}' missing ClientFactory for '${schemes}'`);
            
            let client = this.getServient().getClientFor(schemes[srvIdx]);
            console.log(`ConsumedThing '${this.name}' got new client for '${schemes[srvIdx]}'`);
            
            if (this.security) {
                client.setSecurity(this.security, this.getServient().getCredentials(this.id));
            }
            this.getClients().set(schemes[srvIdx], client);
            let form = forms[srvIdx];
            return { client: client, form: form }
        }
    }
}

export interface ClientAndForm {
    client: ProtocolClient
    form: WoT.Form
}

class ConsumedThingProperty extends TD.PropertyFragment implements WoT.ThingProperty, WoT.BaseSchema {

    // functions for wrapping internal state
    private getName: () => string;
    private getThing: () => ConsumedThing;

    constructor(name: string, thing: ConsumedThing) {
        super();

        // wrap internal state into functions to not be stringified in TD
        this.getName = () => { return name; }
        this.getThing = () => { return thing; }
    }

    /** WoT.ThingProperty interface: read this Property of the remote Thing (async) */
    public read(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            // TODO pass expected form rel to getClientFor()
            let { client, form } = this.getThing().getClientFor(this.forms);
            if (!client) {
                reject(new Error(`ConsumedThing '${this.getThing().name}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.getThing().name}' reading ${form.href}`);
                client.readResource(form).then((content) => {
                    if (!content.contentType) content.contentType = form.mediaType;
                    try {
                        let value = ContentSerdes.contentToValue(content, <any>this);
                        resolve(value);
                    } catch {
                        reject(new Error(`Received invalid content from Thing`));
                    }
                })
                .catch(err => { reject(err); });
            }
        });
    }

    /** WoT.ThingProperty interface: write this Property of the remote Thing (async) */
    public write(value: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // TODO pass expected form rel to getClientFor()
            let { client, form } = this.getThing().getClientFor(this.forms);
            if (!client) {
                reject(new Error(`ConsumedThing '${this.getThing().name}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.getThing().name}' writing ${form.href} with '${value}'`);
                let content = ContentSerdes.valueToContent(value, form.mediaType);

                client.writeResource(form, content).then(() => {
                    resolve();
                })
                .catch(err => { reject(err); });
            }
        });
    }
    
    /** WoT.ThingProperty interface: subscribe to changes of this Property of the remote Thing */
    public subscribe(next?: (value: any) => void, error?: (error: any) => void, complete?: () => void): Subscription {
        // TODO pass expected form rel to getClientFor()
        throw new Error(`Not implemented`);
    }
}

class ConsumedThingAction extends TD.ActionFragment implements WoT.ThingAction {

    // functions for wrapping internal state
    private getName: () => string;
    private getThing: () => ConsumedThing;

    constructor(name: string, thing: ConsumedThing) {
        super();

        // wrap internal state into functions to not be stringified in TD
        this.getName = () => { return name; }
        this.getThing = () => { return thing; }
    }

    /** WoT.ThingAction interface: invoke this Action on the remote Thing (async) */
    public invoke(parameter?: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let { client, form } = this.getThing().getClientFor(this.forms);
            if (!client) {
                reject(new Error(`ConsumedThing '${this.getThing().name}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.getThing().name}' invoking ${form.href}${parameter!==undefined ? " with '"+parameter+"'" : ""}`);

                let input;
                
                if (parameter!== undefined) {
                    input = ContentSerdes.valueToContent(parameter, form.mediaType);
                }

                client.invokeResource(form, input).then((output: any) => {
                    // infer media type from form if not in response metadata
                    if (!output.mediaType) output.mediaType = form.mediaType;
                    try {
                        let value = ContentSerdes.contentToValue(output, this.output);
                        resolve(value);
                    } catch {
                        reject(new Error(`Received invalid content from Thing`));
                    }
                })
                .catch(err => { reject(err); });
            }
        });
    }
}

class ConsumedThingEvent extends TD.EventFragment implements Subscribable<any> {

    // functions for wrapping internal state
    private getName: () => string;
    private getThing: () => ConsumedThing;

    constructor(name: string, thing: ConsumedThing) {
        super();

        // wrap internal state into functions to not be stringified in TD
        this.getName = () => { return name; }
        this.getThing = () => { return thing; }
    }

    /** WoT.ThingEvent interface: subscribe to this Event of the remote Thing */
    public subscribe(next: (value: any) => void, error?: (error: any) => void, complete?: () => void): Subscription {

        let { client, form } = this.getThing().getClientFor(this.forms);
        if (!client) {
            error(new Error(`ConsumedThing '${this.getThing().name}' did not get suitable client for ${form.href}`));
        } else {
            console.log(`ConsumedThing '${this.getThing().name}' subscribing to ${form.href}`);

            return client.subscribeResource(form,
                (content) => {
                    if (!content.contentType) content.contentType = form.mediaType;
                    try {
                        let value = ContentSerdes.contentToValue(content, <any>this);
                        next(value);
                    } catch {
                        error(new Error(`Received invalid content from Thing`));
                    }
                },
                (err) => {
                    error(err);
                },
                () => {
                    complete();
                }
            );
        }
    }
}
