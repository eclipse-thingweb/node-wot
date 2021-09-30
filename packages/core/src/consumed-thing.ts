/********************************************************************************
 * Copyright (c) 2018 - 2021 Contributors to the Eclipse Foundation
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

import { ConsumedThing as IConsumedThing, InteractionInput } from "wot-typescript-definitions";
import * as TDT from "wot-thing-description-types";

import * as TD from "@node-wot/td-tools";

import Servient from "./servient";
import Helpers from "./helpers";

import { ProtocolClient } from "./protocol-interfaces";

import ContentManager from "./content-serdes";

import UriTemplate = require("uritemplate");
import { InteractionOutput } from "./interaction-output";
import { Subscription } from "rxjs/Subscription";

enum Affordance {
    PropertyAffordance,
    ActionAffordance,
    EventAffordance,
}

export interface ClientAndForm {
    client: ProtocolClient;
    form: TD.Form;
}
export default class ConsumedThing extends TD.Thing implements IConsumedThing {
    /** A map of interactable Thing Properties with read()/write()/subscribe() functions */
    properties: {
        [key: string]: TD.ThingProperty;
    };

    /** A map of interactable Thing Actions with invoke() function */
    actions: {
        [key: string]: TD.ThingAction;
    };

    /** A map of interactable Thing Events with subscribe() function */
    events: {
        [key: string]: TD.ThingEvent;
    };

    private getServient: () => Servient;
    private getClients: () => Map<string, ProtocolClient>;

    constructor(servient: Servient, thingModel: TD.ThingModel = {}) {
        super();

        this.getServient = () => {
            return servient;
        };
        this.getClients = new (class {
            clients: Map<string, ProtocolClient> = new Map<string, ProtocolClient>();
            getMap = () => {
                return this.clients;
            };
        })().getMap;

        // Deep clone the Thing Model
        // without functions or methods
        const clonedModel = JSON.parse(JSON.stringify(thingModel));
        Object.assign(this, clonedModel);
        this.extendInteractions();
    }

    getThingDescription(): WoT.ThingDescription {
        return JSON.parse(JSON.stringify(this));
    }

    public emitEvent(name: string, data: InteractionInput): void {
        console.warn("[core/consumed-thing]", "not implemented");
    }

    extendInteractions(): void {
        for (const propertyName in this.properties) {
            const newProp = Helpers.extend(
                this.properties[propertyName],
                new ConsumedThingProperty(propertyName, this)
            );
            this.properties[propertyName] = newProp;
        }
        for (const actionName in this.actions) {
            const newAction = Helpers.extend(this.actions[actionName], new ConsumedThingAction(actionName, this));
            this.actions[actionName] = newAction;
        }
        for (const eventName in this.events) {
            const newEvent = Helpers.extend(this.events[eventName], new ConsumedThingEvent(eventName, this));
            this.events[eventName] = newEvent;
        }
    }

    findForm(forms: Array<TD.Form>, op: string, affordance: Affordance, schemes: string[], idx: number): TD.Form {
        let form = null;

        // find right operation and corresponding scheme in the array form
        for (const f of forms) {
            let fop: string | Array<string> = "";
            if (f.op !== undefined) {
                fop = f.op;
            } else {
                // default "op" values
                // see https://w3c.github.io/wot-thing-description/#sec-default-values
                switch (affordance) {
                    case Affordance.PropertyAffordance:
                        fop = ["readproperty", "writeproperty"];
                        break;
                    case Affordance.ActionAffordance:
                        fop = "invokeaction";
                        break;
                    case Affordance.EventAffordance:
                        fop = "subscribeevent";
                        break;
                }
            }
            if (fop.indexOf(op) !== -1 && f.href.indexOf(schemes[idx] + ":") !== -1) {
                form = f;
                break;
            }
        }

        // Note: form can be null if no appropriate op can be found
        return form;
    }

    getSecuritySchemes(security: Array<string>): Array<TDT.SecurityScheme> {
        const scs: Array<TDT.SecurityScheme> = [];
        for (const s of security) {
            const ws = this.securityDefinitions[s + ""]; // String vs. string (fix wot-typescript-definitions?)
            // also push nosec in case of proxy
            if (ws) {
                scs.push(ws);
            }
        }
        return scs;
    }

    ensureClientSecurity(client: ProtocolClient, form: TD.Form): void {
        if (this.securityDefinitions) {
            if (form && Array.isArray(form.security) && form.security.length > 0) {
                // Note security member in form objects overrides (i.e., completely replace) all definitions activated at the Thing level
                // see https://www.w3.org/TR/wot-thing-description/#security-serialization-json
                console.debug(
                    "[core/consumed-thing]",
                    `ConsumedThing '${this.title}' setting credentials for ${client} based on form security`
                );
                client.setSecurity(
                    this.getSecuritySchemes(form.security),
                    this.getServient().retrieveCredentials(this.id)
                );
            } else if (this.security && Array.isArray(this.security) && this.security.length > 0) {
                console.debug(
                    "[core/consumed-thing]",
                    `ConsumedThing '${this.title}' setting credentials for ${client} based on thing security`
                );
                client.setSecurity(
                    this.getSecuritySchemes(this.security as string[]),
                    this.getServient().getCredentials(this.id)
                );
            }
        }
    }

    // utility for Property, Action, and Event
    getClientFor(
        forms: Array<TD.Form>,
        op: string,
        affordance: Affordance,
        options?: WoT.InteractionOptions
    ): ClientAndForm {
        if (forms.length === 0) {
            throw new Error(`ConsumedThing '${this.title}' has no links for this interaction`);
        }

        let form: TD.Form;
        let client: ProtocolClient;

        if (options && options.formIndex) {
            // pick provided formIndex (if possible)
            console.debug(
                "[core/consumed-thing]",
                `ConsumedThing '${this.title}' asked to use formIndex '${options.formIndex}'`
            );

            if (options.formIndex >= 0 && options.formIndex < forms.length) {
                form = forms[options.formIndex];
                const scheme = Helpers.extractScheme(form.href);

                if (this.getServient().hasClientFor(scheme)) {
                    console.debug("[core/consumed-thing]", `ConsumedThing '${this.title}' got client for '${scheme}'`);
                    client = this.getServient().getClientFor(scheme);

                    if (!this.getClients().get(scheme)) {
                        // new client
                        this.ensureClientSecurity(client, form);
                        this.getClients().set(scheme, client);
                    }
                } else {
                    throw new Error(`ConsumedThing '${this.title}' missing ClientFactory for '${scheme}'`);
                }
            } else {
                throw new Error(`ConsumedThing '${this.title}' missing formIndex '${options.formIndex}'`);
            }
        } else {
            const schemes = forms.map((link) => Helpers.extractScheme(link.href));
            const cacheIdx = schemes.findIndex((scheme) => this.getClients().has(scheme));

            if (cacheIdx !== -1) {
                // from cache
                console.debug(
                    "[core/consumed-thing]",
                    `ConsumedThing '${this.title}' chose cached client for '${schemes[cacheIdx]}'`
                );
                client = this.getClients().get(schemes[cacheIdx]);
                form = this.findForm(forms, op, affordance, schemes, cacheIdx);
            } else {
                // new client
                console.debug(
                    "[core/consumed-thing]",
                    `ConsumedThing '${this.title}' has no client in cache (${cacheIdx})`
                );
                const srvIdx = schemes.findIndex((scheme) => this.getServient().hasClientFor(scheme));

                if (srvIdx === -1)
                    throw new Error(`ConsumedThing '${this.title}' missing ClientFactory for '${schemes}'`);

                client = this.getServient().getClientFor(schemes[srvIdx]);
                console.debug(
                    "[core/consumed-thing]",
                    `ConsumedThing '${this.title}' got new client for '${schemes[srvIdx]}'`
                );

                this.ensureClientSecurity(client, form);
                this.getClients().set(schemes[srvIdx], client);

                form = this.findForm(forms, op, affordance, schemes, srvIdx);
            }
        }
        return { client: client, form: form };
    }

    readProperty(propertyName: string, options?: WoT.InteractionOptions): Promise<WoT.InteractionOutput> {
        return new Promise<WoT.InteractionOutput>((resolve, reject) => {
            // TODO pass expected form op to getClientFor()
            const tp: TD.ThingProperty = this.properties[propertyName];
            if (!tp) {
                reject(new Error(`ConsumedThing '${this.title}' does not have property ${propertyName}`));
            } else {
                let { client, form } = this.getClientFor(
                    tp.forms,
                    "readproperty",
                    Affordance.PropertyAffordance,
                    options
                );
                if (!client) {
                    reject(new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`));
                } else if (!form) {
                    reject(new Error(`ConsumedThing '${this.title}' did not get suitable form`));
                } else {
                    console.debug("[core/consumed-thing]", `ConsumedThing '${this.title}' reading ${form.href}`);

                    // uriVariables ?
                    form = this.handleUriVariables(form, options);

                    client
                        .readResource(form)
                        .then((content) => {
                            resolve(new InteractionOutput(content, form, tp));
                        })
                        .catch((err) => {
                            reject(err);
                        });
                }
            }
        });
    }

    _readProperties(propertyNames: string[]): Promise<WoT.PropertyReadMap> {
        return new Promise<WoT.PropertyReadMap>((resolve, reject) => {
            // collect all single promises into array
            const promises: Promise<WoT.InteractionOutput>[] = [];
            for (const propertyName of propertyNames) {
                promises.push(this.readProperty(propertyName));
            }
            // wait for all promises to succeed and create response
            const output = new Map<string, WoT.InteractionOutput>();
            Promise.all(promises)
                .then((result) => {
                    let index = 0;
                    for (const propertyName of propertyNames) {
                        output.set(propertyName, result[index]);
                        index++;
                    }
                    resolve(output);
                })
                .catch((err) => {
                    reject(
                        new Error(
                            `ConsumedThing '${this.title}', failed to read properties: ${propertyNames}.\n Error: ${err}`
                        )
                    );
                });
        });
    }

    readAllProperties(options?: WoT.InteractionOptions): Promise<WoT.PropertyReadMap> {
        const propertyNames: string[] = [];
        for (const propertyName in this.properties) {
            // collect attributes that are "readable" only
            const tp: TD.ThingProperty = this.properties[propertyName];
            const { form } = this.getClientFor(tp.forms, "readproperty", Affordance.PropertyAffordance, options);
            if (form) {
                propertyNames.push(propertyName);
            }
        }
        return this._readProperties(propertyNames);
    }

    readMultipleProperties(propertyNames: string[], options?: WoT.InteractionOptions): Promise<WoT.PropertyReadMap> {
        return this._readProperties(propertyNames);
    }

    writeProperty(propertyName: string, value: WoT.InteractionInput, options?: WoT.InteractionOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // TODO pass expected form op to getClientFor()
            const tp: TD.ThingProperty = this.properties[propertyName];
            if (!tp) {
                reject(new Error(`ConsumedThing '${this.title}' does not have property ${propertyName}`));
            } else {
                let { client, form } = this.getClientFor(
                    tp.forms,
                    "writeproperty",
                    Affordance.PropertyAffordance,
                    options
                );
                if (!client) {
                    reject(new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`));
                } else if (!form) {
                    reject(new Error(`ConsumedThing '${this.title}' did not get suitable form`));
                } else {
                    console.debug(
                        "[core/consumed-thing]",
                        `ConsumedThing '${this.title}' writing ${form.href} with '${value}'`
                    );

                    const content = ContentManager.valueToContent(value, tp, form.contentType);

                    // uriVariables ?
                    form = this.handleUriVariables(form, options);

                    client
                        .writeResource(form, content)
                        .then(() => {
                            resolve();
                        })
                        .catch((err) => {
                            reject(err);
                        });
                }
            }
        });
    }

    writeMultipleProperties(valueMap: WoT.PropertyWriteMap, options?: WoT.InteractionOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // collect all single promises into array
            const promises: Promise<void>[] = [];
            for (const propertyName in valueMap) {
                const value = valueMap.get(propertyName);
                promises.push(this.writeProperty(propertyName, value));
            }
            // wait for all promises to succeed and create response
            Promise.all(promises)
                .then((result) => {
                    resolve();
                })
                .catch((err) => {
                    reject(
                        new Error(
                            `ConsumedThing '${this.title}', failed to write multiple propertes: ${valueMap}\n Error: ${err}`
                        )
                    );
                });
        });
    }

    public invokeAction(
        actionName: string,
        parameter?: InteractionInput,
        options?: WoT.InteractionOptions
    ): Promise<WoT.InteractionOutput> {
        return new Promise<WoT.InteractionOutput>((resolve, reject) => {
            const ta: TD.ThingAction = this.actions[actionName];
            if (!ta) {
                reject(new Error(`ConsumedThing '${this.title}' does not have action ${actionName}`));
            } else {
                let { client, form } = this.getClientFor(
                    ta.forms,
                    "invokeaction",
                    Affordance.ActionAffordance,
                    options
                );
                if (!client) {
                    reject(new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`));
                } else if (!form) {
                    reject(new Error(`ConsumedThing '${this.title}' did not get suitable form`));
                } else {
                    console.debug(
                        "[core/consumed-thing]",
                        `ConsumedThing '${this.title}' invoking ${form.href}${
                            parameter !== undefined ? " with '" + parameter + "'" : ""
                        }`
                    );

                    let input;

                    if (parameter !== undefined) {
                        input = ContentManager.valueToContent(parameter, ta.input, form.contentType);
                    }

                    // uriVariables ?
                    form = this.handleUriVariables(form, options);

                    client
                        .invokeResource(form, input)
                        .then((content) => {
                            // infer media type from form if not in response metadata
                            if (!content.type) content.type = form.contentType;

                            // check if returned media type is the same as expected media type (from TD)
                            if (form.response) {
                                if (content.type !== form.response.contentType) {
                                    reject(new Error(`Unexpected type in response`));
                                }
                            }

                            try {
                                resolve(new InteractionOutput(content, form, ta.output));
                            } catch {
                                reject(new Error(`Received invalid content from Thing`));
                            }
                        })
                        .catch((err) => {
                            reject(err);
                        });
                }
            }
        });
    }

    public observeProperty(name: string, listener: WoT.WotListener, options?: WoT.InteractionOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const tp: TD.ThingProperty = this.properties[name];
            if (!tp) {
                reject(new Error(`ConsumedThing '${this.title}' does not have property ${name}`));
            } else {
                let { client, form } = this.getClientFor(
                    tp.forms,
                    "observeproperty",
                    Affordance.PropertyAffordance,
                    options
                );
                if (!client) {
                    reject(new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`));
                } else if (!form) {
                    reject(new Error(`ConsumedThing '${this.title}' did not get suitable form`));
                } else {
                    console.debug("[core/consumed-thing]", `ConsumedThing '${this.title}' observing to ${form.href}`);

                    // uriVariables ?
                    form = this.handleUriVariables(form, options);

                    return client.subscribeResource(
                        form,
                        (content) => {
                            if (!content.type) content.type = form.contentType;
                            try {
                                listener(new InteractionOutput(content, form, tp));
                                resolve();
                            } catch (e) {
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
            }
        });
    }

    public unobserveProperty(name: string, options?: WoT.InteractionOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const tp: TD.ThingProperty = this.properties[name];
            if (!tp) {
                reject(new Error(`ConsumedThing '${this.title}' does not have property ${name}`));
            } else {
                const { client, form } = this.getClientFor(
                    tp.forms,
                    "unobserveproperty",
                    Affordance.PropertyAffordance,
                    options
                );
                if (!client) {
                    reject(new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`));
                } else if (!form) {
                    reject(new Error(`ConsumedThing '${this.title}' did not get suitable form`));
                } else {
                    console.debug(
                        "[core/consumed-thing]",
                        `ConsumedThing '${this.title}' unobserveing to ${form.href}`
                    );
                    client.unlinkResource(form);
                    resolve();
                }
            }
        });
    }

    public subscribeEvent(name: string, listener: WoT.WotListener, options?: WoT.InteractionOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const te: TD.ThingEvent = this.events[name];
            if (!te) {
                reject(new Error(`ConsumedThing '${this.title}' does not have event ${name}`));
            } else {
                let { client, form } = this.getClientFor(
                    te.forms,
                    "subscribeevent",
                    Affordance.EventAffordance,
                    options
                );
                if (!client) {
                    reject(new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`));
                } else if (!form) {
                    reject(new Error(`ConsumedThing '${this.title}' did not get suitable form`));
                } else {
                    console.debug("[core/consumed-thing]", `ConsumedThing '${this.title}' subscribing to ${form.href}`);

                    // uriVariables ?
                    form = this.handleUriVariables(form, options);

                    return client
                        .subscribeResource(
                            form,
                            (content) => {
                                if (!content.type) content.type = form.contentType;
                                try {
                                    listener(new InteractionOutput(content, form, te.data));
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
                        )
                        .then((subscription: Subscription) => {
                            resolve();
                        });
                }
            }
        });
    }

    public unsubscribeEvent(name: string, options?: WoT.InteractionOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const te: TD.ThingEvent = this.events[name];
            if (!te) {
                reject(new Error(`ConsumedThing '${this.title}' does not have event ${name}`));
            } else {
                const { client, form } = this.getClientFor(
                    te.forms,
                    "unsubscribeevent",
                    Affordance.EventAffordance,
                    options
                );
                if (!client) {
                    reject(new Error(`ConsumedThing '${this.title}' did not get suitable client for ${form.href}`));
                } else if (!form) {
                    reject(new Error(`ConsumedThing '${this.title}' did not get suitable form`));
                } else {
                    console.debug(
                        "[core/consumed-thing]",
                        `ConsumedThing '${this.title}' unsubscribing to ${form.href}`
                    );
                    client.unlinkResource(form);
                    resolve();
                }
            }
        });
    }

    // creates new form (if needed) for URI Variables
    // http://192.168.178.24:8080/counter/actions/increment{?step} with options {uriVariables: {'step' : 3}} --> http://192.168.178.24:8080/counter/actions/increment?step=3
    // see RFC6570 (https://tools.ietf.org/html/rfc6570) for URI Template syntax
    handleUriVariables(form: TD.Form, options?: WoT.InteractionOptions): TD.Form {
        const ut = UriTemplate.parse(form.href);
        const updatedHref = ut.expand(
            options === undefined || options.uriVariables === undefined ? {} : options.uriVariables
        );
        if (updatedHref !== form.href) {
            // create shallow copy and update href
            const updForm = { ...form };
            updForm.href = updatedHref;
            form = updForm;
            console.debug("[core/consumed-thing]", `ConsumedThing '${this.title}' update form URI to ${form.href}`);
        }

        return form;
    }
}

class ConsumedThingProperty extends TD.ThingProperty implements TD.ThingProperty, TD.BaseSchema {
    // functions for wrapping internal state
    private getName: () => string;
    private getThing: () => ConsumedThing;

    constructor(name: string, thing: ConsumedThing) {
        super();

        // wrap internal state into functions to not be stringified in TD
        this.getName = () => {
            return name;
        };
        this.getThing = () => {
            return thing;
        };
    }
}

class ConsumedThingAction extends TD.ThingAction implements TD.ThingAction {
    // functions for wrapping internal state
    private getName: () => string;
    private getThing: () => ConsumedThing;

    constructor(name: string, thing: ConsumedThing) {
        super();

        // wrap internal state into functions to not be stringified in TD
        this.getName = () => {
            return name;
        };
        this.getThing = () => {
            return thing;
        };
    }
}

class ConsumedThingEvent extends TD.ThingEvent {
    // functions for wrapping internal state
    private getName: () => string;
    private getThing: () => ConsumedThing;

    constructor(name: string, thing: ConsumedThing) {
        super();

        // wrap internal state into functions to not be stringified in TD
        this.getName = () => {
            return name;
        };
        this.getThing = () => {
            return thing;
        };
    }
}
