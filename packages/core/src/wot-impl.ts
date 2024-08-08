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
import { ThingModel } from "wot-thing-model-types";
import { parseTD } from "./serdes";
import Servient from "./servient";
import ExposedThing from "./exposed-thing";
import ConsumedThing from "./consumed-thing";
import Helpers from "./helpers";
import { createLoggers } from "./logger";
import ContentManager from "./content-serdes";
import { getLastValidationErrors, isThingDescription } from "./validation";
import { inspect } from "util";

const { debug } = createLoggers("core", "wot-impl");

class ThingDiscoveryProcess implements WoT.ThingDiscoveryProcess {
    constructor(private directory: ConsumedThing, public filter?: WoT.ThingFilter) {
        this.filter = filter;
        this.done = false;
    }

    done: boolean;
    error?: Error | undefined;
    async stop(): Promise<void> {
        this.done = true;
    }

    async *[Symbol.asyncIterator](): AsyncIterator<WoT.ThingDescription> {
        let rawThingDescriptions: WoT.ThingDescription[];
        try {
            const thingsPropertyOutput = await this.directory.readProperty("things");
            rawThingDescriptions = (await thingsPropertyOutput.value()) as WoT.ThingDescription[];
        } catch (error) {
            this.error = error instanceof Error ? error : new Error(inspect(error));
            this.done = true;
            return;
        }

        for (const outputValue of rawThingDescriptions) {
            if (this.done) {
                return;
            }

            if (!isThingDescription(outputValue)) {
                this.error = getLastValidationErrors();
                continue;
            }

            yield outputValue;
        }

        this.done = true;
    }
}

export default class WoTImpl {
    private srv: Servient;
    constructor(srv: Servient) {
        this.srv = srv;
    }

    /** @inheritDoc */
    async discover(filter?: WoT.ThingFilter): Promise<WoT.ThingDiscoveryProcess> {
        throw new Error("not implemented");
    }

    /** @inheritDoc */
    async exploreDirectory(url: string, filter?: WoT.ThingFilter): Promise<WoT.ThingDiscoveryProcess> {
        const directoryThingDescription = await this.requestThingDescription(url);
        const consumedDirectory = await this.consume(directoryThingDescription);

        return new ThingDiscoveryProcess(consumedDirectory, filter);
    }

    /** @inheritDoc */
    async requestThingDescription(url: string): Promise<WoT.ThingDescription> {
        const uriScheme = Helpers.extractScheme(url);
        const client = this.srv.getClientFor(uriScheme);
        const content = await client.requestThingDescription(url);
        const value = ContentManager.contentToValue({ type: content.type, body: await content.toBuffer() }, {});

        if (isThingDescription(value)) {
            return value;
        }

        throw getLastValidationErrors();
    }

    /** @inheritDoc */
    async consume(td: WoT.ThingDescription): Promise<ConsumedThing> {
        try {
            const thing = parseTD(JSON.stringify(td), true);
            const newThing: ConsumedThing = new ConsumedThing(this.srv, thing as ThingModel);

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
