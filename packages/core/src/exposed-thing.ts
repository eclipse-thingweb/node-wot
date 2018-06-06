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

export default class ExposedThing extends ConsumedThing implements WoT.ConsumedThing, WoT.ExposedThing {
    private propertyStates: Map<string, PropertyState> = new Map<string, PropertyState>();
    private actionStates: Map<string, ActionState> = new Map<string, ActionState>();
    private interactionObservables: Map<string, Subject<Content>> = new Map<string, Subject<Content>>();
    private restListeners: Map<string, ResourceListener> = new Map<string, ResourceListener>();

    constructor(servient: Servient, td: WoT.ThingDescription) {
        // TODO check if extending ConsumedThing is worth the complexity
        super(servient, td);

        // create state for all TD-declared Interactions
        let initialInteractions = this.interaction.slice(0);
        // copied TD entries and reset interaction for adding stateful Interactions
        this.interaction = [];

        for (let inter of initialInteractions) {
            if (inter.pattern === TD.InteractionPattern.Property) {
                this.addProperty(inter as WoT.ThingProperty);
            } else if (inter.pattern === TD.InteractionPattern.Action) {
                this.addAction(inter as WoT.ThingProperty);
            } else if (inter.pattern === TD.InteractionPattern.Event) {
                this.addEvent(inter as WoT.ThingEvent);
            } else {
                console.error(`ExposedThing '${this.name}' ignoring unknown Interaction '${inter.name}':`, inter);
            }
        }

        // expose Thing
        this.addResourceListener("/" + encodeURIComponent(this.name), new Rest.TDResourceListener(this));
    }

