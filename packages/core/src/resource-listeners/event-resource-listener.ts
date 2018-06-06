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

/**
 * Interaction resource that provides an Event
 */

import { Observable } from 'rxjs/Observable';
import { PartialObserver } from 'rxjs/Observer';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';

import * as TD from "@node-wot/td-tools";

import BasicResourceListener from "./basic-resource-listener";
import { ResourceListener } from "./protocol-interfaces";
import ExposedThing from "../exposed-thing";
import { ContentSerdes, Content } from "../content-serdes";

/**
 * Interaction resource that provides an Action
 */
export default class EventResourceListener extends BasicResourceListener implements ResourceListener {

    public readonly name: string;
    private readonly subject: Subject<Content>;

    constructor(name: string, subject: Subject<Content>) {
        super();
        this.name = name;
        this.subject = subject;
    }

    public getType(): string {
        return "Event";
    }

    public subscribe(obs: PartialObserver<Content>): Subscription  {
        return this.subject.subscribe(obs);
    }
}
