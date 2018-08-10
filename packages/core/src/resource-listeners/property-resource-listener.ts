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

import {Content,ResourceListener} from "./protocol-interfaces"
import BasicResourceListener from "./basic-resource-listener";
import ExposedThing from "../exposed-thing";
import ContentSerdes from "../content-serdes";

/**
 * Interaction resource that provides a Property
 */
export default class PropertyResourceListener extends BasicResourceListener implements ResourceListener {

    public readonly name : string;
    private readonly thing : ExposedThing;

    constructor(thing : ExposedThing, name: string) {
        super();
        this.thing = thing;
        this.name = name;
    }

    public getType(): string {
        return "Property";
    }

    public onRead() : Promise<Content> {
        // return this.thing.readProperty(this.name)
        return this.thing.properties[this.name].read()
            .then((value) => {
                let content = ContentSerdes.valueToContent(value);
                return Promise.resolve(content);
            });
    }

    public onWrite(input: Content): Promise<void> {
        let value;
        // check if writable
        if (this.thing.properties[this.name].writable !== true) {
            return new Promise<void>((resolve, reject) => { reject(new Error(`Property '${this.name}' is not writable`)); });
        }

        // TODO this second part should fully validate input based on this.thing.properties[this.name]
        // FIXME Better way than creating Promise only for reject in catch?
        try {
            // FIXME cast to any not good, but WoT.DataSchema cannot be implemented...
            value = ContentSerdes.contentToValue(input, <any>this.thing.properties[this.name]);
        } catch (err) {
            return new Promise<void>((resolve, reject) => { reject(err); });
        }
        // return this.thing.writeProperty(this.name, value);
        return this.thing.properties[this.name].write(value);
    }
}
