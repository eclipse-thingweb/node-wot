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
import Helpers from "./helpers";

import { ProtocolClient, Content } from "./protocol-interfaces";

import { default as ContentManager } from "./content-serdes"

import { Subscribable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import { Form } from "@node-wot/td-tools";

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
    getClientFor(forms: Array<TD.Form>, op:string): ClientAndForm {
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
           
            // find right operation and corresponding scheme in the array form
            for(let f of forms) {
                if(f.op!=undefined)
                if(f.op.indexOf(op) !=-1 && f.href.indexOf(schemes[cacheIdx]+":")!=-1) {
                    form = f;
                    break;
                }
            }

            // if there no op was defined use default assignment
            if(form==null) {
                form = forms[cacheIdx];
            }

            return { client: client, form: form };
        } else {
            // new client
            console.debug(`ConsumedThing '${this.name}' has no client in cache (${cacheIdx})`);
            let srvIdx = schemes.findIndex(scheme => this.getServient().hasClientFor(scheme));
            
            if (srvIdx === -1) throw new Error(`ConsumedThing '${this.name}' missing ClientFactory for '${schemes}'`);
            
            let client = this.getServient().getClientFor(schemes[srvIdx]);
            console.log(`ConsumedThing '${this.name}' got new client for '${schemes[srvIdx]}'`);
            
            if (this.security && this.securityDefinitions && Array.isArray(this.security) && this.security.length>0) {
                console.log(`ConsumedThing '${this.name}' setting credentials for ${client}`);
                let scs : Array<WoT.Security>;
                for(let s of this.security) {
                    let ws = this.securityDefinitions[s + ""]; // String vs. string (fix wot-typescript-definitions?)
                    if(ws && ws.scheme !== "nosec") {
                        scs.push(ws);
                    }
                }
                client.setSecurity(scs, this.getServient().getCredentials(this.id));
            }
            this.getClients().set(schemes[srvIdx], client);
            //let form = forms[srvIdx];
            let form = null;

            // find right operation and corresponding scheme in the array form
            for(let f of forms) {
                if(f.op!=undefined)
                if(f.op.indexOf(op) !=-1 && f.href.indexOf(schemes[srvIdx]+":")!=-1) {
                    form = f;
                    break;
                }
            }

            // if there no op was defined use default assignment
            if(form==null) {
                form = forms[srvIdx];
            }

            return { client: client, form: form }
        }
    }

    // creates new form (if needed) for URI Variables
    // http://192.168.178.24:8080/counter/actions/increment{?step} with '{'step' : 3}' --> http://192.168.178.24:8080/counter/actions/increment?step=3
    handleUriVariables(form: WoT.Form, parameter: any): WoT.Form {
        let shref = form.href.trim();
        if (shref.endsWith("}")) {
            // "clone" form to avoid modifying original form
            let updForm = new Form(form.href, form.contentType);
            updForm.op = form.op;
            updForm.security = form.security;
            updForm.scopes = form.scopes;
            updForm.response = form.response;

            // TODO look more closely into RFC6570 syntax (https://tools.ietf.org/html/rfc6570)
            let uritemplateStart = shref.indexOf("{?");
            if (uritemplateStart > 0) {
                // uri{?x,y} --> uri
                // Note: update URI in any case given that variables might be optional
                updForm.href = shref.substring(0, uritemplateStart);

                if (parameter !== undefined && typeof parameter === 'object') {
                    let sparams = shref.substring(uritemplateStart + 2, shref.length - 1);
                    let params: string[] = sparams.split(",");
                    // check parameters
                    let uriAdds = "";
                    let firstParameter = true;
                    for (let p of params) {
                        if (parameter[p]) {
                            if (firstParameter) {
                                firstParameter = false;
                                uriAdds += "?" + p + "=" + parameter[p];
                            } else {
                                uriAdds += "&" + p + "=" + parameter[p];
                            }
                        }
                    }

                    updForm.href += uriAdds;
                }

                form = updForm;
                console.log(`ConsumedThing '${this.name}' update form URI to ${form.href}`);
            }
        }

        return form;
    }
}

export interface ClientAndForm {
    client: ProtocolClient
    form: WoT.Form
}

class ConsumedThingProperty extends TD.ThingProperty implements WoT.ThingProperty, WoT.BaseSchema {

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
            // TODO pass expected form op to getClientFor()
            let { client, form } = this.getThing().getClientFor(this.forms, "readproperty");
            if (!client) {
                reject(new Error(`ConsumedThing '${this.getThing().name}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.getThing().name}' reading ${form.href}`);
                                
                // uriVariables ?
                form = this.getThing().handleUriVariables(form, undefined);

                client.readResource(form).then((content) => {
                    if (!content.type) content.type = form.contentType;
                    try {
                        let value = ContentManager.contentToValue(content, <any>this);
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
            // TODO pass expected form op to getClientFor()
            let { client, form } = this.getThing().getClientFor(this.forms, "writeproperty");
            if (!client) {
                reject(new Error(`ConsumedThing '${this.getThing().name}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.getThing().name}' writing ${form.href} with '${value}'`);
                let content = ContentManager.valueToContent(value, <any>this, form.contentType);

                // uriVariables ?
                form = this.getThing().handleUriVariables(form, value);

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
        let { client, form } = this.getThing().getClientFor(this.forms, "observeproperty");
        if (!client) {
            error(new Error(`ConsumedThing '${this.getThing().name}' did not get suitable client for ${form.href}`));
        } else {
            console.log(`ConsumedThing '${this.getThing().name}' subscribing to ${form.href}`);

            return client.subscribeResource(form,
                (content) => {
                    if (!content.type) content.type = form.contentType;
                    try {
                        let value = ContentManager.contentToValue(content, <any>this);
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

class ConsumedThingAction extends TD.ThingAction implements WoT.ThingAction {

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
            let { client, form } = this.getThing().getClientFor(this.forms, "invokeaction");
            if (!client) {
                reject(new Error(`ConsumedThing '${this.getThing().name}' did not get suitable client for ${form.href}`));
            } else {
                console.log(`ConsumedThing '${this.getThing().name}' invoking ${form.href}${parameter!==undefined ? " with '"+parameter+"'" : ""}`);

                let input;
                if (parameter!== undefined) {
                    input = ContentManager.valueToContent(parameter, <any>this, form.contentType);
                }
				
                // uriVariables ?
                form = this.getThing().handleUriVariables(form, parameter);

                client.invokeResource(form, input).then((content) => {
                    // infer media type from form if not in response metadata
                    if (!content.type) content.type = form.contentType;

                    // check if returned media type is the same as expected media type (from TD)
                    if(form.response) {
                        if(content.type !== form.response.contentType) {
                            reject(new Error(`Unexpected type in response`));
                        }
                    }
                    
                    try {
                        let value = ContentManager.contentToValue(content, this.output);
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

class ConsumedThingEvent extends TD.ThingEvent implements Subscribable<any> {

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

        let { client, form } = this.getThing().getClientFor(this.forms, "subscribeevent");
        if (!client) {
            error(new Error(`ConsumedThing '${this.getThing().name}' did not get suitable client for ${form.href}`));
        } else {
            console.log(`ConsumedThing '${this.getThing().name}' subscribing to ${form.href}`);

            return client.subscribeResource(form,
                (content) => {
                    if (!content.type) content.type = form.contentType;
                    try {
                        let value = ContentManager.contentToValue(content, <any>this);
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