    public getThingDescription(): WoT.ThingDescription {
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

    public getInteractions(): Array<TD.Interaction> {
        // returns a copy -- FIXME: not a deep copy
        return this.interaction.slice(0);
    }

    /**
     * Read a given property
     * @param propertyName Name of the property
     */
    public readProperty(propertyName: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let state = this.propertyStates.get(propertyName);
            if (state) {
                // call read handler (if any)
                if (state.readHandler != null) {
                    console.log(`ExposedThing '${this.name}' calls registered readHandler for property ${propertyName}`);
                    state.readHandler.call(state.that).then( (result: any) => {
                        state.value = result;
                        resolve(state.value);
                    }).catch( (err: Error) => {
                        reject(err);
                    });
                } else {
                    console.log(`ExposedThing '${this.name}' reports value ${state.value} for property ${propertyName}`);
                    resolve(state.value);
                }
            } else {
                reject(new Error("No property called " + propertyName));
            }
        });
    }

    /**
     * Write a given property
     * @param propertyName of the property
     * @param newValue value to be set
     */
    public writeProperty(propertyName: string, newValue: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let state = this.propertyStates.get(propertyName);
            if (state) {
                // call write handler (if any)
                if (state.writeHandler != null) {
                    console.log(`ExposedThing '${this.name}' calls registered writeHandler for property ${propertyName}`);
                    state.writeHandler.call(state.that, newValue).then( (result: any) => {
                        state.value = result;
                        resolve();
                    }).catch( (err: Error) => {
                        reject(err);
                    });
                } else {
                    console.log(`ExposedThing '${this.name}' sets new value ${newValue} for property ${propertyName}`);
                    state.value = newValue;
                    resolve();
                }
            } else {
                reject(new Error("No property called " + propertyName));
            }
        });
    }

    /** invokes an action on the target thing
     * @param actionName Name of the action to invoke
     * @param parameter optional json object to supply parameters
    */
    public invokeAction(actionName: string, parameter?: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let state = this.actionStates.get(actionName);
            if (state) {
                // TODO debug-level
                console.debug(`ExposedThing '${this.name}' Action state of '${actionName}':`, state);

                if (state.handler != null) {
                    let handler = state.handler;
                    resolve(handler(parameter));
                } else {
                    reject(new Error(`ExposedThing '${this.name}' has no action handler for '${actionName}'`));
                }
            } else {
                reject(new Error(`ExposedThing '${this.name}' has no Action '${actionName}'`));
            }
        });
    }

    // define how to expose and run the Thing

    /** @inheritDoc */
    register(directory?: USVString): Promise<void> {
        return new Promise<void>((resolve, reject) => {
        });
    }

    /** @inheritDoc */
    unregister(directory?: USVString): Promise<void> {
        return new Promise<void>((resolve, reject) => {
        });
    }

    /** @inheritDoc */
    start(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
        });
    }

    /** @inheritDoc */
    stop(): Promise<void> {
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
    addProperty(property: WoT.ThingProperty): WoT.ExposedThing {

        if (property.name===undefined) throw new Error("addProperty() requires ThingProperty 'name'");
        if (property.schema===undefined) throw new Error("addProperty() requires ThingProperty 'schema'");

        console.log(`ExposedThing '${this.name}' adding Property '${property.name}'`);

        let newProp = new TD.Interaction();
        newProp.pattern = TD.InteractionPattern.Property;

        newProp.name = property.name;

        // convert from string if necessary (when using ThingPropertyInit)
        newProp.schema = (typeof property.schema === "string") ? JSON.parse(property.schema) : property.schema;

        newProp.writable = property.writable===undefined ? false : property.writable;
        newProp.observable = property.observable===undefined ? false : property.observable;
        
        // metadata
        if (Array.isArray(property.semanticType)) {
            newProp.semanticType = property.semanticType.slice(0);
        }
        if (Array.isArray(property.metadata)) {
            newProp.metadata = property.metadata.slice(0);
        }

        this.interaction.push(newProp);

        // TODO would it make sense to push the state to the ResourceListener? Or can we get rid of ResourceListeners?
        let state = new PropertyState();
        if (property.value != null) {
            state.value = property.value;
            console.log(`ExposedThing '${this.name}' sets initial property '${property.name}' to '${state.value}'`);
        }
        this.propertyStates.set(newProp.name, state);
        this.addResourceListener("/" + encodeURIComponent(this.name) + "/properties/" + encodeURIComponent(newProp.name), new Rest.PropertyResourceListener(this, newProp.name));

        // inform TD observers
        this.observablesTDChange.next(this.getThingDescription());

        return this;
    }

    /** @inheritDoc */
    addAction(action: WoT.ThingAction): WoT.ExposedThing {

        if (action.name===undefined) throw new Error("addAction() requires ThingAction 'name'");

        console.log(`ExposedThing '${this.name}' adding Action '${action.name}'`);

        let newAction = new TD.Interaction();
        newAction.pattern = TD.InteractionPattern.Action;

        newAction.name = action.name;

        // convert from string if necessary (when using ThingActionInit)
        newAction.inputSchema = (typeof action.inputSchema === "string") ? JSON.parse(action.inputSchema) : action.inputSchema;
        newAction.outputSchema = (typeof action.outputSchema === "string") ? JSON.parse(action.outputSchema) : action.outputSchema;

        // metadata
        if (Array.isArray(action.semanticType)) {
            newAction.semanticType = action.semanticType.slice(0);
        }
        if (Array.isArray(action.metadata)) {
            newAction.metadata = action.metadata.slice(0);
        }

        this.interaction.push(newAction);

        this.actionStates.set(newAction.name, new ActionState());
        this.addResourceListener("/" + encodeURIComponent(this.name) + "/actions/" + encodeURIComponent(newAction.name), new Rest.ActionResourceListener(this, newAction.name));

        // inform TD observers
        this.observablesTDChange.next(this.getThingDescription());

        return this;
    }

    /**
     * declare a new eventsource for the ExposedThing
     */
    addEvent(event: WoT.ThingEvent): WoT.ExposedThing {

        if (event.name===undefined) throw new Error("addEvent() requires ThingEvent 'name'");
        if (event.schema===undefined) throw new Error("addEvent() requires ThingEvent 'schema'");

        console.log(`ExposedThing '${this.name}' adding Event '${event.name}'`);

        let newEvent = new TD.Interaction();
        newEvent.pattern = TD.InteractionPattern.Event;

        newEvent.name = event.name;

        // convert from string if necessary (when using ThingEventInit)
        newEvent.schema = (typeof event.schema === "string") ? JSON.parse(event.schema) : event.schema;

        // metadata
        if (Array.isArray(event.semanticType)) {
            newEvent.semanticType = event.semanticType.slice(0);
        }
        if (Array.isArray(event.metadata)) {
            newEvent.metadata = event.metadata.slice(0);
        }

        this.interaction.push(newEvent);

        let subject = new Subject<Content>();

        // lookup table for emitEvent()
        this.interactionObservables.set(newEvent.name, subject);
        // connection to bindings, which use ResourceListeners to subscribe/unsubscribe
        this.addResourceListener("/" + encodeURIComponent(this.name) + "/events/" + encodeURIComponent(newEvent.name), new Rest.EventResourceListener(newEvent.name, subject));

        // inform TD observers
        this.observablesTDChange.next(this.getThingDescription());

        return this;
    }

    /** @inheritDoc */
    removeProperty(propertyName: string): WoT.ExposedThing {
        this.interactionObservables.get(propertyName).complete();
        this.interactionObservables.delete(propertyName);
        this.propertyStates.delete(propertyName);
        this.removeResourceListener("/" + encodeURIComponent(this.name) + "/properties/" + encodeURIComponent(propertyName));

        // inform TD observers
        this.observablesTDChange.next(this.getThingDescription());

        return this;
    }

    /** @inheritDoc */
    removeAction(actionName: string): WoT.ExposedThing {
        this.actionStates.delete(actionName);
        this.removeResourceListener("/" + encodeURIComponent(this.name) + "/actions/" + encodeURIComponent(actionName));

        // inform TD observers
        this.observablesTDChange.next(this.getThingDescription());

        return this;
    }

    /** @inheritDoc */
    removeEvent(eventName: string): WoT.ExposedThing {
        this.interactionObservables.get(eventName).complete();
        this.interactionObservables.delete(eventName);
        this.removeResourceListener("/" + encodeURIComponent(this.name) + "/events/" + encodeURIComponent(eventName));

        // inform TD observers
        this.observablesTDChange.next(this.getThingDescription());

        return this;
    }

    /** @inheritDoc */
    setActionHandler(actionName: string, action: WoT.ActionHandler): WoT.ExposedThing {
        console.log(`ExposedThing '${this.name}' setting action Handler for '${actionName}'`);
        let state = this.actionStates.get(actionName);
        if (state) {
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
