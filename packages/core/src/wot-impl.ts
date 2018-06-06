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

import { Observable } from "rxjs/Observable";
import * as WoT from "wot-typescript-definitions";

import * as TD from "@node-wot/td-tools";

import Servient from "./servient";
import ExposedThing from "./exposed-thing";
import ConsumedThing from "./consumed-thing";
import * as Helpers from "./helpers";

export default class WoTImpl implements WoT.WoTFactory {
    private srv: Servient;

    constructor(srv: Servient) {
        this.srv = srv;
    }

    /** @inheritDoc */
    discover(filter?: WoT.ThingFilter): Observable<WoT.ConsumedThing> {
        return new Observable<ConsumedThing>(subscriber => {
            //find things
            //for each found thing
            //subscriber.next(thing);
            subscriber.complete();
        });
    }

    /** @inheritDoc */
    fetch(uri: USVString): Promise<WoT.ThingDescription> {
        return new Promise<WoT.ThingDescription>((resolve, reject) => {
            let client = this.srv.getClientFor(Helpers.extractScheme(uri));
            console.info(`WoTImpl fetching TD from '${uri}' with ${client}`);
            client.readResource(new TD.InteractionForm(uri, "application/ld+json"))
                .then((content) => {
                    if (content.mediaType !== "application/ld+json") {
                        console.warn(`WoTImpl parsing TD from '${content.mediaType}' media type`);
                    }
                    client.stop();
                    resolve(content.body.toString());
                })
                .catch((err) => { console.error(err); });
        });
    }

    /** @inheritDoc */
    consume(td: WoT.ThingDescription): WoT.ConsumedThing {

        let trimmedTD = td.trim();

        if (td[0]!=='{') {
            throw new Error("WoT.consume() takes a Thing Description. Use WoT.fetch() for URIs.");
        }

        let newThing = new ConsumedThing(this.srv, td);
        console.info(`WoTImpl consuming TD ${newThing.id ? "'"+newThing.id+"'" : "without @id"} for ConsumedThing '${newThing.name}'`);
        return newThing;
    }

    /**
     * Very hacky way to do an interface type check with Typescript
     * https://stackoverflow.com/questions/14425568/interface-type-check-with-typescript
     */
    isWoTThingDescription(arg: any): arg is WoT.ThingDescription {
        return arg.length !== undefined;
    }
    isWoTThingTemplate(arg: any): arg is WoT.ThingTemplate {
        return arg.name !== undefined;
    }

    /**
     * create a new Thing
     *
     * @param name name/identifier of the thing to be created
     */
    produce(model: WoT.ThingModel): WoT.ExposedThing {
        let td: WoT.ThingDescription = null;
        if (this.isWoTThingDescription(model)) {
            td = model;
        } else if (this.isWoTThingTemplate(model)) {
            // FIXME WoT.ThingTempalte should be compatible to ThingDescription object and carry more than just name
            //let tdObj = new TD.Thing();
            //tdObj.name = model.name;
            //td = TDParser.serializeTD(tdObj);
            // TODO for now `name` is the only element defined
            td = `{"name": "${model.name}"}`;
        } else {
            throw new Error("WoTImpl could not create Thing because of unknown model argument " + model);
        }

        let newThing = new ExposedThing(this.srv, td);
        console.info(`WoTImpl producing new ExposedThing '${newThing.name}'`);

        if (this.srv.addThing(newThing)) {
            return newThing;
        } else {
            throw new Error("Thing already exists: " + newThing.name);
        }
    }
}
