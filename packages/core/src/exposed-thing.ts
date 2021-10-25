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

import * as WoT from "wot-typescript-definitions";

import { Subject } from "rxjs/Subject";

import * as TD from "@node-wot/td-tools";

import Servient from "./servient";
import Helpers from "./helpers";
import { InteractionOutput } from "./interaction-output";
import { Readable } from "stream";
import ProtocolHelpers from "./protocol-helpers";
import { ReadableStream as PolyfillStream } from "web-streams-polyfill/ponyfill/es2018";
import { Content, ContentSerdes, PropertyContentMap } from "./core";
import ContentManager from "./content-serdes";
import {
    ActionHandlerMap,
    ContentListener,
    EventHandlerMap,
    EventHandlers,
    ListenerMap,
    PropertyHandlerMap,
    PropertyHandlers,
} from "./protocol-interfaces";

export default class ExposedThing extends TD.Thing implements WoT.ExposedThing {
    security: Array<string>;
    securityDefinitions: { [key: string]: TD.SecurityType };

    id: string;
    title: string;
    base: string;
    forms: Array<TD.Form>;

    /** A map of interactable Thing Properties with read()/write()/subscribe() functions */
    properties: {
        [key: string]: TD.ThingProperty;
    };

    /** A map of interactable Thing Actions with invoke() function */
    actions: {
        [key: string]: TD.ThingAction;
    };

    /** A map of interactable Thing Events with emit() function */
    events: {
        [key: string]: TD.ThingEvent;
    };

    /** A map of property (read & write) handler callback functions */
    propertyHandlers: PropertyHandlerMap = new Map<string, PropertyHandlers>();

    /** A map of action handler callback functions */
    actionHandlers: ActionHandlerMap = new Map();

    /** A map of event handler callback functions */
    eventHandlers: EventHandlerMap = new Map<string, EventHandlers>();

    /** A map of property listener callback functions */
    propertyListeners: ListenerMap = new Map();

    /** A map of event listener callback functions */
    eventListeners: ListenerMap = new Map();

    private getServient: () => Servient;
    private getSubjectTD: () => Subject<WoT.ThingDescription>;

    constructor(servient: Servient, thingModel: WoT.ExposedThingInit = {}) {
        super();

        this.getServient = () => {
            return servient;
        };
        this.getSubjectTD = new (class {
            subjectTDChange: Subject<WoT.ThingDescription> = new Subject<WoT.ThingDescription>();
            getSubject = () => {
                return this.subjectTDChange;
            };
        })().getSubject;

        // Deep clone the Thing Model
        // without functions or methods
        const clonedModel = JSON.parse(JSON.stringify(thingModel));
        Object.assign(this, clonedModel);

        // unset "@type":"tm:ThingModel" ?
        // see https://github.com/eclipse/thingweb.node-wot/issues/426
        /* if (this["@type"]) {
            if (typeof this["@type"] === 'string' && this["@type"] === "tm:ThingModel") {
                delete this["@type"];
            } else if (Array.isArray(this["@type"])) {
                let arr: Array<any> = this["@type"];
                for (var i = 0; i < arr.length; i++) {
                    if (arr[i] === "tm:ThingModel") {
                        arr.splice(i, 1);
                        i--;
                    }
                }
            }
        } */
        // set default language
        this.addDefaultLanguage(this);
        // extend interactions
        this.extendInteractions();
    }

    // Note: copy from td-parser.ts
    addDefaultLanguage(thing: ExposedThing): void {
        // add @language : "en" if no @language set
        if (Array.isArray(thing["@context"])) {
            const arrayContext = thing["@context"];
            let languageSet = false;
            for (const arrayEntry of arrayContext) {
                if (typeof arrayEntry === "object") {
                    if (arrayEntry["@language"] !== undefined) {
                        languageSet = true;
                    }
                }
            }
            if (!languageSet) {
                arrayContext.push({
                    "@language": TD.DEFAULT_CONTEXT_LANGUAGE,
                });
            }
        }
    }

    extendInteractions(): void {
        for (const propertyName in this.properties) {
            const newProp = Helpers.extend(this.properties[propertyName], new ExposedThingProperty(propertyName, this));
            this.properties[propertyName] = newProp;
        }
        for (const actionName in this.actions) {
            const newAction = Helpers.extend(this.actions[actionName], new ExposedThingAction(actionName, this));
            this.actions[actionName] = newAction;
        }
        for (const eventName in this.events) {
            const newEvent = Helpers.extend(this.events[eventName], new ExposedThingEvent(eventName, this));
            this.events[eventName] = newEvent;
        }
    }

    public getThingDescription(): WoT.ThingDescription {
        return JSON.parse(TD.serializeTD(this));
    }

    public emitEvent(name: string, data: WoT.InteractionInput): void {
        if (this.events[name]) {
            const es: EventState = this.events[name].getState();
            // TODO: remove after the new api
            for (const listener of es.legacyListeners) {
                listener.call(this, data);
            }

            es.emit(data);
        } else {
            // NotFoundError
            throw new Error("NotFoundError for event '" + name + "'");
        }
    }

