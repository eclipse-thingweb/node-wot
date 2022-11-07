/********************************************************************************
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
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
import * as TD from "@node-wot/td-tools";
import Servient from "./servient";
import ExposedThing from "./exposed-thing";
import ConsumedThing from "./consumed-thing";
import Helpers from "./helpers";
import { ThingDescription } from "wot-thing-description-types";
import { createLoggers } from "./logger";
import ContentManager from "./content-serdes";
import ProtocolHelpers from "./protocol-helpers";

const { debug } = createLoggers("core", "wot-impl");

class ThingDiscovery {

    private servient: Servient;
    constructor(servient: Servient) {
        this.servient = servient;
    }

    async direct(url: string, filter?: WoT.ThingFilter): Promise<ThingDescription> {
        const uriScheme = new URL(url).protocol.split(":")[0];
        const client = this.servient.getClientFor(uriScheme);
        const result = await client.discoverDirectly(url);
        const data = await ProtocolHelpers.readStreamFully(result.body);

        // TODO: Add TD validation
        // FIXME: application/td+json can't be handled at the moment

        const value = ContentManager.contentToValue({ type: "application/json", body: data }, {});
        if (value instanceof Object) {
            return value as ThingDescription;
        }

        throw Error(`Could not parse Thing Description obtained from ${url}`);
    }

    // Alternative approach.
    async *directIterator(url: string, filter?: WoT.ThingFilter): AsyncGenerator<ThingDescription> {
        const uriScheme = new URL(url).protocol.split(":")[0];
        const client = this.servient.getClientFor(uriScheme);
        const result = await client.discoverDirectly(url);
        const data = await ProtocolHelpers.readStreamFully(result.body);

        // TODO: Add TD validation
        // FIXME: application/td+json can't be handled at the moment

        const value = ContentManager.contentToValue({ type: "application/json", body: data }, {});

        if (value instanceof Object) {
            yield value as ThingDescription;
        }
    }

    async *directory(url: string, filter?: WoT.ThingFilter): AsyncGenerator<ThingDescription> {
        // Not implemented, do nothing
    }
}

/**
 * wot-type-definitions does not contain a implementation of Discovery method enums
 * so we need to create them here. Sadly, we should keep this enum in sync with
 * WoT.DiscoveryMethod
 */
export enum DiscoveryMethod {
    /** does not provide any restriction */
    "any",
    /** for discovering Things defined in the same device */
    "local",
    /** for discovery based on a service provided by a directory or repository of Things  */
    "directory",
    /** for discovering Things in the device's network by using a supported multicast protocol  */
    "multicast",
}

export default class WoTImpl {
    private srv: Servient;
    DiscoveryMethod: typeof WoT.DiscoveryMethod;

    discovery: ThingDiscovery;

    constructor(srv: Servient) {
        this.srv = srv;
        // force casting cause tsc does not allow to use DiscoveryMethod as WoT.DiscoveryMethod even if they are the same
        this.DiscoveryMethod = DiscoveryMethod as unknown as typeof WoT.DiscoveryMethod;

        this.discovery = new ThingDiscovery(srv);
    }

    discover(filter?: WoT.ThingFilter): WoT.ThingDiscovery {
        throw new Error("REMOVE ME.");
    }

    /** @inheritDoc */
    async consume(td: WoT.ThingDescription): Promise<ConsumedThing> {
        try {
            const thing = TD.parseTD(JSON.stringify(td), true);
            const newThing: ConsumedThing = new ConsumedThing(this.srv, thing);

            debug(
                `WoTImpl consuming TD ${
                    newThing.id != null ? `'${newThing.id}'` : "without id"
                } to instantiate ConsumedThing '${newThing.title}'`
            );
            return newThing;
        } catch (err) {
            throw new Error(`Cannot consume TD because ${err instanceof Error ? err.message : err}`);
        }
    }

    /**
     * create a new Thing
     *
     * @param title title/identifier of the thing to be created
     */
    produce(init: WoT.ExposedThingInit): Promise<WoT.ExposedThing> {
        return new Promise<WoT.ExposedThing>((resolve, reject) => {
            try {
                const validated = Helpers.validateExposedThingInit(init);

                if (!validated.valid) {
                    throw new Error("Thing Description JSON schema validation failed:\n" + validated.errors);
                }

                const newThing = new ExposedThing(this.srv, init);

                debug(`WoTImpl producing new ExposedThing '${newThing.title}'`);

                if (this.srv.addThing(newThing)) {
                    resolve(newThing);
                } else {
                    throw new Error("Thing already exists: " + newThing.title);
                }
            } catch (err) {
                reject(
                    new Error(`Cannot produce ExposedThing because " + ${err instanceof Error ? err.message : err}`)
                );
            }
        });
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
    null = "null",
}
