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
import { ThingModelHelpers, Resolver } from "@thingweb/thing-model";
import { Form, Thing, ThingInteraction } from "./thing-description";
import * as TDT from "wot-thing-description-types";
import { ContentSerdes } from "./content-serdes";
import Ajv, { ValidateFunction, ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import TDSchema from "wot-thing-description-types/schema/td-json-schema-validation.json";
import { DataSchemaValue, ExposedThingInit } from "wot-typescript-definitions";
import { SomeJSONSchema } from "ajv/dist/types/json-schema";
import { PropertyElement, DataSchema } from "wot-thing-description-types";
import { createLoggers } from "./logger";

const { debug, error, warn } = createLoggers("core", "helpers");

const tdSchema = TDSchema;
// RegExps take from https://github.com/ajv-validator/ajv-formats/blob/master/src/formats.ts
const ajv = new Ajv({ strict: false });
addFormats(ajv);

export default class Helpers implements Resolver {
    static tsSchemaValidator = ajv.compile(Helpers.createExposeThingInitSchema(tdSchema)) as ValidateFunction;

    private srv: Servient;

    constructor(srv: Servient) {
        this.srv = srv;
    }

    private static staticAddress?: string = undefined;

    public static extractScheme(uri: string): string {
        const parsed = new URL(uri);
        debug(parsed);
        // remove trailing ':'
        if (parsed.protocol === null) {
            throw new Error(`Protocol in url "${uri}" must be valid`);
        }
        const scheme = parsed.protocol.slice(0, -1);
        debug(`Helpers found scheme '${scheme}'`);
        return scheme;
    }

    public static setStaticAddress(address: string): void {
        Helpers.staticAddress = address;
    }

    public static getAddresses(): Array<string> {
        const addresses: Array<string> = [];

        if (Helpers.staticAddress !== undefined) {
            addresses.push(Helpers.staticAddress);

            debug(`AddressHelper uses static ${addresses}`);
            return addresses;
        } else {
            const interfaces = os.networkInterfaces();

            for (const iface of Object.values(interfaces)) {
                iface?.forEach((entry) => {
                    debug(`AddressHelper found ${entry.address}`);
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

            debug(`AddressHelper identified ${addresses}`);

            return addresses;
        }
    }

    public static toUriLiteral(address?: string): string {
        // Due to crash logged with:
        // TypeError: Cannot read property 'indexOf' of undefined at Function.Helpers.toUriLiteral
        if (address == null) {
            error(`AddressHelper received invalid address '${address}'`);
            return "{invalid address - undefined}";
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

    public static toStringArray(input: string[] | string | undefined): string[] {
        if (input != null) {
            if (typeof input === "string") {
                return [input];
            } else {
                return input;
            }
        } else {
            return [];
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static structuredClone<T = any>(value: T): T {
        // TODO built-in structuredClone() still seems to cause issues
        // see for example https://github.com/eclipse-thingweb/node-wot/issues/1252
        // return structuredClone(value); // Note: use in future
        return JSON.parse(JSON.stringify(value));
    }

    // TODO: specialize fetch to retrieve just thing descriptions
    // see https://github.com/eclipse-thingweb/node-wot/issues/1055
    public fetch(uri: string): Promise<unknown> {
        return new Promise<unknown>((resolve, reject) => {
            const client = this.srv.getClientFor(Helpers.extractScheme(uri));
            debug(`WoTImpl fetching TD from '${uri}' with ${client}`);
            client
                .readResource(new Form(uri, ContentSerdes.TD))
                .then(async (content) => {
                    if (content.type !== ContentSerdes.TD && content.type !== ContentSerdes.JSON_LD) {
                        warn(`WoTImpl received TD with media type '${content.type}' from ${uri}`);
                    }

                    const td = (await content.toBuffer()).toString("utf-8");

                    try {
                        const jo = JSON.parse(td);
                        resolve(jo);
                    } catch (err) {
                        reject(
                            new Error(
                                `WoTImpl fetched invalid JSON from '${uri}': ${
                                    err instanceof Error ? err.message : err
                                }`
                            )
                        );
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
        for (const [id, value] of Object.entries(first as Record<string, unknown>)) {
            (<Record<string, unknown>>result)[id] = value;
        }
        for (const [id, value] of Object.entries(second as Record<string, unknown>)) {
            if (!Object.prototype.hasOwnProperty.call(result, id)) {
                (<Record<string, unknown>>result)[id] = value;
            }
        }
        return result;
    }

    public static async parseInteractionOutput(response: WoT.InteractionOutput): Promise<DataSchemaValue> {
        try {
            return await response.value();
        } catch (err) {
            // TODO if response.value() fails, try low-level stream read
            error("parseInteractionOutput low-level stream not implemented");
            throw new Error("parseInteractionOutput low-level stream not implemented");
        }
    }

    /**
     * Helper function to remove reserved keywords in required property of TD JSON Schema
     */
    static createExposeThingInitSchema(tdSchema: unknown): SomeJSONSchema {
        const tdSchemaCopy = Helpers.structuredClone(tdSchema) as SomeJSONSchema;

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

        if (tdSchemaCopy.definitions != null) {
            for (const [prop, propValue] of Object.entries(tdSchemaCopy.definitions) ?? []) {
                tdSchemaCopy.definitions[prop] = this.createExposeThingInitSchema(propValue);
            }
        }

        return tdSchemaCopy;
    }

    /**
     * Helper function to validate an ExposedThingInit
     */
    public static validateExposedThingInit(data: ExposedThingInit): { valid: boolean; errors?: string } {
        if (data["@type"] === "tm:ThingModel" || ThingModelHelpers.isThingModel(data) === true) {
            return {
                valid: false,
                errors: "ThingModel declaration is not supported",
            };
        }
        const isValid = Helpers.tsSchemaValidator(data);
        let errors;
        if (!isValid) {
            errors = Helpers.tsSchemaValidator.errors?.map((o: ErrorObject) => o.message).join("\n");
        }
        return {
            valid: isValid,
            errors,
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
        thing: TDT.ThingDescription,
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
                } else if (entry[0] in thingUriVariables) {
                    uriVariables[entry[0]] = entry[1];
                }
            });
        } else {
            options = { uriVariables: {} };
        }

        for (const [varKey, varValue] of Object.entries(thingUriVariables)) {
            if (!(varKey in uriVariables) && "default" in varValue) {
                uriVariables[varKey] = varValue.default;
            }
        }

        options.uriVariables = uriVariables;
        return options;
    }

    public static validateInteractionOptions(
        thing: Thing,
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
        url: string | undefined,
        globalUriVariables: { [key: string]: DataSchema } = {},
        uriVariables: { [k: string]: DataSchema } = {}
    ): Record<string, unknown> {
        const params: Record<string, unknown> = {};
        if (url == null || (uriVariables == null && globalUriVariables == null)) {
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

            if (uriVariables != null && uriVariables[queryKey] != null) {
                if (uriVariables[queryKey].type === "integer" || uriVariables[queryKey].type === "number") {
                    // *cast* it to number
                    params[queryKey] = +queryValue;
                } else {
                    params[queryKey] = queryValue;
                }
            } else if (globalUriVariables != null && globalUriVariables[queryKey] != null) {
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

    public static updateInteractionNameWithUriVariablePattern(
        interactionName: string,
        affordanceUriVariables: PropertyElement["uriVariables"] = {},
        thingUriVariables: PropertyElement["uriVariables"] = {}
    ): string {
        const encodedInteractionName = encodeURIComponent(interactionName);
        const uriVariables = [...Object.keys(affordanceUriVariables), ...Object.keys(thingUriVariables)];

        if (uriVariables.length === 0) {
            return encodedInteractionName;
        }

        const pattern = uriVariables.map(encodeURIComponent).join(",");

        return encodedInteractionName + "{?" + pattern + "}";
    }
}