    // TODO: Missing https://w3c.github.io/wot-scripting-api/#the-emitpropertychange-method

    /** @inheritDoc */
    expose(): Promise<void> {
        console.debug("[core/exposed-thing]", `ExposedThing '${this.title}' exposing all Interactions and TD`);

        return new Promise<void>((resolve, reject) => {
            // let servient forward exposure to the servers
            this.getServient()
                .expose(this)
                .then(() => {
                    // inform TD observers
                    this.getSubjectTD().next(this.getThingDescription());
                    resolve();
                })
                .catch((err) => reject(err));
        });
    }

    /** @inheritDoc */
    destroy(): Promise<void> {
        console.debug("[core/exposed-thing]", `ExposedThing '${this.title}' destroying the thing and its interactions`);

        return new Promise<void>((resolve, reject) => {
            this.getServient()
                .destroyThing(this.id)
                .then(() => {
                    // indicate to possible subscriptions that subject has been completed
                    /* for (let propertyName in this.properties) {
                    let ps: PropertyState = this.properties[propertyName].getState();
                    if (ps.subject) {
                        ps.subject.complete();
                    }
                }
                for (let eventName in this.events) {
                    let es: EventState = this.events[eventName].getState();
                    if (es.subject) {
                        es.subject.complete();
                    }
                } */
                    // inform TD observers that thing is gone
                    this.getSubjectTD().next(null);
                    // resolve with success
                    resolve();
                })
                .catch((err) => reject(err));
        });
    }

    /** @inheritDoc */
    setPropertyReadHandler(propertyName: string, handler: WoT.PropertyReadHandler): WoT.ExposedThing {
        console.debug(
            "[core/exposed-thing]",
            `ExposedThing '${this.title}' setting read handler for '${propertyName}'`
        );

        if (this.properties[propertyName]) {
            // setting read handler for writeOnly not allowed
            if (this.properties[propertyName].writeOnly) {
                throw new Error(
                    `ExposedThing '${this.title}' cannot set read handler for property '${propertyName}' due to writeOnly flag`
                );
            } else {
                let propertyHandler;
                if (this.propertyHandlers.has(propertyName)) {
                    propertyHandler = this.propertyHandlers.get(propertyName);
                    propertyHandler.readHandler = handler;
                } else {
                    propertyHandler = { readHandler: handler };
                }

                this.propertyHandlers.set(propertyName, propertyHandler);
            }
        } else {
            throw new Error(`ExposedThing '${this.title}' has no Property '${propertyName}'`);
        }
        return this;
    }

    /** @inheritDoc */
    setPropertyWriteHandler(propertyName: string, handler: WoT.PropertyWriteHandler): WoT.ExposedThing {
        console.debug(
            "[core/exposed-thing]",
            `ExposedThing '${this.title}' setting write handler for '${propertyName}'`
        );
        if (this.properties[propertyName]) {
            // setting write handler for readOnly not allowed
            if (this.properties[propertyName].readOnly) {
                throw new Error(
                    `ExposedThing '${this.title}' cannot set write handler for property '${propertyName}' due to readOnly flag`
                );
            } else {
                let propertyHandler;
                if (this.propertyHandlers.has(propertyName)) {
                    propertyHandler = this.propertyHandlers.get(propertyName);
                    propertyHandler.writeHandler = handler;
                } else {
                    propertyHandler = { writeHandler: handler };
                }

                this.propertyHandlers.set(propertyName, propertyHandler);
            }
        } else {
            throw new Error(`ExposedThing '${this.title}' has no Property '${propertyName}'`);
        }
        return this;
    }

    /** @inheritDoc */
    setPropertyObserveHandler(name: string, handler: WoT.PropertyReadHandler): WoT.ExposedThing {
        console.debug(
            "[core/exposed-thing]",
            `ExposedThing '${this.title}' setting property observe handler for '${name}'`
        );

        if (this.properties[name]) {
            let propertyHandler;
            if (this.propertyHandlers.has(name)) {
                propertyHandler = this.propertyHandlers.get(name);
                propertyHandler.observeHandler = handler;
            } else {
                propertyHandler = { observeHandler: handler };
            }

            this.propertyHandlers.set(name, propertyHandler);
        } else {
            throw new Error(`ExposedThing '${this.title}' has no Property '${name}'`);
        }
        return this;
    }

    /** @inheritDoc */
    setPropertyUnobserveHandler(name: string, handler: WoT.PropertyReadHandler): WoT.ExposedThing {
        console.debug(
            "[core/exposed-thing]",
            `ExposedThing '${this.title}' setting property unobserve handler for '${name}'`
        );

        if (this.properties[name]) {
            let propertyHandler;
            if (this.propertyHandlers.has(name)) {
                propertyHandler = this.propertyHandlers.get(name);
                propertyHandler.unobserveHandler = handler;
            } else {
                propertyHandler = { unobserveHandler: handler };
            }

            this.propertyHandlers.set(name, propertyHandler);
        } else {
            throw new Error(`ExposedThing '${this.title}' has no Property '${name}'`);
        }
        return this;
    }

