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

    /** A map of interactable Thing Properties with get()/set() functions */
    properties: {
        [key: string]: WoT.ThingProperty
    };

    /** A map of interactable Thing Actions with run() function */
    actions: {
        [key: string]: WoT.ThingAction;
    }

    /** A map of interactable Thing Events with subscribe() function */
    events: {
        [key: string]: WoT.ThingEvent;
    }
    
    private getServient: () => Servient;
    private getClients: () => Map<string, ProtocolClient>;

//    protected observablesEvent: Map<string, Subject<any>> = new Map();
//    protected observablesPropertyChange: Map<string, Subject<any>> = new Map();
//    protected observablesTDChange: Subject<any> = new Subject<any>();

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
            if (client) {
                console.log(`ConsumedThing '${this.name}' got new client for '${schemes[srvIdx]}'`);
                if (this.security) {
                    console.warn("ConsumedThing applying security metadata");
                    //console.dir(this.security);
                    client.setSecurity(this.security, this.getServient().getCredentials(this.id));
                }
                this.getClients().set(schemes[srvIdx], client);
                let form = forms[srvIdx];
                return { client: client, form: form }
            } else {
                throw new Error(`ConsumedThing '${this.name}' could not get client for '${schemes[srvIdx]}'`);
            }
        }
    }

    /**
     * Returns the Thing Description of the Thing.
     */
    getThingDescription(): WoT.ThingDescription {
        // returning cached version
        // return this.td;
        return JSON.stringify(this); // TODO strip out internals
    }

    // onPropertyChange(name: string): Observable<any> {
    //     if (!this.observablesPropertyChange.get(name)) {
    //         console.log("Create propertyChange observable for " + name);
    //         this.observablesPropertyChange.set(name, new Subject());
    //     }

    //     return this.observablesPropertyChange.get(name).asObservable();
    // }

    // onEvent(name: string): Observable<any> {
    //     if (!this.observablesEvent.get(name)) {
    //         console.log("Create event observable for " + name);
    //         this.observablesEvent.set(name, new Subject());
    //     }

    //     return this.observablesEvent.get(name).asObservable();
    // }

    // onTDChange(): Observable<any> {
    //     return this.observablesTDChange.asObservable();
    // }

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

    // get and set interface for the Property
    get(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            // get right client
            let { client, form } = this.getThing().getClientFor(this.forms);
            if (!client) {
                reject(new Error(`ConsumedThing '${this.getThing().name}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.getThing().name}' reading ${form.href}`);
                client.readResource(form).then((content) => {
                    if (!content.mediaType) content.mediaType = form.mediaType;
                    //console.log(`ConsumedThing decoding '${content.mediaType}' in readProperty`);
                    let value = ContentSerdes.contentToValue(content);
                    resolve(value);
                })
                .catch(err => { reject(err); });
            }
        });
    }
    set(value: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
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

    run(parameter?: any): Promise<any> {
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
                    let value = ContentSerdes.contentToValue(output);
                    resolve(value);
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

    public subscribe(next: ((value: any) => void), error?: (error: any) => void, complete?: () => void): Subscription {

        let { client, form } = this.getThing().getClientFor(this.forms);
            if (!client) {
                error(new Error(`ConsumedThing '${this.getThing().name}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.getThing().name}' subscribing to ${form.href}`);

                return client.subscribeResource(form,
                    (content) => {
                        if (!content.mediaType) content.mediaType = form.mediaType;
                        next( ContentSerdes.contentToValue(content) );
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
