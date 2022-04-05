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

import Ajv, { ValidateFunction, ErrorObject } from "ajv";
import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import { JsonPlaceholderReplacer } from "json-placeholder-replacer";
import { LinkElement } from "wot-thing-description-types";
import { DataSchema, ExposedThingInit } from "wot-typescript-definitions";
import { ThingModel } from "wot-thing-model-types";
import TMSchema from "wot-thing-model-types/schema/tm-json-schema-validation.json";
import { Resolver } from "./resolver-interface";

const tmSchema = TMSchema;
// RegExps take from https://github.com/ajv-validator/ajv-formats/blob/master/src/formats.ts
const ajv = new Ajv({ strict: false })
    .addFormat(
        "iri-reference",
        /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i
    )
    .addFormat(
        "uri-reference",
        /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i
    ) // TODO: check me
    .addFormat("uri", /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/)
    .addFormat("json-pointer", /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/) // TODO: check me
    .addFormat(
        "date-time",
        /^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/
    );

export type LINK_TYPE = "tm:extends" | "tm:submodel";
export type AFFORDANCE_TYPE = "properties" | "actions" | "events";
export type COMPOSITION_TYPE = "extends" | "imports";
export type ModelImportsInput = {
    uri?: string;
    type: AFFORDANCE_TYPE;
    name: string;
};

export type CompositionOptions = {
    baseUrl?: string;
    selfComposition?: boolean;
    map?: Record<string, unknown>;
};
export type modelComposeInput = {
    extends?: ThingModel[];
    imports?: (ModelImportsInput & { affordance: DataSchema })[];
    submodel?: Record<string, ThingModel>;
};

export class ThingModelHelpers {
    static tsSchemaValidator = ajv.compile(tmSchema) as ValidateFunction;

    private deps: string[] = [] as string[];
    private resolver: Resolver = undefined;

    constructor(_resolver?: Resolver) {
        if (_resolver) {
            this.resolver = _resolver;
        }
    }

    /**
     * Checks if the input is a ThingModel.
     *
     * @param data - The record to be validated
     * @returns a boolean: true if the input is a Thing Model, false otherwise
     *
     * @experimental
     */
    public static isThingModel(_data: unknown): _data is ThingModel {
        if (_data === null || _data === undefined) {
            return false;
        }
        if (!(typeof _data === "object") || Array.isArray(_data)) {
            return false;
        }
        const data = _data as Record<string, unknown>;
        if (Array.isArray(data["@type"])) {
            const valid = data["@type"].filter((x) => x === "tm:ThingModel").length > 0;
            if (valid) {
                return true;
            }
        } else if (data["@type"] === "tm:ThingModel") {
            return true;
        }
        if (Object.keys(this.getThingModelRef(data)).length > 0) {
            // FIXME: different from specifications
            return true;
        }
        if ("links" in data && Array.isArray(data.links)) {
            const foundTmExtendsRel = data.links.find((link) => link.rel === "tm:extends");
            if (foundTmExtendsRel) return true;
        }

        if (data.properties !== undefined) {
            if (this.isThingModel(data.properties as Record<string, unknown>)) return true;
        }

        if (data.actions !== undefined) {
            if (this.isThingModel(data.actions as Record<string, unknown>)) return true;
        }

        if (data.events !== undefined) {
            if (this.isThingModel(data.events as Record<string, unknown>)) return true;
        }
        return false;
    }

    /**
     * Returns the version of the input Thing Model.
     *
     * @param data - the Thing Model where to get the version
     * @returns the version of the Thing Model as string
     *
     * @experimental
     */
    public static getModelVersion(data: ThingModel): string {
        if (!("version" in data) || !("model" in data.version)) {
            return null;
        }
        return data.version.model as string;
    }

    /**
     * Validates a Thing Model
     *
     * @param data - the Thing Model to be checked
     * @returns an object with keys:
     * -valid: the boolean for validity- and
     * -errors: the string containing the errors occurred. Undefined if valid.
     *
     * @experimental
     */
    public static validateThingModel(data: ThingModel): { valid: boolean; errors: string } {
        const isValid = ThingModelHelpers.tsSchemaValidator(data);
        let errors;
        if (!isValid) {
            errors = ThingModelHelpers.tsSchemaValidator.errors.map((o: ErrorObject) => o.message).join("\n");
        }
        return {
            valid: isValid,
            errors: errors,
        };
    }