    /** @inheritDoc */
    setActionHandler(actionName: string, handler: WoT.ActionHandler): WoT.ExposedThing {
        console.debug(
            "[core/exposed-thing]",
            `ExposedThing '${this.title}' setting action handler for '${actionName}'`
        );

        if (this.actions[actionName]) {
            this.actionHandlers.set(actionName, handler);
        } else {
            throw new Error(`ExposedThing '${this.title}' has no Action '${actionName}'`);
        }
        return this;
    }

    /** @inheritDoc */
    setEventSubscribeHandler(name: string, handler: WoT.EventSubscriptionHandler): WoT.ExposedThing {
        console.debug(
            "[core/exposed-thing]",
            `ExposedThing '${this.title}' setting event subscribe handler for '${name}'`
        );

        if (this.events[name]) {
            let eventHandler;
            if (this.eventHandlers.has(name)) {
                eventHandler = this.eventHandlers.get(name);
                eventHandler.subscribe = handler;
            } else {
                eventHandler = { subscribe: handler };
            }

            this.eventHandlers.set(name, eventHandler);
        } else {
            throw new Error(`ExposedThing '${this.title}' has no Event '${name}'`);
        }
        return this;
    }

    /** @inheritDoc */
    setEventUnsubscribeHandler(name: string, handler: WoT.EventSubscriptionHandler): WoT.ExposedThing {
        console.debug(
            "[core/exposed-thing]",
            `ExposedThing '${this.title}' setting event unsubscribe handler for '${name}'`
        );

        if (this.events[name]) {
            let eventHandler;
            if (this.eventHandlers.has(name)) {
                eventHandler = this.eventHandlers.get(name);
                eventHandler.unsubscribe = handler;
            } else {
                eventHandler = { unsubscribe: handler };
            }

            this.eventHandlers.set(name, eventHandler);
        } else {
            throw new Error(`ExposedThing '${this.title}' has no Event '${name}'`);
        }
        return this;
    }

    /** @inheritDoc */
    setEventHandler(name: string, handler: WoT.EventListenerHandler): WoT.ExposedThing {
        console.debug("[core/exposed-thing]", `ExposedThing '${this.title}' setting event handler for '${name}'`);

        if (this.events[name]) {
            let eventHandler;
            if (this.eventHandlers.has(name)) {
                eventHandler = this.eventHandlers.get(name);
                eventHandler.handler = handler;
            } else {
                eventHandler = { handler: handler };
            }

            this.eventHandlers.set(name, eventHandler);
        } else {
            throw new Error(`ExposedThing '${this.title}' has no Event '${name}'`);
        }
        return this;
    }

    /**
     * @deprecated
     */
    readProperty(propertyName: string, options?: WoT.InteractionOptions): Promise<InteractionOutput> {
        return new Promise((resolve, reject) => {
            if (this.properties[propertyName]) {
                // writeOnly check skipped so far, see https://github.com/eclipse/thingweb.node-wot/issues/333#issuecomment-724583234
                /* if(this.properties[propertyName].writeOnly && this.properties[propertyName].writeOnly === true) {
                    reject(new Error(`ExposedThing '${this.title}', property '${propertyName}' is writeOnly`));
                } */

                const ps: PropertyState = this.properties[propertyName].getState();
                // call read handler (if any)
                if (ps.readHandler != null) {
                    console.debug(
                        "[core/exposed-thing]",
                        `ExposedThing '${this.title}' calls registered readHandler for Property '${propertyName}'`
                    );
                    ps.readHandler(options)
                        .then((customValue) => {
                            const body = ExposedThing.interactionInputToReadable(customValue);
                            const c: Content = { body: body, type: "application/json" };
                            resolve(new InteractionOutput(c, undefined, this.properties[propertyName]));
                        })
                        .catch((err) => {
                            reject(err);
                        });
                } else {
                    console.debug(
                        "[core/exposed-thing]",
                        `ExposedThing '${this.title}' gets internal value '${ps.value}' for Property '${propertyName}'`
                    );
                    const body = ExposedThing.interactionInputToReadable(ps.value);
                    resolve(
                        new InteractionOutput(
                            { body, type: "application/json" },
                            undefined,
                            this.properties[propertyName]
                        )
                    );
                }
            } else {
                reject(new Error(`ExposedThing '${this.title}', no property found for '${propertyName}'`));
            }
        });
    }

