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

import * as TD from "@node-wot/td-tools";

import { ResourceListener, Content } from "./protocol-interfaces";
import BasicResourceListener from "./basic-resource-listener";
import ExposedThing from "../exposed-thing";
import ContentSerdes from "../content-serdes";

/**
 * Interaction resource that provides an Action
 */
export default class ActionResourceListener extends BasicResourceListener implements ResourceListener {

    public readonly name : string;
    private readonly thing : ExposedThing;

    constructor(thing: ExposedThing, name: string) {
        super();
        this.thing = thing;
        this.name = name;
    }

    public getType(): string {
        return "Action";
    }

    public onInvoke(input: Content): Promise<Content> {

        // TODO the first part should fully validate input based on this.thing.actions[this.name].input
        let param;
        // FIXME: Better way than creating Promise only for reject in catch?
        try {
            param = ContentSerdes.contentToValue(input, this.thing.actions[this.name].input);
        } catch(err) {
            return new Promise<Content>( (resolve, reject) => { reject(err); })
        }

        return this.thing.actions[this.name].invoke(param).then((output) => {
            // TODO? check with this.thing.actions[this.name].output and spit warning?
            if (output === undefined) {
                // action without output - skip ContentSerdes
                return { contentType: null, body: null };
            } else {
                return ContentSerdes.valueToContent(output);
            }
        });
    }
}