    /**
     * builds the partialTDs starting from a Thing Model.
     *
     * @param model - The Thing Model to start from
     * @param options - Optional parameter of type CompositionOptions for passing
     * further information to the building process.
     * @returns an array of Partial TDs
     *
     * @experimental
     */
    public async getPartialTDs(model: unknown, options?: CompositionOptions): Promise<ExposedThingInit[]> {
        const extendedModels = await this._getPartialTDs(model, options);
        const extendedPartialTDs = extendedModels.map((_data) => {
            const data = _data as ExposedThingInit;
            // change the @type
            if (data["@type"] instanceof Array) {
                data["@type"] = data["@type"].map((el) => {
                    if (el === "tm:ThingModel") {
                        return "Thing";
                    }
                    return el;
                });
            } else {
                data["@type"] = "Thing";
            }
            return data;
        });
        return extendedPartialTDs;
    }

    /**
     * Retrieves the Thing Model from the given uri.
     *
     * @param uri - The uri from where to take the Thing Model
     * @returns asynchronously a Thing Model
     *
     * @experimental
     */
    public async fetchModel(uri: string): Promise<ThingModel> {
        this.addDependency(uri);
        let tm: ThingModel;
        if (this.resolver) {
            tm = (await this.resolver.fetch(uri)) as ThingModel;
        } else {
            tm = (await this.localFetch(uri)) as ThingModel;
        }
        if (!ThingModelHelpers.isThingModel(tm)) {
            throw new Error(`Data at ${uri} is not a Thing Model`);
        }
        return tm;
    }

    private localFetch(uri: string): unknown {
        const proto = uri.split("://")[0];
        switch (proto) {
            case "file": {
                const file = uri.split("://")[1];
                return new Promise((resolve, reject) => {
                    fs.readFile(file, { encoding: "utf-8" }, function (err, data) {
                        if (!err) {
                            resolve(JSON.parse(data));
                        } else {
                            reject(err);
                        }
                    });
                });
            }
            case "http": {
                return new Promise((resolve, reject) => {
                    http.get(uri, (res) => {
                        res.setEncoding("utf8");
                        let rawData = "";
                        res.on("data", (chunk) => {
                            rawData += chunk;
                        });
                        res.on("end", () => {
                            try {
                                const parsedData = JSON.parse(rawData);
                                console.debug("[td-tools]", "http fetched:", parsedData);
                                resolve(parsedData);
                            } catch (e) {
                                console.error(e.message);
                            }
                        });
                    }).on("error", (e) => {
                        reject(e);
                    });
                });
            }
            case "https": {
                return new Promise((resolve, reject) => {
                    https
                        .get(uri, (res) => {
                            res.setEncoding("utf8");
                            let rawData = "";
                            res.on("data", (chunk) => {
                                rawData += chunk;
                            });
                            res.on("end", () => {
                                try {
                                    const parsedData = JSON.parse(rawData);
                                    console.debug("[td-tools]", "https fetched:", parsedData);
                                    resolve(parsedData);
                                } catch (e) {
                                    console.error(e.message);
                                }
                            });
                        })
                        .on("error", (e) => {
                            reject(e);
                        });
                });
            }
            default:
                break;
        }
        return null;
    }

    private async _getPartialTDs(model: unknown, options?: CompositionOptions): Promise<ThingModel[]> {
        if (!ThingModelHelpers.isThingModel(model)) {
            throw new Error(`${model} is not a Thing Model`);
        }
        let isValid = ThingModelHelpers.validateThingModel(model);
        if (isValid.valid === false || isValid.errors !== undefined) {
            throw new Error(isValid.errors);
        }
        isValid = this.checkPlaceholderMap(model, options?.map);
        if (isValid.valid === false || isValid.errors !== undefined) {
            throw new Error(isValid.errors);
        }

        const modelInput = await this.fetchAffordances(model);
        const extendedModels = await this.composeModel(model, modelInput, options);
        return extendedModels;
    }

    /**
     * Retrieves and fills asynchronously all the external references of a Thing Model.
     *
     * @param data - The Thing Model to be filled
     * @returns asynchronously a modelComposeInput object containing all the retrieved data
     *
     * @experimental
     */
    private async fetchAffordances(data: ThingModel): Promise<modelComposeInput> {
        const modelInput: modelComposeInput = {};
        const extLinks = ThingModelHelpers.getThingModelLinks(data, "tm:extends");
        if (extLinks.length > 0) {
            modelInput.extends = [] as ThingModel[];
            for (const s of extLinks) {
                let source = await this.fetchModel(s.href);
                [source] = await this._getPartialTDs(source);
                modelInput.extends.push(source);
            }
        }
        const affordanceTypes = ["properties", "actions", "events"];
        modelInput.imports = [];
        for (const affType of affordanceTypes) {
            const affRefs = ThingModelHelpers.getThingModelRef(data[affType] as DataSchema);
            if (Object.keys(affRefs).length > 0) {
                for (const aff in affRefs) {
                    const affUri = affRefs[aff] as string;
                    const refObj = this.parseTmRef(affUri);
                    let source = await this.fetchModel(refObj.uri);
                    [source] = await this._getPartialTDs(source);
                    delete (data[affType] as DataSchema)[aff]["tm:ref"];
                    const importedAffordance = this.getRefAffordance(refObj, source);
                    refObj.name = aff; // update the name of the affordance
                    modelInput.imports.push({ affordance: importedAffordance, ...refObj });
                }
            }
        }
        const tmLinks = ThingModelHelpers.getThingModelLinks(data, "tm:submodel");
        if (tmLinks.length > 0) {
            modelInput.submodel = {} as Record<string, ThingModel>;
            for (const l of tmLinks) {
                const submodel = await this.fetchModel(l.href);
                modelInput.submodel[l.href] = submodel;
            }
        }
        return modelInput;
    }

