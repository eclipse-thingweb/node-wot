/********************************************************************************
 * Copyright (c) 2018 - 2021 Contributors to the Eclipse Foundation
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
 * Generic helper functions used across the code
 * These Helpers are used like this:
 * ```
 * import Helpers from "@node-wot/core"
 *
 * ...
 * Helpers.foo(bar)
 * ...
 * ```
 */

// import * as os from "os";

import Ajv, { ErrorObject } from "ajv";
import { LinkElement } from "wot-thing-description-types";
import TDSchema from "wot-thing-description-types/schema/td-json-schema-validation.json";
import { DataSchema, ExposedThingInit, ThingDescription } from "wot-typescript-definitions";
import Servient, { ExposedThing, Helpers } from "./core";
// import { DataSchemaValue, ExposedThingInit } from "wot-typescript-definitions";

const tdSchema = TDSchema;
// RegExps take from https://github.com/ajv-validator/ajv-formats/blob/master/src/formats.ts
const ajv = new Ajv({ strict: false })
    .addFormat(
        "iri-reference",
        /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i
    )
    .addFormat("uri", /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/)
    .addFormat(
        "date-time",
        /^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/
    );

export type LINK_TYPE = 'tm:extends' | 'tm:submodel';
export type AFFORDANCE_TYPE = 'properties' | 'actions' | 'events';

export default class ThingModelHelpers {
    // static tsSchemaValidator = ajv.compile(Helpers.createExposeThingInitSchema(tdSchema)) as ValidateFunction;

    private srv: Servient;

    constructor(srv: Servient) {
        this.srv = srv;
    }


    private static getThingModelRef(data: Record<string, unknown>): Record<string, unknown> {
        const refs = {} as Record<string, unknown>;
        if (!data) {
            return refs;
        }
        for (const key in data) {
            for (const key1 in (data[key] as Record<string, unknown>)) {
                if (key1 === 'tm:ref') {
                    refs[key] = (data[key] as Record<string, unknown>)['tm:ref'] as string;
                }
            }
        }
        return refs;
    }

    private static getThingModelLinks(data: Record<string, unknown>, type: LINK_TYPE): LinkElement[] {
        let links = [] as LinkElement[];
        if ('links' in data && Array.isArray(data.links)) {
            links = data.links;
        }
        return links.filter(el => el.rel === type);
    }


    public static isThingModelThingDescription(data: Record<string, unknown>): boolean {
        if (this.getThingModelRef(data).length > 0) { // FIXME: different from specifications
            return true;
        }
        if ('links' in data && Array.isArray(data.links)) {
            let foundTmExtendsRel = false;
            data.links.forEach((link) => {
                if (link.rel !== undefined && link.rel === "tm:extends") foundTmExtendsRel = true;
            });
            if (foundTmExtendsRel) return true;
        }

        if (data.properties !== undefined) {
            for (const prop in <Record<string, unknown>>data.properties) {
                const properties = <Record<string, Record<string, unknown>>>data.properties;
                if (this.isThingModelThingDescription(properties[prop])) return true;
            }
        }

        return false;
    }

    public static validateExposedThingModelInit(data: ExposedThingInit): { valid: boolean; errors: string } {
        // TODO: check also for the rest of the schema
        if (Array.isArray(data["@type"])) {
            const valid = data["@type"].filter(x => x === 'tm:ThingModel').length > 0;
            if (!valid) {
                return {
                    valid: false,
                    errors: "ThingModel missing in @type array",
                };
            }
        } else if (data["@type"] !== "tm:ThingModel") {
            return {
                valid: false,
                errors: "ThingModel missing in @type definition",
            };
        }
        return {
            valid: true,
            errors: undefined,
        };

        //  && !this.isThingModelThingDescription(data)
        //         const isValid = Helpers.tsSchemaValidator(data);
        //         let errors;
        //         if (!isValid) {
        //             errors = Helpers.tsSchemaValidator.errors.map((o: ErrorObject) => o.message).join("\n");
        //         }
        //         return {
        //             valid: isValid,
        //             errors: errors,
        //         };
    }

