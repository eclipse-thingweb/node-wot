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

import { Subject } from "rxjs/Subject";
import { Subscription } from "rxjs/Subscription";

import * as TD from "@node-wot/td-tools";

import Servient from "./servient";
import { ContentSerdes } from "./content-serdes";
import Helpers from "./helpers";
import { Content } from "./protocol-interfaces";

export default class ExposedThing extends TD.Thing implements WoT.ExposedThing {
    security: Array<String>;
    securityDefinitions: { [key: string]: WoT.Security };

    id: string;
    title: string;
    base: string;
    forms: Array<WoT.Form>;

    /** A map of interactable Thing Properties with read()/write()/subscribe() functions */
    properties: {
        [key: string]: WoT.ThingProperty
    };

    /** A map of interactable Thing Actions with invoke() function */
    actions: {
        [key: string]: WoT.ThingAction;
    }

    /** A map of interactable Thing Events with emit() function */
    events: {
        [key: string]: WoT.ThingEvent;
    }

    private getServient: () => Servient;
    private getSubjectTD: () => Subject<any>;

    constructor(servient: Servient) {
        super();

        this.getServient = () => { return servient; };
        this.getSubjectTD = (new class {
            subjectTDChange: Subject<any> = new Subject<any>();
            getSubject = () => { return this.subjectTDChange };
        }).getSubject;
    }

    extendInteractions(): void {
        for (let propertyName in this.properties) {
            let newProp = Helpers.extend(this.properties[propertyName], new ExposedThingProperty(propertyName, this));
            this.properties[propertyName] = newProp;
        }
        for (let actionName in this.actions) {
            let newAction = Helpers.extend(this.actions[actionName], new ExposedThingAction(actionName, this));
            this.actions[actionName] = newAction;
        }
        for (let eventName in this.events) {
            let newEvent = Helpers.extend(this.events[eventName], new ExposedThingEvent(eventName, this));
            this.events[eventName] = newEvent;
        }
    }

    // setter for ThingTemplate fields
    public set(name: string, value: any): void {
        // TODO setter only makes sense if we do something here
        console.log(`ExposedThing '${this.title}' setting field '${name}' to '${value}'`);
        this[name] = value;
    }

    public getThingDescription(): WoT.ThingDescription {
        return TD.serializeTD(this);
    }

    /** @inheritDoc */
    expose(): Promise<void> {
        console.log(`ExposedThing '${this.title}' exposing all Interactions and TD`);

        return new Promise<void>((resolve, reject) => {
            // let servient forward exposure to the servers
            this.getServient().expose(this).then( () => {
                // inform TD observers
                this.getSubjectTD().next(this.getThingDescription());
                resolve();
            })
            .catch( (err) => reject(err) );
        });
    }