    private async composeModel(
        data: ThingModel,
        modelObject: modelComposeInput,
        options?: CompositionOptions
    ): Promise<ThingModel[]> {
        let tmpThingModels = [] as ThingModel[];
        const title = data.title.replace(/ /g, "");
        if (!options) {
            options = {} as CompositionOptions;
        }
        if (!options.baseUrl) {
            options.baseUrl = ".";
        }
        const newTMHref = this.returnNewTMHref(options.baseUrl, title);
        const newTDHref = this.returnNewTDHref(options.baseUrl, title);
        if ("extends" in modelObject) {
            const extendObjs = modelObject.extends;
            for (const key in extendObjs) {
                const el = extendObjs[key];
                data = ThingModelHelpers.extendThingModel(el, data);
            }
            // remove the tm:extends links
            data.links = data.links.filter((link) => link.rel !== "tm:extends");
        }
        if ("imports" in modelObject) {
            const importObjs = modelObject.imports;
            for (const key in importObjs) {
                const el = importObjs[key];
                data = ThingModelHelpers.importAffordance(el.type, el.name, el.affordance, data);
            }
        }
        if ("submodel" in modelObject) {
            const submodelObj = modelObject.submodel;

            for (const key in submodelObj) {
                const sub = submodelObj[key];
                if (options.selfComposition) {
                    const index = data.links.findIndex((el) => el.href === key);
                    const el = data.links[index];
                    const instanceName = el.instanceName;
                    if (!instanceName) {
                        throw new Error("Self composition is not possible without instance names");
                    }
                    // self composition enabled, just one TD expected
                    const [subPartialTD] = await this._getPartialTDs(sub, options);
                    const affordanceTypes = ["properties", "actions", "events"];
                    for (const affType of affordanceTypes) {
                        for (const affKey in subPartialTD[affType] as DataSchema) {
                            const newAffKey = `${instanceName}_${affKey}`;
                            if (!(affType in data)) {
                                data[affType] = {} as DataSchema;
                            }
                            (data[affType] as DataSchema)[newAffKey] = (subPartialTD[affType] as DataSchema)[
                                affKey
                            ] as DataSchema;
                        }
                    }
                } else {
                    const subTitle = sub.title.replace(/ /g, "");
                    const subNewHref = this.returnNewTDHref(options.baseUrl, subTitle);
                    if (!("links" in sub)) {
                        sub.links = [];
                    }
                    sub.links.push({
                        rel: "collection",
                        href: newTDHref,
                        type: "application/td+json",
                    });
                    const tmpPartialSubTDs = await this._getPartialTDs(sub, options);
                    tmpThingModels.push(...tmpPartialSubTDs);
                    data = ThingModelHelpers.formatSubmodelLink(data, key, subNewHref);
                }
            }
        }
        if (!("links" in data) || options.selfComposition) {
            data.links = [];
        }
        // add reference to the thing model
        data.links.push({
            rel: "type",
            href: newTMHref,
            type: "application/tm+json",
        });

        if ("version" in data) {
            delete data.version;
        }
        if (options.map) {
            data = this.fillPlaceholder(data, options.map);
        }
        tmpThingModels.unshift(data); // put itself as first element
        tmpThingModels = tmpThingModels.map((el) => this.fillPlaceholder(el, options.map)); // TODO: make more efficient, since repeated each recursive call
        if (this.deps.length > 0) {
            this.removeDependency();
        }
        return tmpThingModels;
    }

    private static getThingModelRef(data: Record<string, unknown>): Record<string, unknown> {
        const refs = {} as Record<string, unknown>;
        if (!data) {
            return refs;
        }
        for (const key in data) {
            for (const key1 in data[key] as Record<string, unknown>) {
                if (key1 === "tm:ref") {
                    refs[key] = (data[key] as Record<string, unknown>)["tm:ref"] as string;
                }
            }
        }
        return refs;
    }