    /**
     * @deprecated
     */
    _readProperties(propertyNames: string[], options?: WoT.InteractionOptions): Promise<WoT.PropertyReadMap> {
        return new Promise<WoT.PropertyReadMap>((resolve, reject) => {
            // collect all single promises into array
            const promises: Promise<InteractionOutput>[] = [];
            for (const propertyName of propertyNames) {
                promises.push(this.readProperty(propertyName, options));
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

    /**
     * @deprecated
     */
    readAllProperties(options?: WoT.InteractionOptions): Promise<WoT.PropertyReadMap> {
        const propertyNames: string[] = [];
        for (const propertyName in this.properties) {
            propertyNames.push(propertyName);
        }
        return this._readProperties(propertyNames, options);
    }

    /**
     * @deprecated
     */
    readMultipleProperties(propertyNames: string[], options?: WoT.InteractionOptions): Promise<WoT.PropertyReadMap> {
        return this._readProperties(propertyNames, options);
    }

    /**
     * @deprecated
     */
    writeProperty(propertyName: string, value: WoT.InteractionInput, options?: WoT.InteractionOptions): Promise<void> {
        // TODO: to be removed next api does not allow an ExposedThing to be also a ConsumeThing
        return new Promise<void>((resolve, reject) => {
            if (this.properties[propertyName]) {
                // readOnly check skipped so far, see https://github.com/eclipse/thingweb.node-wot/issues/333#issuecomment-724583234
                /* if (this.properties[propertyName].readOnly && this.properties[propertyName].readOnly === true) {
                    reject(new Error(`ExposedThing '${this.title}', property '${propertyName}' is readOnly`));
                } */

                const ps: PropertyState = this.properties[propertyName].getState();

                // call write handler (if any)
                if (ps.writeHandler != null) {
                    const body = ExposedThing.interactionInputToReadable(value);
                    const content = { body: body, type: "application/json" };
                    // be generous when no promise is returned
                    const promiseOrValueOrNil = ps.writeHandler(
                        new InteractionOutput(content, {}, this.properties[propertyName]),
                        options
                    );
                    if (promiseOrValueOrNil !== undefined) {
                        if (typeof promiseOrValueOrNil.then === "function") {
                            promiseOrValueOrNil
                                .then((customValue) => {
                                    console.debug(
                                        "[core/exposed-thing]",
                                        `ExposedThing '${this.title}' write handler for Property '${propertyName}' sets custom value '${customValue}'`
                                    );
                                    // notify state change
                                    // FIXME object comparison
                                    if (ps.value !== value) {
                                        for (const listener of ps.listeners) {
                                            listener.call(value);
                                        }
                                    }
                                    resolve();
                                })
                                .catch((customError) => {
                                    console.warn(
                                        "[core/exposed-thing]",
                                        `ExposedThing '${this.title}' write handler for Property '${propertyName}' rejected the write with error '${customError}'`
                                    );
                                    reject(customError);
                                });
                        } else {
                            console.warn(
                                "[core/exposed-thing]",
                                `ExposedThing '${this.title}' write handler for Property '${propertyName}' does not return promise`
                            );
                            if (ps.value !== promiseOrValueOrNil) {
                                for (const listener of ps.listeners) {
                                    listener.call(promiseOrValueOrNil);
                                }
                            }
                            resolve();
                        }
                    } else {
                        console.warn(
                            "[core/exposed-thing]",
                            `ExposedThing '${this.title}' write handler for Property '${propertyName}' does not return custom value, using direct value '${value}'`
                        );
                        if (ps.value !== value) {
                            for (const listener of ps.listeners) {
                                listener.call(value);
                            }
                        }
                        resolve();
                    }
                } else {
                    console.debug(
                        "[core/exposed-thing]",
                        `ExposedThing '${this.title}' directly sets Property '${propertyName}' to value '${value}'`
                    );
                    /** notify state change */
                    if (ps.value !== value) {
                        for (const listener of ps.listeners) {
                            listener.call(value);
                        }
                    }
                    resolve();
                }
            } else {
                reject(new Error(`ExposedThing '${this.title}', no property found for '${propertyName}'`));
            }
        });
    }

    /**
     * @deprecated
     */
    writeMultipleProperties(valueMap: WoT.PropertyWriteMap, options?: WoT.InteractionOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // collect all single promises into array
            const promises: Promise<void>[] = [];
            for (const propertyName in valueMap) {
                promises.push(this.writeProperty(propertyName, valueMap.get(propertyName), options));
            }
            // wait for all promises to succeed and create response
            Promise.all(promises)
                .then((result) => {
                    resolve();
                })
                .catch((err) => {
                    reject(
                        new Error(`ExposedThing '${this.title}', failed to write multiple properties. ${err.message}`)
                    );
                });
        });
    }

    /**
     * @deprecated
     */
    public async invokeAction(
        actionName: string,
        parameter?: WoT.InteractionInput,
        options?: WoT.InteractionOptions
    ): Promise<InteractionOutput> {
        if (this.actions[actionName]) {
            console.debug("[core/exposed-thing]", `ExposedThing '${this.title}' has Action state of '${actionName}'`);

            const as: ActionState = this.actions[actionName].getState();
            if (as.handler != null) {
                console.debug(
                    "[core/exposed-thing]",
                    `ExposedThing '${this.title}' calls registered handler for Action '${actionName}'`
                );
                let bodyInput;
                if (parameter) {
                    bodyInput = ExposedThing.interactionInputToReadable(parameter);
                }

                const cInput: Content = { body: bodyInput, type: "application/json" };
                const result = await as.handler(
                    new InteractionOutput(cInput, undefined, this.actions[actionName].input),
                    options
                );

                let bodyOutput;
                if (result) {
                    bodyOutput = ExposedThing.interactionInputToReadable(result);
                }
                const cOutput: Content = { body: bodyOutput, type: "application/json" };
                return new InteractionOutput(cOutput, undefined, this.actions[actionName].output);
            } else {
                throw new Error(`ExposedThing '${this.title}' has no handler for Action '${actionName}'`);
            }
        } else {
            throw new Error(`ExposedThing '${this.title}', no action found for '${actionName}'`);
        }
    }

    /**
     * @deprecated
     */
    public observeProperty(name: string, listener: WoT.WotListener, options?: WoT.InteractionOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.properties[name]) {
                const ps: PropertyState = this.properties[name].getState();
                // let next = listener;
                // let error = null;
                // let complete = null;
                // let sub: Subject<Content> = this.properties[name].getState().subject;
                // sub.asObservable().subscribe(next, error, complete);
                ps.listeners.push(listener);
                console.debug("[core/exposed-thing]", `ExposedThing '${this.title}' subscribes to property '${name}'`);
            } else {
                reject(new Error(`ExposedThing '${this.title}', no property found for '${name}'`));
            }
        });
    }

    /**
     * @deprecated
     */
    public unobserveProperty(name: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.properties[name]) {
                // let sub: Subject<Content> = this.properties[name].getState().subject;
                // sub.unsubscribe();  // XXX causes loop issue (see browser counter example)
                console.debug(
                    "[core/exposed-thing]",
                    `ExposedThing '${this.title}' unsubscribes from property '${name}'`
                );
            } else {
                reject(new Error(`ExposedThing '${this.title}', no property found for '${name}'`));
            }
        });
    }

    /**
     * @deprecated
     */
    public subscribeEvent(name: string, listener: WoT.WotListener, options?: WoT.InteractionOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.events[name]) {
                const es: EventState = this.events[name].getState();
                // let next = listener;
                // let error = null;
                // let complete = null;
                // let sub: Subject<any> = this.events[name].getState().subject;
                // sub.asObservable().subscribe(next, error, complete);
                es.legacyListeners.push(listener);
                // es.subject.asObservable().subscribe(listener, null, null);
                console.debug("[core/exposed-thing]", `ExposedThing '${this.title}' subscribes to event '${name}'`);
            } else {
                reject(new Error(`ExposedThing '${this.title}', no event found for '${name}'`));
            }
        });
    }

    /**
     * @deprecated
     */
    public unsubscribeEvent(name: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.events[name]) {
                // let sub: Subject<any> = this.events[name].getState().subject;
                // sub.unsubscribe(); // XXX causes loop issue (see browser counter example)
                console.debug("[core/exposed-thing]", `ExposedThing '${this.title}' unsubscribes from event '${name}'`);
            } else {
                reject(new Error(`ExposedThing '${this.title}', no event found for '${name}'`));
            }
        });
    }

    /**
     * Handle the request of an action invocation form the protocol binding level
     * @experimental
     */
    public async handleInvokeAction(
        name: string,
        inputContent: Content,
        form?: TD.Form,
        options?: WoT.InteractionOptions
    ): Promise<Content | void> {
        // TODO: handling URI variables?
        if (this.actions[name]) {
            console.debug("[core/exposed-thing]", `ExposedThing '${this.title}' has Action state of '${name}'`);

            const handler = this.actionHandlers.get(name);
            if (handler != null) {
                console.debug(
                    "[core/exposed-thing]",
                    `ExposedThing '${this.title}' calls registered handler for Action '${name}'`
                );

                const result: WoT.InteractionInput | void = await handler(
                    new InteractionOutput(inputContent, form, this.actions[name].input),
                    options
                );
                if (result) {
                    // TODO: handle form.response.contentType
                    return ContentManager.valueToContent(result, this.actions[name].output, form?.contentType);
                }
            } else {
                throw new Error(`ExposedThing '${this.title}' has no handler for Action '${name}'`);
            }
        } else {
            throw new Error(`ExposedThing '${this.title}', no action found for '${name}'`);
        }
    }

    /**
     * Handle the request of a property read operation from the protocol binding level
     * @experimental
     */
    public async handleReadProperty(
        propertyName: string,
        form: TD.Form,
        options?: WoT.InteractionOptions
    ): Promise<Content> {
        if (this.properties[propertyName]) {
            console.debug("[core/exposed-thing]", `ExposedThing '${this.title}' has Action state of '${propertyName}'`);

            const readHandler = this.propertyHandlers.get(propertyName)?.readHandler;

            if (readHandler != null) {
                console.debug(
                    "[core/exposed-thing]",
                    `ExposedThing '${this.title}' calls registered readHandler for Property '${propertyName}'`
                );
                const result: WoT.InteractionInput | void = await readHandler(options);
                return ContentManager.valueToContent(
                    result,
                    this.properties[propertyName],
                    form.contentType ?? "application/json"
                );
            } else {
                throw new Error(`ExposedThing '${this.title}' has no readHandler for Property '${propertyName}'`);
            }
        } else {
            throw new Error(`ExposedThing '${this.title}', no property found for '${propertyName}'`);
        }
    }

    /**
     * Handle the request of a read operation for multiple properties from the protocol binding level
     * @experimental
     */
    public async _handleReadProperties(
        propertyNames: string[],
        options?: WoT.InteractionOptions
    ): Promise<PropertyContentMap> {
        // collect all single promises into array
        const promises: Promise<Content>[] = [];
        for (const propertyName of propertyNames) {
            // Note: currently only DataSchema properties are supported
            const form = this.properties[propertyName].forms.find(
                (form) => form.contentType === "application/json" || !form.contentType
            );
            if (!form) {
                continue;
            }

            promises.push(this.handleReadProperty(propertyName, form, options));
        }
        try {
            // wait for all promises to succeed and create response
            const output = new Map<string, Content>();
            const results = await Promise.all(promises);

            for (let i = 0; i < results.length; i++) {
                output.set(propertyNames[i], results[i]);
            }
            return output;
        } catch (error) {
            throw new Error(
                `ConsumedThing '${this.title}', failed to read properties: ${propertyNames}.\n Error: ${error}`
            );
        }
    }

    /**
     * @experimental
     */
    public async handleReadAllProperties(options?: WoT.InteractionOptions): Promise<PropertyContentMap> {
        const propertyNames: string[] = [];
        for (const propertyName in this.properties) {
            propertyNames.push(propertyName);
        }
        return await this._handleReadProperties(propertyNames, options);
    }

    /**
     * @experimental
     */
    public async handleReadMultipleProperties(
        propertyNames: string[],
        options?: WoT.InteractionOptions
    ): Promise<PropertyContentMap> {
        return await this._handleReadProperties(propertyNames, options);
    }

    /**
     * Handle the request of an property write operation to the protocol binding level
     * @experimental
     */
    public async handleWriteProperty(
        propertyName: string,
        inputContent: Content,
        form: TD.Form,
        options?: WoT.InteractionOptions
    ): Promise<void> {
        // TODO: to be removed next api does not allow an ExposedThing to be also a ConsumeThing
        if (this.properties[propertyName]) {
            if (this.properties[propertyName].readOnly && this.properties[propertyName].readOnly === true) {
                throw new Error(`ExposedThing '${this.title}', property '${propertyName}' is readOnly`);
            }

            const writeHandler = this.propertyHandlers.get(propertyName)?.writeHandler;

            // call write handler (if any)
            if (writeHandler != null) {
                await writeHandler(new InteractionOutput(inputContent, form, this.properties[propertyName]), options);
            } else {
                throw new Error(`ExposedThing '${this.title}' has no writeHandler for Property '${propertyName}'`);
            }
        } else {
            throw new Error(`ExposedThing '${this.title}', no property found for '${propertyName}'`);
        }
    }

    /**
     *
     * @experimental
     */
    public async handleWriteMultipleProperties(
        valueMap: PropertyContentMap,
        options?: WoT.InteractionOptions
    ): Promise<void> {
        // collect all single promises into array
        const promises: Promise<void>[] = [];
        for (const propertyName in valueMap) {
            // Note: currently only DataSchema properties are supported
            const form = this.properties[propertyName].forms.find(
                (form) => form.contentType === "application/json" || !form.contentType
            );
            if (!form) {
                continue;
            }
            promises.push(this.handleWriteProperty(propertyName, valueMap.get(propertyName), form, options));
        }
        try {
            await Promise.all(promises);
        } catch (error) {
            throw new Error(`ExposedThing '${this.title}', failed to write multiple properties. ${error.message}`);
        }
    }

    /**
     *
     * @experimental
     */
    public async handleSubscribeEvent(
        name: string,
        listener: ContentListener,
        options?: WoT.InteractionOptions
    ): Promise<void> {
        if (this.events[name]) {
            const eventListener = this.eventListeners.get(name) ?? {};
            const formIndex = ProtocolHelpers.getFormIndexForOperation(
                this.events[name].forms,
                "subscribeevent",
                options?.formIndex
            );
            if (formIndex !== -1) {
                if (!eventListener[formIndex]) eventListener[formIndex] = [];
                eventListener[formIndex].push(listener);
                this.eventListeners.set(name, eventListener);
                console.debug("[core/exposed-thing]", `ExposedThing '${this.title}' subscribes to event '${name}'`);
            } else {
                throw new Error(
                    `ExposedThing '${this.title}', no property listener from found for '${name}' with form index '${options.formIndex}'`
                );
            }
            const subscribe = this.eventHandlers.get(name)?.subscribe;
            if (subscribe) {
                subscribe(options);
            }
            console.debug("[core/exposed-thing]", `ExposedThing '${this.title}' subscribes to event '${name}'`);
        } else {
            throw new Error(`ExposedThing '${this.title}', no event found for '${name}'`);
        }
    }

    /**
     *
     * @experimental
     */
    public handleUnsubscribeEvent(name: string, listener: ContentListener, options: WoT.InteractionOptions): void {
        if (this.events[name]) {
            const eventListener = this.eventListeners.get(name) ?? {};
            const formIndex = ProtocolHelpers.getFormIndexForOperation(
                this.forms,
                "unsubscribeevent",
                options?.formIndex
            );
            if (formIndex !== -1 && eventListener[formIndex] && eventListener[formIndex].indexOf(listener) !== -1) {
                eventListener[options.formIndex].splice(eventListener[options.formIndex].indexOf(listener), 1);
                this.eventListeners.set(name, eventListener);
            } else {
                throw new Error(
                    `ExposedThing '${this.title}', no event listener from found for '${name}' with form index '${options.formIndex}'`
                );
            }
            const unsubscribe = this.eventHandlers.get(name)?.unsubscribe;
            if (unsubscribe) {
                unsubscribe(options);
            }
            console.debug("[core/exposed-thing]", `ExposedThing '${this.title}' unsubscribes from event '${name}'`);
        } else {
            throw new Error(`ExposedThing '${this.title}', no event found for '${name}'`);
        }
    }

    /**
     *
     * @experimental
     */
    public handleEmitEvent(name: string, data: WoT.InteractionInput, options?: WoT.InteractionOptions): void {
        if (this.events[name]) {
            const eventListener = this.eventListeners.get(name) ?? {};
            const formIndex = ProtocolHelpers.getFormIndexForOperation(
                this.events[name].forms,
                "subscribeevent",
                options?.formIndex
            );
            if (formIndex !== -1 && eventListener[formIndex]) {
                const form = this.events[name].forms[formIndex];
                const content = ContentSerdes.get().valueToContent(data, this.event, form.contentType);
                eventListener[formIndex].forEach((listener) => listener(content));
            } else {
                for (let formIndex = 0; formIndex < this.eventListener.length; formIndex++) {
                    const listener = this.eventListener[formIndex];
                    // this.listeners may not have all the elements filled
                    if (listener) {
                        const content = ContentSerdes.get().valueToContent(
                            data,
                            this.event,
                            this.event.forms[formIndex].contentType
                        );
                        listener(content);
                    }
                }
            }
        } else {
            // NotFoundError
            throw new Error("NotFoundError for event '" + name + "'");
        }
    }

    /**
     *
     * @experimental
     */
    public async handleObserveProperty(
        name: string,
        listener: ContentListener,
        options?: WoT.InteractionOptions
    ): Promise<void> {
        if (this.properties[name]) {
            const propertyListener = this.propertyListeners.get(name) ?? {};
            const formIndex = ProtocolHelpers.getFormIndexForOperation(
                this.forms,
                "observeproperty",
                options?.formIndex
            );
            if (formIndex !== -1) {
                if (!propertyListener[formIndex]) propertyListener[formIndex] = [];
                propertyListener[formIndex].push(listener);
                this.propertyListeners.set(name, propertyListener);
                console.debug("[core/exposed-thing]", `ExposedThing '${this.title}' subscribes to property '${name}'`);
            } else {
                throw new Error(
                    `ExposedThing '${this.title}', no property listener from found for '${name}' with form index '${options.formIndex}'`
                );
            }
            const observeHandler = this.propertyHandlers.get(name)?.observeHandler;
            if (observeHandler) {
                observeHandler(options);
            }
        } else {
            throw new Error(`ExposedThing '${this.title}', no property found for '${name}'`);
        }
    }

    public handleUnobserveProperty(name: string, listener: ContentListener, options: WoT.InteractionOptions): void {
        if (this.properties[name]) {
            const propertyListener = this.propertyListeners.get(name) ?? {};
            const formIndex = ProtocolHelpers.getFormIndexForOperation(
                this.forms,
                "unobserveproperty",
                options?.formIndex
            );
            if (
                formIndex !== -1 &&
                propertyListener[formIndex] &&
                propertyListener[formIndex].indexOf(listener) !== -1
            ) {
                propertyListener[options.formIndex].splice(propertyListener[options.formIndex].indexOf(listener), 1);
                this.propertyListeners.set(name, propertyListener);
            } else {
                throw new Error(
                    `ExposedThing '${this.title}', no property listener from found for '${name}' with form index '${options.formIndex}'`
                );
            }
            const unobserveHandler = this.propertyHandlers.get(name)?.unobserveHandler;
            if (unobserveHandler) {
                unobserveHandler(options);
            }
        } else {
            throw new Error(`ExposedThing '${this.title}', no property found for '${name}'`);
        }
    }

    private static interactionInputToReadable(input: WoT.InteractionInput): Readable {
        let body;
        if (typeof ReadableStream !== "undefined" && input instanceof ReadableStream) {
            body = ProtocolHelpers.toNodeStream(input);
        } else if (input instanceof PolyfillStream) {
            body = ProtocolHelpers.toNodeStream(input);
        } else {
            body = Readable.from(Buffer.from(input.toString(), "utf-8"));
        }
        return body;
    }
}
/**
 * @deprecated
 */