    public static getModelVersion(data: ExposedThingInit): string {
        if (!('version' in data) || !('model' in data.version)) {
            return null;
        }
        return data.version.model as string;
    }

    private static extendThingModel(sources: ExposedThingInit[], dest: ExposedThingInit): ExposedThingInit {
        // FIXME: make this function for a single element at time
        let extendedModel = {} as ExposedThingInit;
        for (const s of sources) { // FIFO order
            const properties = 'properties' in extendedModel ? extendedModel.properties : undefined;
            const actions = 'actions' in extendedModel ? extendedModel.actions : undefined;
            const events = 'events' in extendedModel ? extendedModel.events : undefined;
            extendedModel = { ...extendedModel, ...s };
            if (s.properties) {
                extendedModel.properties = { ...properties, ...s.properties }
            }
            if (s.actions) {
                extendedModel.actions = { ...actions, ...s.actions }
            }
            if (s.events) {
                extendedModel.events = { ...events, ...s.events }
            }
        }
        const properties = extendedModel.properties;
        const actions = extendedModel.actions;
        const events = extendedModel.events;
        console.log(extendedModel)
        extendedModel = { ...extendedModel, ...dest };
        if (properties) {
            extendedModel.properties = { ...properties, ...dest.properties };
        }
        if (actions) {
            extendedModel.actions = { ...actions, ...dest.actions };
        }
        if (events) {
            extendedModel.events = { ...events, ...dest.events };

        }
        return extendedModel;
    }

    private static importAffordance(affordanceType: AFFORDANCE_TYPE, affordanceName: string, source: DataSchema, dest: ExposedThingInit): ExposedThingInit {
        const d = dest[affordanceType][affordanceName];
        dest[affordanceType][affordanceName] = { ...source, ...d };
        return dest;
    }

    private parseTmRef(value: string): { uri: string, type: AFFORDANCE_TYPE, name: string} {
        // TODO: validate?
        const thingModelUri = value.split('#')[0];
        const affordaceUri = value.split('#')[1];
        const affordaceType = affordaceUri.split('/')[1] as AFFORDANCE_TYPE;
        const affordaceName = affordaceUri.split('/')[2];
        return { uri: thingModelUri, type: affordaceType, name: affordaceName};
    }

    private getRefAffordance(obj: { type: AFFORDANCE_TYPE, name: string }, thing: ExposedThingInit): DataSchema {
        const affordanceType = obj.type;
        const affordanceKey = obj.name;
        if (!(affordanceType in thing)) {
            return null;
        }
        const affordances = thing[affordanceType] as DataSchema;
        if (! (affordanceKey in affordances)) {
            return null;
        }
        return affordances[affordanceKey];
    }


    public async composeModel(data: ExposedThingInit): Promise<ExposedThingInit> {
        const helpers = new Helpers(this.srv);
        // const extLinks = ThingModelHelpers.getThingModelLinks(data, 'tm:extends');
        // if (extLinks.length > 0) {
        //     const sources = [] as ExposedThingInit[];
        //     for (const s of extLinks) {
        //         const source = await helpers.fetch(s.href) as ExposedThingInit;
        //         sources.push(source);
        //     }
        //     return ThingModelHelpers.extendThingModel(sources, data);
        // }
        const propRefs = ThingModelHelpers.getThingModelRef(data.properties);
        if (Object.keys(propRefs).length > 0) {
            for (const aff in propRefs) {
                const ref = propRefs[aff] as string;
                const refObj = this.parseTmRef(ref);
                const source = await helpers.fetch(refObj.uri) as ExposedThingInit;
                delete data.properties[aff]['tm:ref'];
                const importedAffordance = this.getRefAffordance(refObj, source);
                console.log(importedAffordance)
                data = ThingModelHelpers.importAffordance(refObj.type, aff, importedAffordance, data);
                // console.log(data)
            }
        }
        return data;
    }





}