    private static getThingModelLinks(data: Record<string, unknown>, type: LINK_TYPE): LinkElement[] {
        let links = [] as LinkElement[];
        if ("links" in data && Array.isArray(data.links)) {
            links = data.links;
        }
        return links.filter((el) => el.rel === type);
    }

    private static extendThingModel(source: ThingModel, dest: ThingModel): ThingModel {
        let extendedModel = {} as ThingModel;
        const properties = source.properties;
        const actions = source.actions;
        const events = source.events;
        extendedModel = { ...source, ...dest };
        // TODO: implement validation for extending
        if (properties) {
            for (const key in properties) {
                if (dest.properties && key in dest.properties) {
                    extendedModel.properties[key] = { ...properties[key], ...dest.properties[key] };
                } else {
                    extendedModel.properties[key] = properties[key];
                }
            }
        }
        if (actions) {
            for (const key in actions) {
                if (dest.actions && key in dest.actions) {
                    extendedModel.actions[key] = { ...actions[key], ...dest.actions[key] };
                } else {
                    extendedModel.actions[key] = actions[key];
                }
            }
        }
        if (events) {
            for (const key in events) {
                if (dest.events && key in dest.events) {
                    extendedModel.events[key] = { ...events[key], ...dest.events[key] };
                } else {
                    extendedModel.events[key] = events[key];
                }
            }
        }
        return extendedModel;
    }

    private static importAffordance(
        affordanceType: AFFORDANCE_TYPE,
        affordanceName: string,
        source: DataSchema,
        dest: ThingModel
    ): ThingModel {
        const d = dest[affordanceType][affordanceName];
        dest[affordanceType][affordanceName] = { ...source, ...d };
        for (const key in dest[affordanceType][affordanceName]) {
            if (dest[affordanceType][affordanceName][key] === null) {
                delete dest[affordanceType][affordanceName][key];
            }
        }
        return dest;
    }

    private static formatSubmodelLink(source: ThingModel, oldHref: string, newHref: string) {
        const index = source.links.findIndex((el) => el.href === oldHref);
        const el = source.links[index];
        if ("instanceName" in el) {
            delete el.instanceName;
        }
        source.links[index] = {
            ...el,
            href: newHref,
            type: "application/td+json",
            rel: "item",
        };
        return source;
    }

    private parseTmRef(value: string): ModelImportsInput {
        const thingModelUri = value.split("#")[0];
        const affordaceUri = value.split("#")[1];
        const affordaceType = affordaceUri.split("/")[1] as AFFORDANCE_TYPE;
        const affordaceName = affordaceUri.split("/")[2];
        return { uri: thingModelUri, type: affordaceType, name: affordaceName };
    }

    private getRefAffordance(obj: ModelImportsInput, thing: ThingModel): DataSchema {
        const affordanceType = obj.type;
        const affordanceKey = obj.name;
        if (!(affordanceType in thing)) {
            return null;
        }
        const affordances = thing[affordanceType] as DataSchema;
        if (!(affordanceKey in affordances)) {
            return null;
        }
        return affordances[affordanceKey];
    }

    private fillPlaceholder(data: Record<string, unknown>, map: Record<string, unknown>): ThingModel {
        const placeHolderReplacer = new JsonPlaceholderReplacer();
        placeHolderReplacer.addVariableMap(map);
        return placeHolderReplacer.replace(data) as ThingModel;
    }

    private checkPlaceholderMap(model: ThingModel, map: Record<string, unknown>): { valid: boolean; errors: string } {
        const regex = "{{.*?}}";
        const modelString = JSON.stringify(model);
        // first check if model needs map
        let keys = modelString.match(new RegExp(regex, "g")) || [];
        keys = keys.map((el) => el.replace("{{", "").replace("}}", ""));
        let isValid = true;
        let errors;
        if (keys && keys.length > 0 && (map === undefined || map === null)) {
            isValid = false;
            errors = `No map provided for model ${model.title}`;
        } else if (keys.length > 0) {
            keys.every((key) => {
                if (!(key in map)) {
                    errors = `Missing required fields in map for model ${model.title}`;
                    isValid = false;
                    return false;
                }
                return true;
            });
        }
        return {
            valid: isValid,
            errors: errors,
        };
    }

    private returnNewTMHref(baseUrl: string, tdname: string) {
        return `${baseUrl}/${tdname}.tm.jsonld`;
    }

    private returnNewTDHref(baseUrl: string, tdname: string) {
        return `${baseUrl}/${tdname}.td.jsonld`;
    }

    private addDependency(dep: string) {
        if (this.deps.indexOf(dep) > -1) {
            throw new Error(`Circular dependency found for ${dep}`);
        }
        this.deps.push(dep);
    }

    private removeDependency(dep?: string) {
        if (dep) {
            this.deps = this.deps.filter((el) => el !== dep);
        } else {
            this.deps.pop();
        }
    }
}
