/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
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
import * as TDT from "wot-thing-description-types";

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
    ListenerItem,
    ListenerMap,
    PropertyHandlerMap,
    PropertyHandlers,
} from "./protocol-interfaces";

export default class ExposedThing extends TD.Thing implements WoT.ExposedThing {
    security: string | [string, ...string[]];
    securityDefinitions: {
        [key: string]: TDT.SecurityScheme;
    };

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
    __propertyHandlers: PropertyHandlerMap = new Map<string, PropertyHandlers>();

    /** A map of action handler callback functions */
    __actionHandlers: ActionHandlerMap = new Map<string, WoT.ActionHandler>();

    /** A map of event handler callback functions */
    __eventHandlers: EventHandlerMap = new Map<string, EventHandlers>();

    /** A map of property listener callback functions */
    __propertyListeners: ListenerMap = new Map<string, ListenerItem>();

    /** A map of event listener callback functions */
    __eventListeners: ListenerMap = new Map<string, ListenerItem>();

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
    }

    // Note: copy from td-parser.ts
    addDefaultLanguage(thing: ExposedThing): void {
        // add @language : "en" if no @language set
        if (Array.isArray(thing["@context"])) {
            const arrayContext: TDT.ThingContext = thing["@context"];
            let languageSet = false;
            for (const arrayEntry of arrayContext) {
                if (typeof arrayEntry === "object") {
                    if (arrayEntry["@language"] !== undefined) {
                        languageSet = true;
                    }
                }
            }
            if (!languageSet) {
                (arrayContext as Exclude<typeof arrayContext, []>).push({
                    "@language": TD.DEFAULT_CONTEXT_LANGUAGE,
                });
            }
        }
    }

    public getThingDescription(): WoT.ThingDescription {
        return JSON.parse(TD.serializeTD(this), (key, value) => {
            // Check if key matches internals like "__propertyHandlers", "__actionHandlers", ...
            // if matched return value "undefined"
            if (
                key === "__propertyHandlers" ||
                key === "__actionHandlers" ||
                key === "__eventHandlers" ||
                key === "__propertyListeners" ||
                key === "__eventListeners"
            ) {
                return undefined;
            }
            // else return the value itself
            return value;
        });
    }

    public emitEvent(name: string, data: WoT.InteractionInput): void {
        if (this.events[name]) {
            const eventListener = this.__eventListeners.get(name);
            const formIndex = ProtocolHelpers.getFormIndexForOperation(this.events[name], "event", "subscribeevent");

            if (eventListener) {
                if (formIndex !== -1 && eventListener[formIndex]) {
                    if (eventListener[formIndex].length < 1) {
                        return;
                    }

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
            }
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
                if (this.__propertyHandlers.has(propertyName)) {
                    propertyHandler = this.__propertyHandlers.get(propertyName);
                    propertyHandler.readHandler = handler;
                } else {
                    propertyHandler = { readHandler: handler };
                }

                this.__propertyHandlers.set(propertyName, propertyHandler);
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
                if (this.__propertyHandlers.has(propertyName)) {
                    propertyHandler = this.__propertyHandlers.get(propertyName);
                    propertyHandler.writeHandler = handler;
                } else {
                    propertyHandler = { writeHandler: handler };
                }

                this.__propertyHandlers.set(propertyName, propertyHandler);
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
            if (!this.properties[name].observable) {
                throw new Error(
                    `ExposedThing '${this.title}' cannot set observe handler for property '${name}' since the observable flag is set to false`
                );
            } else {
                let propertyHandler;
                if (this.__propertyHandlers.has(name)) {
                    propertyHandler = this.__propertyHandlers.get(name);
                    propertyHandler.observeHandler = handler;
                } else {
                    propertyHandler = { observeHandler: handler };
                }
                this.__propertyHandlers.set(name, propertyHandler);
            }
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
            if (!this.properties[name].observable) {
                throw new Error(
                    `ExposedThing '${this.title}' cannot set unobserve handler for property '${name}' due to missing observable flag`
                );
            } else {
                let propertyHandler;
                if (this.__propertyHandlers.has(name)) {
                    propertyHandler = this.__propertyHandlers.get(name);
                    propertyHandler.unobserveHandler = handler;
                } else {
                    propertyHandler = { unobserveHandler: handler };
                }
                this.__propertyHandlers.set(name, propertyHandler);
            }
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
            this.__actionHandlers.set(actionName, handler);
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
            if (this.__eventHandlers.has(name)) {
                eventHandler = this.__eventHandlers.get(name);
                eventHandler.subscribe = handler;
            } else {
                eventHandler = { subscribe: handler };
            }

            this.__eventHandlers.set(name, eventHandler);
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
            if (this.__eventHandlers.has(name)) {
                eventHandler = this.__eventHandlers.get(name);
                eventHandler.unsubscribe = handler;
            } else {
                eventHandler = { unsubscribe: handler };
            }

            this.__eventHandlers.set(name, eventHandler);
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
            if (this.__eventHandlers.has(name)) {
                eventHandler = this.__eventHandlers.get(name);
                eventHandler.handler = handler;
            } else {
                eventHandler = { handler: handler };
            }

            this.__eventHandlers.set(name, eventHandler);
        } else {
            throw new Error(`ExposedThing '${this.title}' has no Event '${name}'`);
        }
        return this;
    }

    /**
     * Handle the request of an action invocation form the protocol binding level
     * @experimental
     */
    public async handleInvokeAction(
        name: string,
        inputContent: Content,
        options: WoT.InteractionOptions & { formIndex: number }
    ): Promise<Content | void> {
        // TODO: handling URI variables?
        if (this.actions[name]) {
            console.debug("[core/exposed-thing]", `ExposedThing '${this.title}' has Action state of '${name}'`);

            const handler = this.__actionHandlers.get(name);
            if (handler != null) {
                console.debug(
                    "[core/exposed-thing]",
                    `ExposedThing '${this.title}' calls registered handler for Action '${name}'`
                );
                Helpers.validateInteractionOptions(this, this.actions[name], options);
                const form = this.actions[name].forms
                    ? this.actions[name].forms[options.formIndex]
                    : { contentType: "application/json" };
                const result: WoT.InteractionInput | void = await handler(
                    new InteractionOutput(inputContent, form, this.actions[name].input),
                    options
                );
                if (result) {
                    // TODO: handle form.response.contentType
                    return ContentManager.valueToContent(result, this.actions[name].output, form.contentType);
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
        options: WoT.InteractionOptions & { formIndex: number }
    ): Promise<Content> {
        if (this.properties[propertyName]) {
            console.debug("[core/exposed-thing]", `ExposedThing '${this.title}' has Action state of '${propertyName}'`);

            const readHandler = this.__propertyHandlers.get(propertyName)?.readHandler;

            if (readHandler != null) {
                console.debug(
                    "[core/exposed-thing]",
                    `ExposedThing '${this.title}' calls registered readHandler for Property '${propertyName}'`
                );
                Helpers.validateInteractionOptions(this, this.properties[propertyName], options);
                const result: WoT.InteractionInput | void = await readHandler(options);
                const form = this.properties[propertyName].forms
                    ? this.properties[propertyName].forms[options.formIndex]
                    : { contentType: "application/json" };
                return ContentManager.valueToContent(
                    result,
                    this.properties[propertyName],
                    form?.contentType ?? "application/json"
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
        options: WoT.InteractionOptions & { formIndex: number }
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

            promises.push(this.handleReadProperty(propertyName, options));
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
    public async handleReadAllProperties(
        options: WoT.InteractionOptions & { formIndex: number }
    ): Promise<PropertyContentMap> {
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
        options: WoT.InteractionOptions & { formIndex: number }
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
        options: WoT.InteractionOptions & { formIndex: number }
    ): Promise<void> {
        // TODO: to be removed next api does not allow an ExposedThing to be also a ConsumeThing
        if (this.properties[propertyName]) {
            if (this.properties[propertyName].readOnly && this.properties[propertyName].readOnly === true) {
                throw new Error(`ExposedThing '${this.title}', property '${propertyName}' is readOnly`);
            }
            Helpers.validateInteractionOptions(this, this.properties[propertyName], options);
            const writeHandler = this.__propertyHandlers.get(propertyName)?.writeHandler;
            const form = this.properties[propertyName].forms
                ? this.properties[propertyName].forms[options.formIndex]
                : {};
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
        options: WoT.InteractionOptions & { formIndex: number }
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
            promises.push(this.handleWriteProperty(propertyName, valueMap.get(propertyName), options));
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
        options: WoT.InteractionOptions & { formIndex: number }
    ): Promise<void> {
        if (this.events[name]) {
            const eventListener = this.__eventListeners.get(name) ?? {};
            const formIndex = ProtocolHelpers.getFormIndexForOperation(
                this.events[name],
                "event",
                "subscribeevent",
                options.formIndex
            );
            if (formIndex !== -1) {
                if (!eventListener[formIndex]) eventListener[formIndex] = [];
                eventListener[formIndex].push(listener);
                this.__eventListeners.set(name, eventListener);
                console.debug("[core/exposed-thing]", `ExposedThing '${this.title}' subscribes to event '${name}'`);
            } else {
                throw new Error(
                    `ExposedThing '${this.title}', no property listener from found for '${name}' with form index '${options.formIndex}'`
                );
            }
            Helpers.validateInteractionOptions(this, this.events[name], options);
            const subscribe = this.__eventHandlers.get(name)?.subscribe;
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
    public handleUnsubscribeEvent(
        name: string,
        listener: ContentListener,
        options: WoT.InteractionOptions & { formIndex: number }
    ): void {
        if (this.events[name]) {
            const eventListener = this.__eventListeners.get(name) ?? {};
            const formIndex = ProtocolHelpers.getFormIndexForOperation(
                this.events[name],
                "event",
                "unsubscribeevent",
                options.formIndex
            );
            if (formIndex !== -1 && eventListener[formIndex] && eventListener[formIndex].indexOf(listener) !== -1) {
                eventListener[formIndex].splice(eventListener[formIndex].indexOf(listener), 1);
                this.__eventListeners.set(name, eventListener);
            } else {
                throw new Error(
                    `ExposedThing '${this.title}', no event listener from found for '${name}' with form index '${options.formIndex}'`
                );
            }
            Helpers.validateInteractionOptions(this, this.events[name], options);
            const unsubscribe = this.__eventHandlers.get(name)?.unsubscribe;
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
    public async handleObserveProperty(
        name: string,
        listener: ContentListener,
        options: WoT.InteractionOptions & { formIndex: number }
    ): Promise<void> {
        if (this.properties[name]) {
            const propertyListener = this.__propertyListeners.get(name) ?? {};
            const formIndex = ProtocolHelpers.getFormIndexForOperation(
                this.properties[name],
                "property",
                "observeproperty",
                options.formIndex
            );
            if (formIndex !== -1) {
                if (!propertyListener[formIndex]) propertyListener[formIndex] = [];
                propertyListener[formIndex].push(listener);
                this.__propertyListeners.set(name, propertyListener);
                console.debug("[core/exposed-thing]", `ExposedThing '${this.title}' subscribes to property '${name}'`);
            } else {
                throw new Error(
                    `ExposedThing '${this.title}', no property listener from found for '${name}' with form index '${options.formIndex}'`
                );
            }
            Helpers.validateInteractionOptions(this, this.properties[name], options);
            const observeHandler = this.__propertyHandlers.get(name)?.observeHandler;
            if (observeHandler) {
                observeHandler(options);
            }
        } else {
            throw new Error(`ExposedThing '${this.title}', no property found for '${name}'`);
        }
    }

    public handleUnobserveProperty(
        name: string,
        listener: ContentListener,
        options: WoT.InteractionOptions & { formIndex: number }
    ): void {
        if (this.properties[name]) {
            const propertyListener = this.__propertyListeners.get(name) ?? {};
            const formIndex = ProtocolHelpers.getFormIndexForOperation(
                this.properties[name],
                "property",
                "unobserveproperty",
                options.formIndex
            );
            if (
                formIndex !== -1 &&
                propertyListener[formIndex] &&
                propertyListener[formIndex].indexOf(listener) !== -1
            ) {
                propertyListener[formIndex].splice(propertyListener[formIndex].indexOf(listener), 1);
                this.__propertyListeners.set(name, propertyListener);
            } else {
                throw new Error(
                    `ExposedThing '${this.title}', no property listener from found for '${name}' with form index '${options.formIndex}'`
                );
            }
            Helpers.validateInteractionOptions(this, this.properties[name], options);
            const unobserveHandler = this.__propertyHandlers.get(name)?.unobserveHandler;
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
        } else if (Array.isArray(input) || typeof input === "object") {
            body = Readable.from(Buffer.from(JSON.stringify(input), "utf-8"));
        } else {
            body = Readable.from(Buffer.from(input.toString(), "utf-8"));
        }
        return body;
    }
}
