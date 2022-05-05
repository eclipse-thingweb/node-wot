/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
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

import * as os from "os";

// imports for fetchTD
import Servient from "./servient";
import * as TD from "@node-wot/td-tools";
import { ContentSerdes } from "./content-serdes";
import { ProtocolHelpers } from "./core";
import Ajv, { ValidateFunction, ErrorObject } from "ajv";
import TDSchema from "wot-thing-description-types/schema/td-json-schema-validation.json";
import { DataSchemaValue, ExposedThingInit } from "wot-typescript-definitions";
import { SomeJSONSchema } from "ajv/dist/types/json-schema";
import { ThingInteraction, ThingModelHelpers } from "@node-wot/td-tools";
import { Resolver } from "@node-wot/td-tools/src/resolver-interface";

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
export default class Helpers implements Resolver {
    static tsSchemaValidator = ajv.compile(Helpers.createExposeThingInitSchema(tdSchema)) as ValidateFunction;

    private srv: Servient;

    constructor(srv: Servient) {
        this.srv = srv;
    }

    private static staticAddress: string = undefined;

    public static extractScheme(uri: string): string {
        const parsed = new URL(uri);
        // console.log(parsed)
        // remove trailing ':'
        if (parsed.protocol === null) {
            throw new Error(`Protocol in url "${uri}" must be valid`);
        }
        const scheme = parsed.protocol.slice(0, -1);
        console.debug("[core/helpers]", `Helpers found scheme '${scheme}'`);
        return scheme;
    }

    public static setStaticAddress(address: string): void {
        Helpers.staticAddress = address;
    }

    public static getAddresses(): Array<string> {
        const addresses: Array<string> = [];

        if (Helpers.staticAddress !== undefined) {
            addresses.push(Helpers.staticAddress);

            console.debug("[core/helpers]", `AddressHelper uses static ${addresses}`);
            return addresses;
        } else {
            const interfaces = os.networkInterfaces();

            for (const iface in interfaces) {
                interfaces[iface].forEach((entry) => {
                    console.debug("[core/helpers]", `AddressHelper found ${entry.address}`);
                    if (entry.internal === false) {
                        if (entry.family === "IPv4") {
                            addresses.push(entry.address);
                        } else if (entry.scopeid === 0) {
                            addresses.push(Helpers.toUriLiteral(entry.address));
                        }
                    }
                });
            }

            // add localhost only if no external addresses
            if (addresses.length === 0) {
                addresses.push("localhost");
            }

            console.debug("[core/helpers]", `AddressHelper identified ${addresses}`);

            return addresses;
        }
    }

    public static toUriLiteral(address: string): string {
        // Due to crash logged with:
        // TypeError: Cannot read property 'indexOf' of undefined at Function.Helpers.toUriLiteral
        if (!address) {
            console.error("[core/helpers]", `AddressHelper received invalid address '${address}'`);
            return "{invalid address}";
        }

        if (address.indexOf(":") !== -1) {
            address = `[${address}]`;
        }
        return address;
    }

    public static generateUniqueName(name: string): string {
        const suffix = name.match(/.+_([0-9]+)$/);
        if (suffix !== null) {
            return name.slice(0, -suffix[1].length) + (1 + parseInt(suffix[1]));
        } else {
            return name + "_2";
        }
    }

    public static toStringArray(input: string[] | string): string[] {
        if (input) {
            if (typeof input === "string") {
                return [input];
            } else {
                return input;
            }
        } else {
            return [];
        }
    }