    /** @inheritDoc */
    destroy(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            resolve();
        });
    }

    /** @inheritDoc */
    addProperty(name: string, property: WoT.PropertyFragment, init?: any): WoT.ExposedThing {

        console.log(`ExposedThing '${this.title}' adding Property '${name}'`);

        let newProp = Helpers.extend(property, new ExposedThingProperty(name, this));
        this.properties[name] = newProp;

        if (init !== undefined) {
            newProp.write(init);
        }

        return this;
    }

    /** @inheritDoc */
    addAction(name: string, action: WoT.ActionFragment, handler: WoT.ActionHandler): WoT.ExposedThing {

        if (!handler) {
            throw new Error(`addAction() requires handler`);
        }

        console.log(`ExposedThing '${this.title}' adding Action '${name}'`);

        let newAction = Helpers.extend(action, new ExposedThingAction(name, this));
        newAction.getState().handler = handler.bind(newAction.getState().scope);
        this.actions[name] = newAction;

        return this;
    }

    /** @inheritDoc */
    addEvent(name: string, event: WoT.EventFragment): WoT.ExposedThing {
        let newEvent = Helpers.extend(event, new ExposedThingEvent(name, this));
        this.events[name] = newEvent;

        return this;
    }

    /** @inheritDoc */
    removeProperty(propertyName: string): WoT.ExposedThing {
        
        if (this.properties[propertyName]) {
            delete this.properties[propertyName];
        } else {
            throw new Error(`ExposedThing '${this.title}' has no Property '${propertyName}'`);
        }

        return this;
    }

    /** @inheritDoc */
    removeAction(actionName: string): WoT.ExposedThing {
        
        if (this.actions[actionName]) {
            delete this.actions[actionName];
        } else {
            throw new Error(`ExposedThing '${this.title}' has no Action '${actionName}'`);
        }

        return this;
    }

    /** @inheritDoc */
    removeEvent(eventName: string): WoT.ExposedThing {
        
        if (this.events[eventName]) {
            (<ExposedThingEvent>this.events[eventName]).getState().subject.complete();
            delete this.events[eventName];
        } else {
            throw new Error(`ExposedThing '${this.title}' has no Event '${eventName}'`);
        }

        return this;
    }

    /** @inheritDoc */
    setPropertyReadHandler(propertyName: string, handler: WoT.PropertyReadHandler): WoT.ExposedThing {
        console.log(`ExposedThing '${this.title}' setting read handler for '${propertyName}'`);

        if (this.properties[propertyName]) {
            // in case of function instead of lambda, the handler is bound to a scope shared with the writeHandler in PropertyState
            this.properties[propertyName].getState().readHandler = handler.bind(this.properties[propertyName].getState().scope);
        } else {
            throw new Error(`ExposedThing '${this.title}' has no Property '${propertyName}'`);
        }
        return this;
    }

    /** @inheritDoc */
    setPropertyWriteHandler(propertyName: string, handler: WoT.PropertyWriteHandler): WoT.ExposedThing {
        console.log(`ExposedThing '${this.title}' setting write handler for '${propertyName}'`);
        if (this.properties[propertyName]) {
            // in case of function instead of lambda, the handler is bound to a scope shared with the readHandler in PropertyState
            this.properties[propertyName].getState().writeHandler = handler.bind(this.properties[propertyName].getState().scope);

            // setting write handler implies Property is writable (readOnly == false)
            if (this.properties[propertyName].readOnly) {
                console.warn(`ExposedThing '${this.title}' automatically setting Property '${propertyName}' readOnly to false`);
                this.properties[propertyName].readOnly = false;
            }
        } else {
            throw new Error(`ExposedThing '${this.title}' has no Property '${propertyName}'`);
        }
        return this;
    }

    /** @inheritDoc */
    setActionHandler(actionName: string, handler: WoT.ActionHandler): WoT.ExposedThing {
        console.log(`ExposedThing '${this.title}' setting action Handler for '${actionName}'`);

        if (this.actions[actionName]) {
            // in case of function instead of lambda, the handler is bound to a clean scope of the ActionState
            this.actions[actionName].getState().handler = handler.bind(this.actions[actionName].getState().scope);
        } else {
            throw new Error(`ExposedThing '${this.title}' has no Action '${actionName}'`);
        }
        return this;
    }
}

class ExposedThingProperty extends TD.ThingProperty implements WoT.ThingProperty, WoT.BaseSchema {

    // functions for wrapping internal state
    getName: () => string;
    getThing: () => ExposedThing;
    getState: () => PropertyState;

    constructor(name: string, thing: ExposedThing) {
        super();

        // wrap internal state into functions to not be stringified in TD
        this.getName = () => { return name; }
        this.getThing = () => { return thing; }
        this.getState = (new class {
            state: PropertyState = new PropertyState();
            getInternalState = () => { return this.state };
        }).getInternalState;

        // apply defaults
        this.readOnly = false;
        this.writeOnly = false;
        this.observable = false;
    }

