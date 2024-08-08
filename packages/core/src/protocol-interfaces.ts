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

import { Subscription } from "rxjs/Subscription";

import { Form, SecurityScheme } from "./thing-description";
import Servient from "./servient";
import ExposedThing from "./exposed-thing";
import { Content } from "./content";

export type PropertyContentMap = Map<string, Content>;

export type ContentListener = (data: Content) => void;

export type PropertyHandlers = {
    readHandler?: WoT.PropertyReadHandler;
    writeHandler?: WoT.PropertyWriteHandler;
    observeHandler?: WoT.PropertyReadHandler;
    unobserveHandler?: WoT.PropertyReadHandler;
};
export type PropertyHandlerMap = Map<string, PropertyHandlers>;
export type ActionHandlerMap = Map<string, WoT.ActionHandler>;

export type EventHandlers = {
    subscribe?: WoT.EventSubscriptionHandler;
    unsubscribe?: WoT.EventSubscriptionHandler;
};
export type EventHandlerMap = Map<string, EventHandlers>;

export type ListenerItem = {
    [formIndex: number]: ContentListener[];
};

export type ListenerMap = Map<string, ListenerItem>;

export interface ProtocolClient {
    /** this client is requested to perform a "read" on the resource with the given URI */
    readResource(form: Form): Promise<Content>;

    /** this client is requested to perform a "write" on the resource with the given URI  */
    writeResource(form: Form, content: Content): Promise<void>;

    /** this client is requested to perform an "invoke" on the resource with the given URI */
    invokeResource(form: Form, content?: Content): Promise<Content>;

    /** this client is requested to perform an "unlink" on the resource with the given URI */
    unlinkResource(form: Form): Promise<void>;

    subscribeResource(
        form: Form,
        next: (content: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ): Promise<Subscription>;

    /**
     * Requests a single Thing Description from a given {@link uri}.
     *
     * The result is returned asynchronously as {@link Content}, which has to
     * be deserialized and validated by the upper layers of the implementation.
     *
     * @param uri
     */
    requestThingDescription(uri: string): Promise<Content>;

    /** start the client (ensure it is ready to send requests) */
    start(): Promise<void>;
    /** stop the client */
    stop(): Promise<void>;

    /** apply TD security metadata */
    setSecurity(metadata: Array<SecurityScheme>, credentials?: unknown): boolean;
}

export interface ProtocolClientFactory {
    readonly scheme: string;
    getClient(): ProtocolClient;
    init(): boolean;
    destroy(): boolean;
}

export interface ProtocolServer {
    readonly scheme: string;
    expose(thing: ExposedThing, tdTemplate?: WoT.ThingDescription): Promise<void>;
    /**
     * @param thingId: id of the thing to destroy
     * @returns true if the thing was found and destroyed; false if the thing was not found
     * @throws if the binding couldn't destroy the thing
     **/
    destroy(thingId: string): Promise<boolean>;
    start(servient: Servient): Promise<void>;
    stop(): Promise<void>;
    getPort(): number;
}

export enum Endianness {
    BIG_ENDIAN = "BIG_ENDIAN",
    LITTLE_ENDIAN = "LITTLE_ENDIAN",
    BIG_ENDIAN_BYTE_SWAP = "BIG_ENDIAN_BYTE_SWAP",
    LITTLE_ENDIAN_BYTE_SWAP = "LITTLE_ENDIAN_BYTE_SWAP",
}