class PropertyState {
    public value: WoT.DataSchemaValue;
    // public subject: Subject<Content>;
    public scope: unknown;

    public readHandler: WoT.PropertyReadHandler;
    public writeHandler: WoT.PropertyWriteHandler;

    listeners: WoT.WotListener[];

    constructor(value: WoT.DataSchemaValue = null) {
        this.value = value;
        this.listeners = [];
        // this.subject = new Subject<Content>();
        this.scope = {};
        this.writeHandler = null;
        this.readHandler = null;
    }
}
/**
 * @deprecated
 */
class ActionState {
    public scope: unknown;
    public handler: WoT.ActionHandler;

    constructor() {
        this.scope = {};
        this.handler = null;
    }
}
/**
 * @deprecated
 */
class EventState {
    // public subject: Subject<any>;
    legacyListeners: WoT.WotListener[];
    listeners: ContentListener[];
    constructor(private event: WoT.ThingDescription["events"][0]) {
        this.legacyListeners = [];
        this.listeners = [];
    }

    public registerSubscription(formIndex: number, listener: ContentListener) {
        this.listeners[formIndex] = listener;
    }

    public unRegisterSubscription(formIndex: number, listener: ContentListener) {
        this.listeners[formIndex] = undefined;
    }

    public emit(input: WoT.InteractionInput, options?: WoT.InteractionOptions) {
        const form = this.event.forms[options?.formIndex];

        // send event to all listeners
        if (form) {
            if (this.listeners[options.formIndex]) {
                const content = ContentSerdes.get().valueToContent(input, this.event, form?.contentType);
                this.listeners[options.formIndex](content);
            } else {
                console.warn(
                    "[core/exposed-thing]",
                    `Event '${this.event.name}' has no listener for form '${options.formIndex}'`
                );
            }
            return;
        }
        for (let formIndex = 0; formIndex < this.listeners.length; formIndex++) {
            const listener = this.listeners[formIndex];
            // this.listeners may not have all the elements filled
            if (listener) {
                const content = ContentSerdes.get().valueToContent(
                    input,
                    this.event,
                    this.event.forms[formIndex].contentType
                );
                listener(content);
            }
        }
    }
}
/**
 * @deprecated
 */