    /** WoT.ThingProperty interface: read this Property locally (async) */
    public read(options?: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            // call read handler (if any)
            if (this.getState().readHandler != null) {
                console.log(`ExposedThing '${this.getThing().title}' calls registered readHandler for Property '${this.getName()}'`);
                this.getState().readHandler(options).then((customValue) => {
                    // update internal state in case writeHandler wants to get the value
                    this.getState().value = customValue;
                    resolve(customValue);
                });
            } else {
                console.log(`ExposedThing '${this.getThing().title}' gets internal value '${this.getState().value}' for Property '${this.getName()}'`);
                resolve(this.getState().value);
            }
        });
    }

    /** WoT.ThingProperty interface: write this Property locally (async) */
    public write(value: any, options?: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // call write handler (if any)
            if (this.getState().writeHandler != null) {
                
                // be generous when no promise is returned
                let promiseOrValueOrNil = this.getState().writeHandler(value, options);
                
                if (promiseOrValueOrNil !== undefined) {
                    if (typeof promiseOrValueOrNil.then === "function") {
                        promiseOrValueOrNil.then((customValue) => {
                            console.log(`ExposedThing '${this.getThing().title}' write handler for Property '${this.getName()}' sets custom value '${customValue}'`);
                            /** notify state change */
                            // FIXME object comparison
                            if (this.getState().value!==customValue) {
                                this.getState().subject.next(customValue);
                            }
                            this.getState().value = customValue;
                            resolve();
                        })
                        .catch((customError) => {
                            console.warn(`ExposedThing '${this.getThing().title}' write handler for Property '${this.getName()}' rejected the write with error '${customError}'`);
                            reject(customError);
                        });
                    } else  {
                        console.warn(`ExposedThing '${this.getThing().title}' write handler for Property '${this.getName()}' does not return promise`);
                        if (this.getState().value!==promiseOrValueOrNil) {
                            this.getState().subject.next(<any>promiseOrValueOrNil);
                        }
                        this.getState().value = <any>promiseOrValueOrNil;
                        resolve();
                    }
                } else {
                    console.warn(`ExposedThing '${this.getThing().title}' write handler for Property '${this.getName()}' does not return custom value, using direct value '${value}'`);
                    
                    if (this.getState().value!==value) {
                        this.getState().subject.next(value);
                    }
                    this.getState().value = value;
                    resolve();
                }
            } else {
                console.log(`ExposedThing '${this.getThing().title}' directly sets Property '${this.getName()}' to value '${value}'`);
                /** notify state change */
                if (this.getState().value!==value) {
                    this.getState().subject.next(value);
                }
                this.getState().value = value;
                resolve();
            }
        });
    }

    public subscribe(next?: (value: any) => void, error?: (error: any) => void, complete?: () => void): Subscription {
        return this.getState().subject.asObservable().subscribe(next, error, complete);
    }
}

class ExposedThingAction extends TD.ThingAction implements WoT.ThingAction {
    // functions for wrapping internal state
    getName: () => string;
    getThing: () => ExposedThing;
    getState: () => ActionState;

    constructor(name: string, thing: ExposedThing) {
        super();

        // wrap internal state into functions to not be stringified
        this.getName = () => { return name; }
        this.getThing = () => { return thing; }
        this.getState = (new class {
            state: ActionState = new ActionState();
            getInternalState = () => { return this.state };
        }).getInternalState;
    }

    /** WoT.ThingAction interface: invoke this Action locally (async) */
    public invoke(parameter?: any, options?: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            console.debug(`ExposedThing '${this.getThing().title}' has Action state of '${this.getName()}':`, this.getState());

            if (this.getState().handler != null) {
                console.log(`ExposedThing '${this.getThing().title}' calls registered handler for Action '${this.getName()}'`);
                resolve(this.getState().handler(parameter, options));
            } else {
                reject(new Error(`ExposedThing '${this.getThing().title}' has no handler for Action '${this.getName()}'`));
            }
        });
    }
}

class ExposedThingEvent extends TD.ThingEvent implements WoT.ThingEvent {
    // functions for wrapping internal state
    getName: () => string;
    getThing: () => ExposedThing;
    getState: () => EventState;

    constructor(name: string, thing: ExposedThing) {
        super();

        // wrap internal state into functions to not be stringified
        this.getName = () => { return name; }
        this.getThing = () => { return thing; }
        this.getState = (new class {
            state: EventState = new EventState();
            getInternalState = () => { return this.state };
        }).getInternalState;
    }

    /** WoT.ThingEvent interface: subscribe to this Event locally */
    public subscribe(next?: (value: any) => void, error?: (error: any) => void, complete?: () => void): Subscription {
        return this.getState().subject.asObservable().subscribe(
            next,
            error,
            complete
        );
    }

    // FIXME maybe move
    /** WoT.ThingEvent interface: emit a new Event instance */
    public emit(data?: any): void {
        // TODO validate against this.data
        this.getState().subject.next(data);
    }
}

class PropertyState {
    public value: any;
    public subject: Subject<Content>;
    public scope: Object;

    public readHandler: WoT.PropertyReadHandler;
    public writeHandler: WoT.PropertyWriteHandler;

    constructor(value: any = null) {
        this.value = value;
        this.subject = new Subject<Content>();
        this.scope = {};        
        this.writeHandler = null;
        this.readHandler = null;
    }
}

class ActionState {
    public scope: Object;
    public handler: WoT.ActionHandler;

    constructor() {
        this.scope = {};
        this.handler = null;
    }
}

class EventState {
    public subject: Subject<any>;

    constructor() {
        this.subject = new Subject<any>();
    }
}
