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

import BasicResourceListener from "./basic-resource-listener";
import ExposedThing from "../exposed-thing";

import {ResourceListener, Content} from "./protocol-interfaces"
import * as TD from "@node-wot/td-tools";
import ContentSerdes from "../content-serdes";
/**
 * Resource that provides a Thing Description
 */
export default class TDResourceListener extends BasicResourceListener implements ResourceListener {

    private readonly thing : ExposedThing;

    constructor(thing : ExposedThing) {
        super();
        this.thing = thing;
    }

    public getType(): string {
        return "TD";
    }

    public onRead() : Promise<Content> {
        return Promise.resolve({ mediaType: "application/ld+json", body: new Buffer(this.thing.getThingDescription()) });
    }
}