class ExposedThingProperty extends TD.ThingProperty implements TD.ThingProperty, TD.BaseSchema {
    // functions for wrapping internal state
    getName: () => string;
    getThing: () => ExposedThing;
    getState: () => PropertyState;

    constructor(name: string, thing: ExposedThing) {
        super();

        // wrap internal state into functions to not be stringified in TD
        this.getName = () => {
            return name;
        };
        this.getThing = () => {
            return thing;
        };
        this.getState = new (class {
            state: PropertyState = new PropertyState();
            getInternalState = () => {
                return this.state;
            };
        })().getInternalState;

        // apply defaults
        this.readOnly = false;
        this.writeOnly = false;
        this.observable = false;
    }
}
/**
 * @deprecated
 */
class ExposedThingAction extends TD.ThingAction implements TD.ThingAction {
    // functions for wrapping internal state
    getName: () => string;
    getThing: () => ExposedThing;
    getState: () => ActionState;

    constructor(name: string, thing: ExposedThing) {
        super();

        // wrap internal state into functions to not be stringified
        this.getName = () => {
            return name;
        };
        this.getThing = () => {
            return thing;
        };
        this.getState = new (class {
            state: ActionState = new ActionState();
            getInternalState = () => {
                return this.state;
            };
        })().getInternalState;
    }
}

/**
 * @deprecated
 */
class ExposedThingEvent extends TD.ThingEvent implements TD.ThingEvent {
    // functions for wrapping internal state
    getName: () => string;
    getThing: () => ExposedThing;
    getState: () => EventState;

    constructor(name: string, thing: ExposedThing) {
        super();

        // wrap internal state into functions to not be stringified
        this.getName = () => {
            return name;
        };
        this.getThing = () => {
            return thing;
        };
        this.getState = new (class {
            state: EventState = new EventState(thing.events[name] as WoT.ThingDescription["events"][0]);
            getInternalState = () => {
                return this.state;
            };
        })().getInternalState;
    }
}
