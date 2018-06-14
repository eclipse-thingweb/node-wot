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
import { Subject } from "rxjs/Subject";

import * as TD from "@node-wot/td-tools";

import Servient from "./servient";
import ConsumedThing from "./consumed-thing";
import * as TDGenerator from "./td-generator"
import * as Rest from "./resource-listeners/all-resource-listeners";
import { ResourceListener } from "./resource-listeners/protocol-interfaces";
import { Content, ContentSerdes } from "./content-serdes";
import * as Helpers from "./helpers";

abstract class ExposedThingInteraction {
    label: string;
    forms: Array<WoT.Form>;
    links: Array<WoT.Link>;
}

class ExposedThingProperty extends ExposedThingInteraction implements WoT.ThingProperty, WoT.DataSchema {
    writable: boolean;
    observable: boolean;
    value: any;

    type: WoT.DataType;


    thingName: string;
    propertyName: string;
    propertyState: PropertyState;


    constructor(thingName: string, propertyName: string, propertyState: PropertyState) {
        super();
        this.thingName = thingName;
        this.propertyName = propertyName;
        this.propertyState = propertyState;
    }

    // get and set interface for the Property
    get(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if (this.propertyState) {
                // call read handler (if any)
                if (this.propertyState.readHandler != null) {
                    console.log(`ExposedThing '${this.thingName}' calls registered readHandler for property ${this.propertyName}`);
                    this.value = this.propertyState.value = this.propertyState.readHandler.call(this.propertyState.that);
                } else {
                    console.log(`ExposedThing '${this.thingName}' reports value ${this.propertyState.value} for property ${this.propertyName}`);
                }

                resolve(this.propertyState.value);
            } else {
                reject(new Error("No property called " + this.propertyName));
            }
        });
    }
    set(value: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // call write handler (if any)
            if (this.propertyState.writeHandler != null) {
                console.log(`ExposedThing '${this.thingName}' calls registered writeHandler for property ${this.propertyName}`);
                this.propertyState.value = this.propertyState.writeHandler.call(this.propertyState.that, value);
            } else {
                console.log(`ExposedThing '${this.thingName}' sets new value ${value} for property ${this.propertyName}`);
                this.propertyState.value = value;
            }

            resolve();
        });
    }
}

class ExposedThingAction extends ExposedThingInteraction implements WoT.ThingAction {

    thingName: string;
    actionName: string;
    actionState: ActionState;


    constructor(thingName: string, actionName: string, actionState: ActionState) {
        super();
        this.thingName = thingName;
        this.actionName = actionName;
        this.actionState = actionState;
    }


    run(parameter?: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if (this.actionState) {
                console.debug(`ExposedThing '${this.thingName}' Action state of '${this.actionName}':`, this.actionState);

                if (this.actionState.handler != null) {
                    let handler = this.actionState.handler;
                    resolve(handler(parameter));
                } else {
                    reject(new Error(`ExposedThing '${this.thingName}' has no action handler for '${this.actionName}'`));
                }
            } else {
                reject(new Error(`ExposedThing '${this.thingName}' has no Action '${this.actionName}'`));
            }
        });
    }
}

class ExposedThingEvent extends ExposedThingProperty implements WoT.ThingEvent {
}



export default class ExposedThing extends ConsumedThing implements WoT.ConsumedThing, WoT.ExposedThing {
    private propertyStates: Map<string, PropertyState> = new Map<string, PropertyState>();
    private actionStates: Map<string, ActionState> = new Map<string, ActionState>();
    private interactionObservables: Map<string, Subject<Content>> = new Map<string, Subject<Content>>();
    private restListeners: Map<string, ResourceListener> = new Map<string, ResourceListener>();

    constructor(servient: Servient) {
        // TODO check if extending ConsumedThing is worth the complexity
        super(servient);
    }

    init() {
        console.log("ExposedThing \"init\" called to add all initial interactions ");
        // create state for all initial Interactions
        for (let propertyName in this.properties) {
            let property = this.properties[propertyName];
            this.propertyStates.set(propertyName, new PropertyState());
            this.addResourceListener("/" + this.name + "/properties/" + propertyName, new Rest.PropertyResourceListener(this, propertyName));
        }
        for (let actionName in this.actions) {
            let action = this.actions[actionName];
            this.actionStates.set(actionName, new ActionState());
            this.addResourceListener("/" + this.name + "/actions/" + actionName, new Rest.PropertyResourceListener(this, actionName));
        }
        for (let eventName in this.events) {
            let event = this.events[eventName];
            // TODO connection to bindings
        }

        // expose Thing
        this.addResourceListener("/" + this.name, new Rest.TDResourceListener(this));
    }

    // setter for ThingTemplate properties
    public set(name: string, value: any): void {
        // TODO shall we do some sanity check to avoid setting internal values that are needed et cetera
        this[name] = value;
    }

    public getThingDescription(): WoT.ThingDescription {
        // TODO strip out internals
        return TD.serializeTD(TDGenerator.generateTD(this, this.srv));
    }

    private addResourceListener(path: string, resourceListener: ResourceListener) {
        this.restListeners.set(path, resourceListener);
        this.srv.addResourceListener(path, resourceListener);
    }

    private removeResourceListener(path: string) {
        this.restListeners.delete(path);
        this.srv.removeResourceListener(path);
    }



