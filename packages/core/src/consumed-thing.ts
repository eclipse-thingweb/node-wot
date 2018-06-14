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

import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

export interface ClientAndForm {
    client: ProtocolClient
    form: WoT.Form
}


export abstract class ConsumedThingInteraction {
    // export getClientFor
    label: string;
    forms: Array<WoT.Form>;
    links: Array<WoT.Link>;

    thingName: string;
    thingId: string;
    thingSecurity: any;
    clients: Map<string, ProtocolClient> = new Map();
    readonly srv: Servient;


    constructor(thingName: string, thingId: string, thingSecurity: any, clients: Map<string, ProtocolClient>, srv: Servient) {
        this.thingName = thingName;
        this.thingId = thingId;
        this.thingSecurity = thingSecurity;
        this.clients = clients;
        this.srv = srv;
    }

    // utility for Property, Action and Event
    getClientFor(forms: Array<TD.Form>): ClientAndForm {
        if (forms.length === 0) {
            throw new Error("ConsumedThing '${this.name}' has no links for this interaction");
        }

        let schemes = forms.map(link => Helpers.extractScheme(link.href))
        let cacheIdx = schemes.findIndex(scheme => this.clients.has(scheme))

        if (cacheIdx !== -1) {
            // from cache
            console.debug(`ConsumedThing '${this.thingName}' chose cached client for '${schemes[cacheIdx]}'`);
            let client = this.clients.get(schemes[cacheIdx]);
            let form = forms[cacheIdx];
            return { client: client, form: form };
        } else {
            // new client
            console.debug(`ConsumedThing '${this.thingName}' has no client in cache (${cacheIdx})`);
            let srvIdx = schemes.findIndex(scheme => this.srv.hasClientFor(scheme));
            if (srvIdx === -1) throw new Error(`ConsumedThing '${this.thingName}' missing ClientFactory for '${schemes}'`);
            let client = this.srv.getClientFor(schemes[srvIdx]);
            if (client) {
                console.log(`ConsumedThing '${this.thingName}' got new client for '${schemes[srvIdx]}'`);
                if (this.thingSecurity) {
                    console.warn("ConsumedThing applying security metadata");
                    //console.dir(this.security);
                    client.setSecurity(this.thingSecurity, this.srv.getCredentials(this.thingId));
                }
                this.clients.set(schemes[srvIdx], client);
                let form = forms[srvIdx];
                return { client: client, form: form }
            } else {
                throw new Error(`ConsumedThing '${this.thingName}' could not get client for '${schemes[srvIdx]}'`);
            }
        }
    }
}

export class ConsumedThingProperty extends ConsumedThingInteraction implements WoT.ThingProperty, WoT.DataSchema {
    writable: boolean;
    observable: boolean;
    value: any;
    type: WoT.DataType;

    // get and set interface for the Property
    get(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            // get right client
            let { client, form } = this.getClientFor(this.forms);
            if (!client) {
                reject(new Error(`ConsumedThing '${this.thingName}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.thingName}' reading ${form.href}`);
                client.readResource(form).then((content) => {
                    if (!content.mediaType) content.mediaType = form.mediaType;
                    //console.log(`ConsumedThing decoding '${content.mediaType}' in readProperty`);
                    let value = ContentSerdes.contentToValue(content);
                    resolve(value);
                })
                    .catch(err => { console.log("Failed to read because " + err); });
            }

        });
    }
    set(value: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let { client, form } = this.getClientFor(this.forms);
            if (!client) {
                reject(new Error(`ConsumedThing '${this.thingName}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.thingName}' writing ${form.href} with '${value}'`);
                let content = ContentSerdes.valueToContent(value, form.mediaType)
                resolve(client.writeResource(form, content));

                // // TODO observables
                // if (this.observablesPropertyChange.get(propertyName)) {
                //     this.observablesPropertyChange.get(propertyName).next(newValue);
                // };
            }
        });
    }
}

export class ConsumedThingAction extends ConsumedThingInteraction implements WoT.ThingAction {
    run(parameter?: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let { client, form } = this.getClientFor(this.forms);
            if (!client) {
                reject(new Error(`ConsumedThing '${this.thingName}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.thingName}' invoking ${form.href} with '${parameter}'`);

                let mediaType = form.mediaType;
                let input = ContentSerdes.valueToContent(parameter, form.mediaType);

                client.invokeResource(form, input).then((output) => {
                    if (!output.mediaType) output.mediaType = form.mediaType;
                    //console.log(`ConsumedThing decoding '${output.mediaType}' in invokeAction`);
                    let value = ContentSerdes.contentToValue(output);
                    resolve(value);
                });
            }
        });
    }
}

export class ConsumedThingEvent extends ConsumedThingProperty implements WoT.ThingEvent {
}



export default class ConsumedThing extends TD.Thing implements WoT.ConsumedThing {

    protected readonly srv: Servient;
    protected clients: Map<string, ProtocolClient> = new Map();
    protected observablesEvent: Map<string, Subject<any>> = new Map();
    protected observablesPropertyChange: Map<string, Subject<any>> = new Map();
    protected observablesTDChange: Subject<any> = new Subject<any>();

    constructor(servient: Servient) {
        super();
        this.srv = servient;
    }

    /**
     * Walk over all interactions and extend
     */
    init() {
        console.log("Properties #: " + Object.keys(this.properties).length);
        console.log("Actions    #: " + Object.keys(this.actions).length);
        console.log("Events     #: " + Object.keys(this.events).length);

        if (this.properties != undefined && this.properties instanceof Object) {
            for (var name in this.properties) {
                let prop = this.properties[name];
                let ctProp = new ConsumedThingProperty(this.name, this.id, this.security, this.clients, this.srv);
                let p: ConsumedThingProperty = Helpers.extend(prop, ctProp);
                this.properties[name] = p;
            }
        } else {
            this.properties = {};
        }

        if (this.actions != undefined && this.actions instanceof Object) {
            for (var name in this.actions) {
                let act = this.actions[name];
                let ctAct = new ConsumedThingAction(this.name, this.id, this.security, this.clients, this.srv);
                let a = Helpers.extend(act, ctAct);
                this.actions[name] = a;
            }
        } else {
            this.actions = {};
        }

        if (this.events != undefined && this.events instanceof Object) {
            for (var name in this.events) {
                let ev = this.events[name];
                let ctEv = new ConsumedThingEvent(this.name, this.id, this.security, this.clients, this.srv);
                let a = Helpers.extend(ev, ctEv);
                this.events[name] = a;
            }
        } else {
            this.events = {};
        }
    }

    get(param: string): any {
        return this.thing[param];
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