    // TODO: specialize fetch to retrieve just thing descriptions
    public fetch(uri: string): Promise<unknown> {
        return new Promise<unknown>((resolve, reject) => {
            const client = this.srv.getClientFor(Helpers.extractScheme(uri));
            console.debug("[core/helpers]", `WoTImpl fetching TD from '${uri}' with ${client}`);
            client
                .readResource(new TD.Form(uri, ContentSerdes.TD))
                .then(async (content) => {
                    if (content.type !== ContentSerdes.TD && content.type !== ContentSerdes.JSON_LD) {
                        console.warn(
                            "[core/helpers]",
                            `WoTImpl received TD with media type '${content.type}' from ${uri}`
                        );
                    }

                    const td = (await ProtocolHelpers.readStreamFully(content.body)).toString("utf-8");

                    try {
                        const jo = JSON.parse(td);
                        resolve(jo);
                    } catch (err) {
                        reject(new Error(`WoTImpl fetched invalid JSON from '${uri}': ${err.message}`));
                    }
                })
                .then(async (td) => {
                    await client.stop();
                    return td;
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }

    /**
     *  helper function to extend class
     */
    public static extend<T, U>(first: T, second: U): T & U {
        const result = <T & U>{};
        for (const id in first) {
            (<Record<string, unknown>>result)[id] = (<Record<string, unknown>>first)[id];
        }
        for (const id in second) {
            if (!Object.prototype.hasOwnProperty.call(result, id)) {
                (<Record<string, unknown>>result)[id] = (<Record<string, unknown>>second)[id];
            }
        }
        return result;
    }

    public static async parseInteractionOutput(response: WoT.InteractionOutput): Promise<DataSchemaValue> {
        let value;
        try {
            value = await response.value();
        } catch (err) {
            // TODO if response.value() fails, try low-level stream read
            console.error("[core/helpers]", "parseInteractionOutput low-level stream not implemented");
        }
        return value;
    }

    /**
     * Helper function to remove reserved keywords in required property of TD JSON Schema
     */
    static createExposeThingInitSchema(tdSchema: unknown): SomeJSONSchema {
        const tdSchemaCopy = JSON.parse(JSON.stringify(tdSchema));

        if (tdSchemaCopy.required !== undefined) {
            const reservedKeywords: Array<string> = [
                "title",
                "@context",
                "instance",
                "forms",
                "security",
                "href",
                "securityDefinitions",
            ];
            if (Array.isArray(tdSchemaCopy.required)) {
                const reqProps: Array<string> = tdSchemaCopy.required;
                tdSchemaCopy.required = reqProps.filter((n) => !reservedKeywords.includes(n));
            } else if (typeof tdSchemaCopy.required === "string") {
                if (reservedKeywords.indexOf(tdSchemaCopy.required) !== -1) delete tdSchemaCopy.required;
            }
        }

        if (tdSchemaCopy.definitions !== undefined) {
            for (const prop in tdSchemaCopy.definitions) {
                tdSchemaCopy.definitions[prop] = this.createExposeThingInitSchema(tdSchemaCopy.definitions[prop]);
            }
        }

        return tdSchemaCopy;
    }

    /**
     * Helper function to validate an ExposedThingInit
     */
    public static validateExposedThingInit(data: ExposedThingInit): { valid: boolean; errors: string } {
        if (data["@type"] === "tm:ThingModel" || ThingModelHelpers.isThingModel(data)) {
            return {
                valid: false,
                errors: "ThingModel declaration is not supported",
            };
        }
        const isValid = Helpers.tsSchemaValidator(data);
        let errors;
        if (!isValid) {
            errors = Helpers.tsSchemaValidator.errors.map((o: ErrorObject) => o.message).join("\n");
        }
        return {
            valid: isValid,
            errors: errors,
        };
    }

    /**
     * Merge Thing-level's uriVariables to Interaction-level ones.
     * If a uriVariable is already defined at the Interaction-level, ignore its value at Thing-level.
     * @throws if InteractionOptions contains illegal uriVariables
     * @param options interaction options
     * @returns resulting InteractionOptions
     */
    public static parseInteractionOptions(
        thing: TD.Thing,
        ti: ThingInteraction,
        options?: WoT.InteractionOptions
    ): WoT.InteractionOptions {
        if (!this.validateInteractionOptions(thing, ti, options)) {
            throw new Error(
                `CoreHelpers one or more uriVariables were not found under neither '${ti.title}' Thing Interaction nor '${thing.title}' Thing`
            );
        }

        const interactionUriVariables = ti.uriVariables ?? {};
        const thingUriVariables = thing.uriVariables ?? {};
        const uriVariables: { [key: string]: unknown } = {};

        if (options?.uriVariables) {
            const entryVariables = Object.entries(options.uriVariables);
            entryVariables.forEach((entry: [string, unknown]) => {
                if (entry[0] in interactionUriVariables) {
                    uriVariables[entry[0]] = entry[1];
                }
            });
        } else {
            options = { uriVariables: {} };
        }

        for (const varKey in thingUriVariables) {
            const varValue = thingUriVariables[varKey];

            if (!(varKey in uriVariables) && "default" in varValue) {
                uriVariables[varKey] = varValue.default;
            }
        }

        options.uriVariables = uriVariables;
        return options;
    }

    public static validateInteractionOptions(
        thing: TD.Thing,
        ti: ThingInteraction,
        options?: WoT.InteractionOptions
    ): boolean {
        const interactionUriVariables = ti.uriVariables ?? {};
        const thingUriVariables = thing.uriVariables ?? {};

        if (options?.uriVariables) {
            const entryVariables = Object.entries(options.uriVariables);
            for (let i = 0; i < entryVariables.length; i++) {
                const entryVariable: [string, unknown] = entryVariables[i];
                if (!(entryVariable[0] in interactionUriVariables) && !(entryVariable[0] in thingUriVariables)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Parse URL query parameters and validate them against both locally and globally-declared uriVariables
     * @param url request url
     * @param globalUriVariables thing-level uriVariables
     * @param uriVariables interaction-level uriVariables
     * @returns merged and validated uriVariables
     */
    static parseUrlParameters(
        url: string,
        globalUriVariables: { [key: string]: TD.DataSchema },
        uriVariables: { [key: string]: TD.DataSchema }
    ): Record<string, unknown> {
        const params: Record<string, unknown> = {};
        if (url == null || (!uriVariables && !globalUriVariables)) {
            return params;
        }

        const queryparams = url.split("?")[1];
        if (queryparams == null) {
            return params;
        }
        const queries = queryparams.indexOf("&") !== -1 ? queryparams.split("&") : [queryparams];

        queries.forEach((indexQuery: string) => {
            const indexPair = indexQuery.split("=");

            const queryKey: string = decodeURIComponent(indexPair[0]);
            const queryValue: string = decodeURIComponent(indexPair.length > 1 ? indexPair[1] : "");

            if (uriVariables && uriVariables[queryKey]) {
                if (uriVariables[queryKey].type === "integer" || uriVariables[queryKey].type === "number") {
                    // *cast* it to number
                    params[queryKey] = +queryValue;
                } else {
                    params[queryKey] = queryValue;
                }
            } else if (globalUriVariables && globalUriVariables[queryKey]) {
                if (globalUriVariables[queryKey].type === "integer" || globalUriVariables[queryKey].type === "number") {
                    // *cast* it to number
                    params[queryKey] = +queryValue;
                } else {
                    params[queryKey] = queryValue;
                }
            }
        });

        return params;
    }
}
