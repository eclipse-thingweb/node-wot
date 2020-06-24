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

import { Observable } from "rxjs/Observable";
import * as WoT from "wot-typescript-definitions";

import * as TD from "@node-wot/td-tools";

import Servient from "./servient";
import ExposedThing from "./exposed-thing";
import ConsumedThing from "./consumed-thing";
import Helpers from "./helpers";
import { ContentSerdes } from "./content-serdes";

export default class WoTImpl implements WoT.WoT {
    private srv: Servient;

    constructor(srv: Servient) {
        this.srv = srv;
    }

    /** @inheritDoc */
    discover(filter?: WoT.ThingFilter): WoT.ThingDiscovery {
        return new ThingDiscoveryImpl(filter);
    }

    /** @inheritDoc */
    consume(td: WoT.ThingDescription): Promise<WoT.ConsumedThing> {
        return new Promise<WoT.ConsumedThing>((resolve, reject) => {
            try {
                let thing: TD.Thing;
                thing = TD.parseTD(JSON.stringify(td), true);
                let newThing: ConsumedThing = Helpers.extend(thing, new ConsumedThing(this.srv));

                newThing.extendInteractions();

                console.debug("[core/wot-impl]",`WoTImpl consuming TD ${newThing.id ? "'" + newThing.id + "'" : "without id"} to instantiate ConsumedThing '${newThing.title}'`);
                resolve(newThing);
            } catch (err) {
                reject(new Error("Cannot consume TD because " + err.message));
            }
        });
    }

    // Note: copy from td-parser.ts 
    addDefaultLanguage(thing: any) {
        // add @language : "en" if no @language set
        if (Array.isArray(thing["@context"])) {
            let arrayContext: Array<any> = thing["@context"];
            let languageSet = false;
            for (let arrayEntry of arrayContext) {
                if (typeof arrayEntry == "object") {
                    if (arrayEntry["@language"] !== undefined) {
                        languageSet = true;
                    }
                }
            }
            if (!languageSet) {
                arrayContext.push({
                    "@language": TD.DEFAULT_CONTEXT_LANGUAGE
                });
            }
        }
    }

    /**
     * create a new Thing
     *
     * @param title title/identifier of the thing to be created
     */
    produce(td: WoT.ThingDescription): Promise<WoT.ExposedThing> {
        return new Promise<WoT.ExposedThing>((resolve, reject) => {
            try {
                let newThing: ExposedThing;

                // FIXME should be constrained version that omits instance-specific parts (but keeps "id")
                let template = td;
                this.addDefaultLanguage(template);
                newThing = Helpers.extend(template, new ExposedThing(this.srv));

                // augment Interaction descriptions with interactable functions
                newThing.extendInteractions();

                console.debug("[core/servient]",`WoTImpl producing new ExposedThing '${newThing.title}'`);

                if (this.srv.addThing(newThing)) {
                    resolve(newThing);
                } else {
                    throw new Error("Thing already exists: " + newThing.title);
                }
            } catch (err) {
                reject(new Error("Cannot produce ExposedThing because " + err.message));
            }
        });
    }
}

export enum DiscoveryMethod {
    /** does not provide any restriction */
    "any",
    /** for discovering Things defined in the same device */
    "local",
    /** for discovery based on a service provided by a directory or repository of Things  */
    "directory",
    /** for discovering Things in the device's network by using a supported multicast protocol  */
    "multicast"
}

export class ThingDiscoveryImpl implements WoT.ThingDiscovery {
    filter?: WoT.ThingFilter;
    active: boolean;
    done: boolean;
    error?: Error;
    constructor(filter?: WoT.ThingFilter) {
        this.filter = filter ? filter : null;
        this.active = false;
        this.done = false;
        this.error = new Error("not implemented");
    }

    start(): void {
        this.active = true;
    }
    next(): Promise<WoT.ThingDescription> {
        return new Promise<WoT.ThingDescription>((resolve, reject) => {
            reject(this.error); // not implemented
        });
    }
    stop(): void {
        this.active = false;
        this.done = false;
    }
}


/** Instantiation of the WoT.DataType declaration */
export enum DataType {
    boolean = "boolean",
    number = "number",
    integer = "integer",
    string = "string",
    object = "object",
    array = "array",
    null = "null"
}