    // define how to expose and run the Thing
    /** @inheritDoc */
    expose(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
        });
    }

    /** @inheritDoc */
    destroy(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
        });
    }

    /** @inheritDoc */
    public emitEvent(eventName: string, value: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.interactionObservables.get(eventName).next(ContentSerdes.get().valueToContent(value));
            resolve();
        });
    }


    /** @inheritDoc */
    addProperty(name: string, property: WoT.PropertyInit): WoT.ExposedThing {

        console.log(`ExposedThing '${this.name}' adding Property '${name}'`);

        let state = new PropertyState();
        let newProp = Helpers.extend(property, new ExposedThingProperty(this.name, name, state))
        // newProp.forms = [{ href: "", rel: "", security: null }]; // ???
        this.properties[name] = newProp;

        // FIXME does it makes sense to push the state to the ResourceListener?
        let value: any = property.value; // property.get();
        if (value != null) {
            state.value = value;
            console.log(`ExposedThing '${this.name}' sets initial property '${name}' to '${state.value}'`);
        }
        this.propertyStates.set(name, state);
        this.addResourceListener("/" + this.name + "/properties/" + name, new Rest.PropertyResourceListener(this, name));

        // inform TD observers
        this.observablesTDChange.next(this.getThingDescription());

        return this;
    }

    /** @inheritDoc */
    addAction(name: string, action: WoT.ActionInit): WoT.ExposedThing {

        console.log(`ExposedThing '${this.name}' adding Action '${name}'`);

        let state = new ActionState();
        let newAction = Helpers.extend(action, new ExposedThingAction(this.name, name, state));
        this.actions[name] = newAction;

        this.actionStates.set(name, state);
        this.addResourceListener("/" + this.name + "/actions/" + name, new Rest.ActionResourceListener(this, name));

        // inform TD observers
        this.observablesTDChange.next(this.getThingDescription());

        return this;
    }

    /**
     * declare a new eventsource for the ExposedThing
     */
    addEvent(name: string, event: WoT.EventInit): WoT.ExposedThing {
        let newEvent = Helpers.extend(event, new ExposedThingEvent(this.thing.name, name, null));
        this.events[name] = newEvent;

        let subject = new Subject<Content>();

        // lookup table for emitEvent()
        this.interactionObservables.set(name, subject);
        // connection to bindings, which use ResourceListeners to subscribe/unsubscribe
        this.addResourceListener("/" + this.name + "/events/" + name, new Rest.EventResourceListener(name, subject));

        // inform TD observers
        this.observablesTDChange.next(this.getThingDescription());

        return this;
    }

    /** @inheritDoc */
    removeProperty(propertyName: string): WoT.ExposedThing {
        this.interactionObservables.get(propertyName).complete();
        this.interactionObservables.delete(propertyName);
        this.propertyStates.delete(propertyName);
        this.removeResourceListener(this.name + "/properties/" + propertyName);
        delete this.properties[propertyName];

        // inform TD observers
        this.observablesTDChange.next(this.getThingDescription());

        return this;
    }

    /** @inheritDoc */
    removeAction(actionName: string): WoT.ExposedThing {
        this.actionStates.delete(actionName);
        this.removeResourceListener(this.name + "/actions/" + actionName);
        delete this.actions[actionName];

        // inform TD observers
        this.observablesTDChange.next(this.getThingDescription());

        return this;
    }

    /** @inheritDoc */
    removeEvent(eventName: string): WoT.ExposedThing {
        this.interactionObservables.get(eventName).complete();
        this.interactionObservables.delete(eventName);
        this.removeResourceListener(this.name + "/events/" + eventName);
        delete this.events[eventName];

        // inform TD observers
        this.observablesTDChange.next(this.getThingDescription());

        return this;
    }

    /** @inheritDoc */
    setActionHandler(actionName: string, action: WoT.ActionHandler): WoT.ExposedThing {
        console.log(`ExposedThing '${this.name}' setting action Handler for '${actionName}'`);
        let state = this.actionStates.get(actionName);
        if (state) {
            this.actions[actionName].run = action;
            state.handler = action;
        } else {
            throw Error(`ExposedThing '${this.name}' cannot set action handler for unknown '${actionName}'`);
        }

        return this;
    }

    /** @inheritDoc */
    setPropertyReadHandler(propertyName: string, readHandler: WoT.PropertyReadHandler): WoT.ExposedThing {
        console.log(`ExposedThing '${this.name}' setting read handler for '${propertyName}'`);
        let state = this.propertyStates.get(propertyName);
        if (state) {
            this.properties[propertyName].get = readHandler;
            state.readHandler = readHandler;
        } else {
            throw Error(`ExposedThing '${this.name}' cannot set read handler for unknown '${propertyName}'`);
        }
        return this;
    }

    /** @inheritDoc */
    setPropertyWriteHandler(propertyName: string, writeHandler: WoT.PropertyWriteHandler): WoT.ExposedThing {
        console.log(`ExposedThing '${this.name}' setting write handler for '${propertyName}'`);
        let state = this.propertyStates.get(propertyName);
        if (state) {
            this.properties[propertyName].set = writeHandler;
            state.writeHandler = writeHandler;
        } else {
            throw Error(`ExposedThing '${this.name}' cannot set write handler for unknown '${propertyName}'`);
        }
        return this;
    }

}

class PropertyState {
    public that: Function;
    public value: any;

    public writeHandler: Function;
    public readHandler: Function;

    constructor() {
        this.that = new Function();
        this.value = null;
        this.writeHandler = null;
        this.readHandler = null;
    }

}

class ActionState {
    public that: Function;
    public handler: Function;
    constructor() {
        this.that = new Function();
        this.handler = null;
    }
}