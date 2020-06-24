/********************************************************************************
 * Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
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
import Helpers from "./helpers";

import { ProtocolClient, Content } from "./protocol-interfaces";

import { default as ContentManager } from "./content-serdes"

import { Subscribable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import UriTemplate = require('uritemplate');

export default class ConsumedThing extends TD.Thing implements WoT.ConsumedThing {

    /** A map of interactable Thing Properties with read()/write()/subscribe() functions */
    properties: {
        [key: string]: TD.ThingProperty
    };

    /** A map of interactable Thing Actions with invoke() function */
    actions: {
        [key: string]: TD.ThingAction;
    }

    /** A map of interactable Thing Events with subscribe() function */
    events: {
        [key: string]: TD.ThingEvent;
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

    getThingDescription(): WoT.ThingDescription {
        return JSON.parse(JSON.stringify(this));
    }

    public emitEvent(name: string, data: any): void {
        console.warn("not implemented");
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


    findForm(forms: Array<TD.Form>, op: string, schemes: string[], idx: number): TD.Form {
        let form = null;

        // find right operation and corresponding scheme in the array form
        for (let f of forms) {
            if (f.op != undefined)
                if (f.op.indexOf(op) != -1 && f.href.indexOf(schemes[idx] + ":") != -1) {
                    form = f;
                    break;
                }
        }

        // if there no op was defined use default assignment
        if (form == null) {
            form = forms[idx];
        }

        return form;
    }

    ensureClientSecurity(client: ProtocolClient) {
        // td-tools parser ensures this.security is an array
        if (this.security && this.securityDefinitions && Array.isArray(this.security) && this.security.length > 0) {
            console.log(`ConsumedThing '${this.title}' setting credentials for ${client}`);
            let scs: Array<TD.SecurityScheme> = [];
            for (let s of this.security) {
                let ws = this.securityDefinitions[s + ""]; // String vs. string (fix wot-typescript-definitions?)
                // also push nosec in case of proxy
                if (ws) {
                    scs.push(ws);
                }
            }
            client.setSecurity(scs, this.getServient().getCredentials(this.id));
        }
    }

    // utility for Property, Action, and Event
    getClientFor(forms: Array<TD.Form>, op: string, options?: WoT.InteractionOptions): ClientAndForm {
        if (forms.length === 0) {
            throw new Error(`ConsumedThing '${this.title}' has no links for this interaction`);
        }

        let form: TD.Form;
        let client: ProtocolClient;

        if (options && options.formIndex) {
            // pick provided formIndex (if possible)
            console.debug(`ConsumedThing '${this.title}' asked to use formIndex '${options.formIndex}'`);

            if (options.formIndex >= 0 && options.formIndex < forms.length) {
                form = forms[options.formIndex];
                let scheme = Helpers.extractScheme(form.href);

                if (this.getServient().hasClientFor(scheme)) {
                    console.log(`ConsumedThing '${this.title}' got client for '${scheme}'`);
                    client = this.getServient().getClientFor(scheme);

                    if (!this.getClients().get(scheme)) {
                        // new client
                        this.ensureClientSecurity(client);
                        this.getClients().set(scheme, client);
                    }
                } else {
                    throw new Error(`ConsumedThing '${this.title}' missing ClientFactory for '${scheme}'`);
                }
            } else {
                throw new Error(`ConsumedThing '${this.title}' missing formIndex '${options.formIndex}'`);
            }
        } else {
            let schemes = forms.map(link => Helpers.extractScheme(link.href))
            let cacheIdx = schemes.findIndex(scheme => this.getClients().has(scheme))

            if (cacheIdx !== -1) {
                // from cache
                console.debug(`ConsumedThing '${this.title}' chose cached client for '${schemes[cacheIdx]}'`);
                client = this.getClients().get(schemes[cacheIdx]);
                form = this.findForm(forms, op, schemes, cacheIdx);
            } else {
                // new client
                console.debug(`ConsumedThing '${this.title}' has no client in cache (${cacheIdx})`);
                let srvIdx = schemes.findIndex(scheme => this.getServient().hasClientFor(scheme));

                if (srvIdx === -1) throw new Error(`ConsumedThing '${this.title}' missing ClientFactory for '${schemes}'`);

                client = this.getServient().getClientFor(schemes[srvIdx]);
                console.log(`ConsumedThing '${this.title}' got new client for '${schemes[srvIdx]}'`);

                this.ensureClientSecurity(client);
                this.getClients().set(schemes[srvIdx], client);

                form = this.findForm(forms, op, schemes, srvIdx);
            }
        }
        return { client: client, form: form }
    }

    readProperty(propertyName: string, options?: WoT.InteractionOptions): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            // TODO pass expected form op to getClientFor()
            let tp: TD.ThingProperty = this.properties[propertyName];
            let { client, form } = this.getClientFor(tp.forms, "readproperty", options);
            console.log("form: " + form)
            if (!client) {
                reject(new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.title}' reading ${form.href}`);

                // uriVariables ?
                form = this.handleUriVariables(form, options);

                client.readResource(form).then((content) => {
                    if (!content.type) content.type = form.contentType;
                    try {
                        let value = ContentManager.contentToValue(content, <any>tp);
                        resolve(value);
                    } catch {
                        reject(new Error(`Received invalid content from Thing`));
                    }
                })
                    .catch(err => { reject(err); });
            }
        });
    }

    _readProperties(propertyNames: string[]): Promise<WoT.PropertyValueMap> {
        return new Promise<WoT.PropertyValueMap>((resolve, reject) => {
            // collect all single promises into array
            var promises: Promise<any>[] = [];
            for (let propertyName of propertyNames) {
                promises.push(this.readProperty(propertyName));
            }
            // wait for all promises to succeed and create response
            Promise.all(promises)
                .then((result) => {
                    let allProps: {
                        [key: string]: any;
                    } = {};
                    let index = 0;
                    for (let propertyName of propertyNames) {
                        allProps[propertyName] = result[index];
                        index++;
                    }
                    resolve(allProps);
                })
                .catch(err => {
                    reject(new Error(`ConsumedThing '${this.title}', failed to read properties: ` + propertyNames));
                });
        });
    }

    readAllProperties(options?: WoT.InteractionOptions): Promise<WoT.PropertyValueMap> {
        let propertyNames: string[] = [];
        for (let propertyName in this.properties) {
            propertyNames.push(propertyName);
        }
        return this._readProperties(propertyNames);
    }
    readMultipleProperties(propertyNames: string[], options?: WoT.InteractionOptions): Promise<WoT.PropertyValueMap> {
        return this._readProperties(propertyNames);
    }


    writeProperty(propertyName: string, value: any, options?: WoT.InteractionOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // TODO pass expected form op to getClientFor()
            let tp: TD.ThingProperty = this.properties[propertyName];
            let { client, form } = this.getClientFor(tp.forms, "writeproperty", options);
            if (!client) {
                reject(new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.title}' writing ${form.href} with '${value}'`);
                let content = ContentManager.valueToContent(value, <any>tp.input, form.contentType);

                // uriVariables ?
                form = this.handleUriVariables(form, options);

                client.writeResource(form, content).then(() => {
                    resolve();
                })
                    .catch(err => { reject(err); });
            }
        });
    }
    writeMultipleProperties(valueMap: WoT.PropertyValueMap, options?: WoT.InteractionOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // collect all single promises into array
            var promises: Promise<any>[] = [];
            for (let propertyName in valueMap) {
                let oValueMap: { [key: string]: any; } = valueMap;
                promises.push(this.writeProperty(propertyName, oValueMap[propertyName]));
            }
            // wait for all promises to succeed and create response
            Promise.all(promises)
                .then((result) => {
                    resolve();
                })
                .catch(err => {
                    reject(new Error(`ConsumedThing '${this.title}', failed to write multiple propertes: ` + valueMap));
                });
        });
    }


    public invokeAction(actionName: string, parameter?: any, options?: WoT.InteractionOptions): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let ta: TD.ThingAction = this.actions[actionName];
            let { client, form } = this.getClientFor(ta.forms, "invokeaction", options);
            if (!client) {
                reject(new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.title}' invoking ${form.href}${parameter !== undefined ? " with '" + parameter + "'" : ""}`);

                let input;

                if (parameter !== undefined) {
                    input = ContentManager.valueToContent(parameter, <any>ta, form.contentType);
                }

                // uriVariables ?
                form = this.handleUriVariables(form, options);

                client.invokeResource(form, input).then((content) => {
                    // infer media type from form if not in response metadata
                    if (!content.type) content.type = form.contentType;

                    // check if returned media type is the same as expected media type (from TD)
                    if (form.response) {
                        if (content.type !== form.response.contentType) {
                            reject(new Error(`Unexpected type in response`));
                        }
                    }

                    try {
                        let value = ContentManager.contentToValue(content, ta.output);
                        resolve(value);
                    } catch {
                        reject(new Error(`Received invalid content from Thing`));
                    }
                })
                    .catch(err => { 
                        console.log();
                        
                        reject(err); });
            }
        });
    }

    public observeProperty(name: string, listener: WoT.WotListener, options?: WoT.InteractionOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let tp: TD.ThingProperty = this.properties[name];
            let { client, form } = this.getClientFor(tp.forms, "observeproperty", options);
            if (!client) {
                reject(new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.title}' observing to ${form.href}`);

                // uriVariables ?
                form = this.handleUriVariables(form, options);

                return client.subscribeResource(form,
                    (content) => {
                        if (!content.type) content.type = form.contentType;
                        try {
                            let value = ContentManager.contentToValue(content, <any>tp);
                            listener(value);
                            resolve();
                        } catch {
                            reject(new Error(`Received invalid content from Thing`));
                        }
                    },
                    (err) => {
                        reject(err);
                    },
                    () => {
                        resolve();
                    }
                );
            }
        });
    }

    public unobserveProperty(name: string, options?: WoT.InteractionOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let tp: TD.ThingProperty = this.properties[name];
            let { client, form } = this.getClientFor(tp.forms, "unobserveproperty", options);
            if (!client) {
                reject(new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.title}' unobserveing to ${form.href}`);
                client.unlinkResource(form);
                resolve();
            }
        });
    }

    public subscribeEvent(name: string, listener: WoT.WotListener, options?: WoT.InteractionOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let te: TD.ThingEvent = this.events[name];
            let { client, form } = this.getClientFor(te.forms, "subscribeevent", options);
            if (!client) {
                reject(new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.title}' subscribing to ${form.href}`);
                
                // uriVariables ?
                form = this.handleUriVariables(form, options);

                return client.subscribeResource(form,
                    (content) => {
                        if (!content.type) content.type = form.contentType;
                        try {
                            let value = ContentManager.contentToValue(content, <any>te.data);
                            listener(value);
                            resolve();
                        } catch {
                            reject(new Error(`Received invalid content from Thing`));
                        }
                    },
                    (err) => {
                        reject(err);
                    },
                    () => {
                        resolve();
                    }
                );
            }
        });
    }

    public unsubscribeEvent(name: string, options?: WoT.InteractionOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let te: TD.ThingEvent = this.events[name];
            let { client, form } = this.getClientFor(te.forms, "unsubscribeevent", options);
            if (!client) {
                reject(new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.title}' unsubscribing to ${form.href}`);
                client.unlinkResource(form);
                resolve();
            }
        });
    }

    // creates new form (if needed) for URI Variables
    // http://192.168.178.24:8080/counter/actions/increment{?step} with options {uriVariables: {'step' : 3}} --> http://192.168.178.24:8080/counter/actions/increment?step=3
    // see RFC6570 (https://tools.ietf.org/html/rfc6570) for URI Template syntax
    handleUriVariables(form: TD.Form, options?: WoT.InteractionOptions): TD.Form {
        let ut = UriTemplate.parse(form.href);
        let updatedHref = ut.expand(options == undefined || options.uriVariables == undefined ? {} : options.uriVariables);
        if (updatedHref != form.href) {
            // "clone" form to avoid modifying original form
            let updForm = new TD.Form(updatedHref, form.contentType);
            updForm.op = form.op;
            updForm.security = form.security;
            updForm.scopes = form.scopes;
            updForm.response = form.response;

            form = updForm;
            console.log(`ConsumedThing '${this.title}' update form URI to ${form.href}`);
        }

        return form;
    }
}

export interface ClientAndForm {
    client: ProtocolClient
    form: TD.Form
}

class ConsumedThingProperty extends TD.ThingProperty implements TD.ThingProperty, TD.BaseSchema {

    // functions for wrapping internal state
    private getName: () => string;
    private getThing: () => ConsumedThing;

    constructor(name: string, thing: ConsumedThing) {
        super();

        // wrap internal state into functions to not be stringified in TD
        this.getName = () => { return name; }
        this.getThing = () => { return thing; }
    }
}

class ConsumedThingAction extends TD.ThingAction implements TD.ThingAction {

    // functions for wrapping internal state
    private getName: () => string;
    private getThing: () => ConsumedThing;

    constructor(name: string, thing: ConsumedThing) {
        super();

        // wrap internal state into functions to not be stringified in TD
        this.getName = () => { return name; }
        this.getThing = () => { return thing; }
    }
}

class ConsumedThingEvent extends TD.ThingEvent {

    // functions for wrapping internal state
    private getName: () => string;
    private getThing: () => ConsumedThing;

    constructor(name: string, thing: ConsumedThing) {
        super();

        // wrap internal state into functions to not be stringified in TD
        this.getName = () => { return name; }
        this.getThing = () => { return thing; }
    }
}
