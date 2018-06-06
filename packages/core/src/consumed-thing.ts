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

interface ClientAndForm {
    client: ProtocolClient
    form: TD.InteractionForm
}

export default class ConsumedThing extends TD.Thing implements WoT.ConsumedThing {

    protected readonly td: WoT.ThingDescription;
    protected readonly srv: Servient;
    private clients: Map<string, ProtocolClient> = new Map();
    protected observablesEvent: Map<string, Subject<any>> = new Map();
    protected observablesPropertyChange: Map<string, Subject<any>> = new Map();
    protected observablesTDChange: Subject<any> = new Subject<any>();

    constructor(servient: Servient, td: WoT.ThingDescription) {

        super();
        // asign containing Servient
        this.srv = servient;
        // cache original TD
        this.td = td;

        // apply TD to Thing with normalized URIs (base resolved)
        let tdObj = TD.parseTDString(td, true);

        this.context = tdObj.context;
        this.semanticType = tdObj.semanticType;
        this.name = tdObj.name;
        this.id = tdObj.id;
        if (Array.isArray(tdObj.security) && tdObj.security.length>=1) {
            this.security = tdObj.security;
        } else if (typeof tdObj.security === "object" ) {
            this.security = [tdObj.security];
        }
        this.metadata = tdObj.metadata;
        this.interaction = tdObj.interaction;
        this.link = tdObj.link;
    }

    /**
     * Returns the Thing Description of the Thing.
     */
    getThingDescription(): WoT.ThingDescription {
        // returning cached version
        return this.td;
    }

    // lazy singleton for ProtocolClient per scheme
    private getClientFor(forms: TD.InteractionForm[]): ClientAndForm {
        if (forms.length === 0) {
            throw new Error("ConsumedThing '${this.name}' has no links for this interaction");
        }

        let schemes = forms.map(link => Helpers.extractScheme(link.href))
        let cacheIdx = schemes.findIndex(scheme => this.clients.has(scheme))

        if (cacheIdx !== -1) {
            // from cache
            console.debug(`ConsumedThing '${this.name}' chose cached client for '${schemes[cacheIdx]}'`);
            let client = this.clients.get(schemes[cacheIdx]);
            let form = forms[cacheIdx];
            return { client: client, form: form };
        } else {
            // new client
            console.debug(`ConsumedThing '${this.name}' has no client in cache (${cacheIdx})`);
            let srvIdx = schemes.findIndex(scheme => this.srv.hasClientFor(scheme));
            if (srvIdx === -1) throw new Error(`ConsumedThing '${this.name}' missing ClientFactory for '${schemes}'`);
            let client = this.srv.getClientFor(schemes[srvIdx]);
            if (client) {
                console.log(`ConsumedThing '${this.name}' got new client for '${schemes[srvIdx]}'`);
                if (this.security) {
                    console.log("ConsumedThing applying security metadata");
                    //console.dir(this.security);
                    client.setSecurity(this.security, this.srv.getCredentials(this.id));
                }
                this.clients.set(schemes[srvIdx], client);
                let form = forms[srvIdx];
                return { client: client, form: form }
            } else {
                throw new Error(`ConsumedThing '${this.name}' could not get client for '${schemes[srvIdx]}'`);
            }
        }
    }

    private findInteraction(name: string, type: TD.InteractionPattern) {
        let res = this.interaction.filter((ia) => ia.pattern === type && ia.name === name)
        return (res.length > 0) ? res[0] : null;
    }

    /**
     * Read a given property
     * @param propertyName Name of the property
     */
    readProperty(propertyName: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let property = this.findInteraction(propertyName, TD.InteractionPattern.Property);
            if (!property) {
                reject(new Error(`ConsumedThing '${this.name}' cannot find Property '${propertyName}'`));
            } else {
                let { client, form } = this.getClientFor(property.form);
                if (!client) {
                    reject(new Error(`ConsumedThing '${this.name}' did not get suitable client for ${form.href}`));
                } else {
                    console.log(`ConsumedThing '${this.name}' reading ${form.href}`);
                    client.readResource(form).then((content) => {
                        if (!content.mediaType) content.mediaType = form.mediaType;
                        //console.log(`ConsumedThing decoding '${content.mediaType}' in readProperty`);
                        let value = ContentSerdes.contentToValue(content);
                        resolve(value);
                    })
                    .catch(err => { console.log("Failed to read because " + err); });
                }
            }
        });
    }

    /**
     * Write a given property
     * @param Name of the property
     * @param newValue value to be set
     */
    writeProperty(propertyName: string, newValue: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let property = this.findInteraction(propertyName, TD.InteractionPattern.Property);
            if (!property) {
                reject(new Error(`ConsumedThing '${this.name}' cannot find Property '${propertyName}'`));
            } else {
                let { client, form } = this.getClientFor(property.form);
                if (!client) {
                    reject(new Error(`ConsumedThing '${this.name}' did not get suitable client for ${form.href}`));
                } else {
                    console.log(`ConsumedThing '${this.name}' writing ${form.href} with '${newValue}'`);
                    let content = ContentSerdes.valueToContent(newValue, form.mediaType)
                    resolve(client.writeResource(form, content));

                    if (this.observablesPropertyChange.get(propertyName)) {
                        this.observablesPropertyChange.get(propertyName).next(newValue);
                    };
                }
            }
        });
    }

    onPropertyChange(name: string): Observable<any> {
        if (!this.observablesPropertyChange.get(name)) {
            console.log("Create propertyChange observable for " + name);
            this.observablesPropertyChange.set(name, new Subject());
        }

        return this.observablesPropertyChange.get(name).asObservable();
    }

    /** invokes an action on the target thing
     * @param actionName Name of the action to invoke
     * @param parameter optional json object to supply parameters
    */
    invokeAction(actionName: string, parameter?: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let action = this.findInteraction(actionName, TD.InteractionPattern.Action);
            if (!action) {
                reject(new Error(`ConsumedThing '${this.name}' cannot find Action '${actionName}'`));
            } else {
                let { client, form } = this.getClientFor(action.form);
                if (!client) {
                    reject(new Error(`ConsumedThing '${this.name}' did not get suitable client for ${form.href}`));
                } else {
                    console.log(`ConsumedThing '${this.name}' invoking ${form.href} with '${parameter}'`);

                    let mediaType = form.mediaType;
                    let input = ContentSerdes.valueToContent(parameter, form.mediaType);

                    client.invokeResource(form, input).then((output) => {
                        if (!output.mediaType) output.mediaType = form.mediaType;
                        //console.log(`ConsumedThing decoding '${output.mediaType}' in invokeAction`);
                        let value = ContentSerdes.contentToValue(output);
                        resolve(value);
                    });
                }
            }
        });
    }

    onEvent(name: string): Observable<any> {
        if (!this.observablesEvent.get(name)) {
            console.log("Create event observable for " + name);
            this.observablesEvent.set(name, new Subject());
        }

        return this.observablesEvent.get(name).asObservable();
    }

    onTDChange(): Observable<any> {
        return this.observablesTDChange.asObservable();
    }

}
