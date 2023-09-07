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

import Thing from "../thing-description";
import * as TD from "../thing-description";
import { SecurityScheme } from "wot-thing-description-types";
import * as TDParser from "../td-parser";

import debug from "debug";
import { ThingDescription } from "wot-typescript-definitions";
import { FormElementBase, PropertyElement } from "wot-thing-model-types";
const namespace = "node-wot:td-tools:asset-interface-description-util";
const logDebug = debug(`${namespace}:debug`);
const logInfo = debug(`${namespace}:info`);

/** Utilities around Asset Interface Description
 * https://github.com/admin-shell-io/submodel-templates/tree/main/development/Asset%20Interface%20Description/1/0
 *
 * e.g, transform AAS (or AID  submodel) to TD or vicerversa transform TD to AAS (or AID submodel)
 *
 */

/*
 * TODOs
 * - transformToTD without any binding prefix (Idea: collect first all possible bindings)
 * - what is the desired input/output? string, object, ... ?
 * - what are options that would be desired? (context version, id, security, ...) -> template mechanism fine?
 * - Fields like @context, id, .. etc representable in AID?
 * - More test-data for action & events, data input and output, ...
 *
 */

interface AASInteraction {
    endpointMetadata?: Record<string, unknown>;
    secNamesForEndpoint?: Array<string>;
    interaction: Record<string, unknown>;
}

interface SubmodelInformation {
    properties: Map<string, Array<AASInteraction>>;
    actions: Map<string, Array<AASInteraction>>;
    events: Map<string, Array<AASInteraction>>;

    thing: Map<string, Record<string, unknown>>;

    endpointMetadataArray: Array<Record<string, unknown>>;
}

const noSecName = 0 + "_sc";

export class AssetInterfaceDescriptionUtil {
    private getBaseFromEndpointMetadata(endpointMetadata?: Record<string, unknown>): string {
        if (endpointMetadata?.value && endpointMetadata.value instanceof Array) {
            for (const v of endpointMetadata.value) {
                if (v.idShort === "base") {
                    // e.g., "value": "modbus+tcp://192.168.1.187:502"
                    return v.value;
                }
            }
        }
        return "undefined"; // TODO what is th right value if information cannot be found
    }

    private getContentTypeFromEndpointMetadata(endpointMetadata?: Record<string, unknown>): string {
        if (endpointMetadata?.value && endpointMetadata.value instanceof Array) {
            for (const v of endpointMetadata.value) {
                if (v.idShort === "contentType") {
                    // e.g., "value": "application/octet-stream;byteSeq=BIG_ENDIAN"
                    return v.value;
                }
            }
        }
        return ""; // TODO what is the right value if information cannot be found
    }

    private getSecurityDefinitionsFromEndpointMetadata(endpointMetadata?: Record<string, unknown>): {
        [k: string]: SecurityScheme;
    } {
        const securityDefinitions: {
            [k: string]: SecurityScheme;
        } = {};

        if (endpointMetadata?.value && endpointMetadata.value instanceof Array) {
            for (const v of endpointMetadata.value) {
                if (v.idShort === "securityDefinitions") {
                    // const securitySchemes: Array<SecurityScheme> = [];
                    if (v.value && v.value instanceof Array) {
                        for (const securityDefinitionsValues of v.value) {
                            if (securityDefinitionsValues.idShort) {
                                // key
                                if (securityDefinitionsValues.value instanceof Array) {
                                    for (const securityDefinitionsValue of securityDefinitionsValues.value) {
                                        if (securityDefinitionsValue.idShort === "scheme") {
                                            if (securityDefinitionsValue.value) {
                                                const ss: SecurityScheme = { scheme: securityDefinitionsValue.value };
                                                securityDefinitions[securityDefinitionsValues.idShort] = ss;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return securityDefinitions;
    }

    private getSecurityFromEndpointMetadata(
        endpointMetadata?: Record<string, unknown>
    ): string | [string, ...string[]] {
        const security: string[] = [];
        if (endpointMetadata?.value && endpointMetadata.value instanceof Array) {
            for (const v of endpointMetadata.value) {
                if (v.idShort === "security") {
                    if (v.value && v.value instanceof Array) {
                        for (const securityValue of v.value) {
                            if (securityValue.value) {
                                security.push(securityValue.value);
                            }
                        }
                    }
                }
            }
        }

        return security as string | [string, ...string[]];
    }

    private createInteractionForm(vi: AASInteraction, addSecurity: boolean): TD.Form {
        const form: TD.Form = {
            href: this.getBaseFromEndpointMetadata(vi.endpointMetadata),
            contentType: this.getContentTypeFromEndpointMetadata(vi.endpointMetadata),
        };
        // need to add security at form level at all ?
        if (addSecurity) {
            const securitySchemes = this.getSecurityDefinitionsFromEndpointMetadata(vi.endpointMetadata);
            if (securitySchemes === undefined) {
                form.security = [noSecName];
            } else {
                if (vi.secNamesForEndpoint) {
                    form.security = vi.secNamesForEndpoint as [string, ...string[]];
                }
            }
        }
        if (vi.interaction.value instanceof Array) {
            for (const iv of vi.interaction.value) {
                if (iv.idShort === "forms") {
                    if (iv.value instanceof Array) {
                        for (const v of iv.value) {
                            // Binding
                            if (v.idShort === "href") {
                                if (form.href && form.href.length > 0) {
                                    form.href = form.href + v.value; // TODO handle leading/trailing slashes
                                } else {
                                    form.href = v.value;
                                }
                            } else if (typeof v.idShort === "string" && v.idShort.length > 0) {
                                // TODO is this still relevant?
                                // pick *any* value (and possibly override, e.g, contentType)
                                // TODO Should we add all value's (e.g., dataMapping might be empty array) ?
                                // if (typeof v.value === "string" ||typeof v.value === "number" || typeof v.value === "boolean") {
                                if (v.value) {
                                    form[v.idShort] = v.value;
                                    // use valueType to convert the string value
                                    if (
                                        v.valueType &&
                                        v.valueType &&
                                        v.valueType.dataObjectType &&
                                        v.valueType.dataObjectType.name &&
                                        typeof v.valueType.dataObjectType.name === "string"
                                    ) {
                                        // XSD schemaTypes, https://www.w3.org/TR/xmlschema-2/#built-in-datatypes
                                        switch (v.valueType.dataObjectType.name) {
                                            case "boolean":
                                                form[v.idShort] = form[v.idShort] === "true";
                                                break;
                                            case "float":
                                            case "double":
                                            case "decimal":
                                            case "integer":
                                            case "nonPositiveInteger":
                                            case "negativeInteger":
                                            case "long":
                                            case "int":
                                            case "short":
                                            case "byte":
                                            case "nonNegativeInteger":
                                            case "unsignedLong":
                                            case "unsignedInt":
                                            case "unsignedShort":
                                            case "unsignedByte":
                                            case "positiveInteger":
                                                form[v.idShort] = Number(form[v.idShort]);
                                                break;
                                            // TODO handle more XSD types ?
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return form;
    }

    private processSubmodel(
        smInformation: SubmodelInformation,
        submodel: Record<string, unknown>,
        submodelRegex?: string
    ): void {
        if (submodel instanceof Object && submodel.idShort && submodel.idShort === "AssetInterfacesDescription") {
            if (submodel.submodelElements && submodel.submodelElements instanceof Array) {
                for (const submodelElement of submodel.submodelElements) {
                    if (submodelElement instanceof Object) {
                        logDebug("SubmodelElement.idShort: " + submodelElement.idShort);
                        if (submodelRegex && typeof submodelRegex === "string" && submodelRegex.length > 0) {
                            const regex = new RegExp(submodelRegex);
                            if (!regex.test(submodelElement.idShort)) {
                                logInfo("submodel not of interest");
                                continue;
                            }
                        }

                        this.processSubmodelElement(smInformation, submodelElement);
                    }
                }
            }
        }
    }

    private processSubmodelElement(smInformation: SubmodelInformation, submodelElement: Record<string, unknown>): void {
        // EndpointMetadata vs. InterfaceMetadata
        if (submodelElement.value && submodelElement.value instanceof Array) {
            // Note: iterate twice over to collect first EndpointMetadata
            let endpointMetadata: Record<string, unknown> = {};
            for (const smValue of submodelElement.value) {
                if (smValue instanceof Object) {
                    if (smValue.idShort === "EndpointMetadata") {
                        logInfo("EndpointMetadata");
                        // e.g., idShort: base , contentType, securityDefinitions, alternativeEndpointDescriptor?
                        endpointMetadata = smValue;
                        smInformation.endpointMetadataArray.push(endpointMetadata);
                    } else if (smValue.idShort === "InterfaceMetadata") {
                        // handled later
                    } else if (smValue.idShort === "externalDescriptor") {
                        // needed?
                    } else {
                        smInformation.thing.set(smValue.idShort, smValue.value);
                    }
                }
            }
            // the 2nd time look for InterfaceMetadata that *need* EndpointMetadata
            for (const smValue of submodelElement.value) {
                if (smValue instanceof Object) {
                    if (smValue.idShort === "InterfaceMetadata") {
                        logInfo("InterfaceMetadata");
                        if (smValue.value && smValue.value instanceof Array) {
                            for (const interactionValue of smValue.value) {
                                if (interactionValue.idShort === "Properties") {
                                    if (interactionValue.value instanceof Array) {
                                        for (const iValue of interactionValue.value) {
                                            logInfo("Property: " + iValue.idShort);
                                            if (!smInformation.properties.has(iValue.idShort)) {
                                                smInformation.properties.set(iValue.idShort, []);
                                            }
                                            const propInter: AASInteraction = {
                                                endpointMetadata: endpointMetadata,
                                                interaction: iValue,
                                            };
                                            smInformation.properties.get(iValue.idShort)?.push(propInter);
                                        }
                                    }
                                } else if (interactionValue.idShort === "Operations") {
                                    if (interactionValue.value instanceof Array) {
                                        for (const iValue of interactionValue.value) {
                                            logInfo("Action: " + iValue.idShort);
                                            if (!smInformation.actions.has(iValue.idShort)) {
                                                smInformation.actions.set(iValue.idShort, []);
                                            }
                                            const actInter: AASInteraction = {
                                                endpointMetadata: endpointMetadata,
                                                interaction: iValue,
                                            };
                                            smInformation.actions.get(iValue.idShort)?.push(actInter);
                                        }
                                    }
                                } else if (interactionValue.idShort === "Events") {
                                    if (interactionValue.value instanceof Array) {
                                        for (const iValue of interactionValue.value) {
                                            logInfo("Event: " + iValue.idShort);
                                            if (!smInformation.events.has(iValue.idShort)) {
                                                smInformation.events.set(iValue.idShort, []);
                                            }
                                            const evInter: AASInteraction = {
                                                endpointMetadata: endpointMetadata,
                                                interaction: iValue,
                                            };
                                            smInformation.events.get(iValue.idShort)?.push(evInter);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private getSubmodelInformation(aas: string, submodelRegex?: string): SubmodelInformation {
        const aidModel = JSON.parse(aas);

        const smInformation: SubmodelInformation = {
            actions: new Map<string, Array<AASInteraction>>(),
            events: new Map<string, Array<AASInteraction>>(),
            properties: new Map<string, Array<AASInteraction>>(),
            endpointMetadataArray: [],
            thing: new Map<string, Record<string, unknown>>(),
        };

        if (aidModel instanceof Object && aidModel.submodels) {
            if (aidModel.submodels instanceof Array) {
                for (const submodel of aidModel.submodels) {
                    this.processSubmodel(smInformation, submodel, submodelRegex);
                }
            }
        }

        return smInformation;
    }

    private _transform(smInformation: SubmodelInformation, template?: string): string {
        const thing: Thing = template ? JSON.parse(template) : {};

        // walk over thing information and set them
        for (const [key, value] of smInformation.thing) {
            if (typeof value === "string") {
                thing[key] = value;
            } else {
                // TODO what to do with non-string values?
            }
        }

        // required TD fields
        if (!thing["@context"]) {
            thing["@context"] = "https://www.w3.org/2022/wot/td/v1.1";
        }
        if (!thing.title) {
            thing.title = "?TODO?"; // generate one?
        }

        // Security in AID is defined for each submodel
        // add "securityDefinitions" globally and add them on form level if necessary
        // TODO: possible collisions for "security" names *could* be handled by cnt
        if (!thing.securityDefinitions) {
            thing.securityDefinitions = {};
        }
        // let cnt = 1;
        const secNamesForEndpointMetadata = new Map<Record<string, unknown>, string[]>();
        for (const endpointMetadata of smInformation.endpointMetadataArray) {
            const secNames: Array<string> = [];
            thing.securityDefinitions = this.getSecurityDefinitionsFromEndpointMetadata(endpointMetadata);
            thing.security = this.getSecurityFromEndpointMetadata(endpointMetadata);
            // iterate over securitySchemes
            // eslint-disable-next-line unused-imports/no-unused-vars
            for (const [key, value] of Object.entries(thing.securityDefinitions)) {
                // console.log(key, value);
                // TODO we could change the name to avoid name collisions. Shall we do so?
                secNames.push(key);
            }
            secNamesForEndpointMetadata.set(endpointMetadata, secNames);
        }

        // add interactions
        // 1. properties
        logDebug("########### PROPERTIES (" + smInformation.properties.size + ")");
        if (smInformation.properties.size > 0) {
            thing.properties = {};

            for (const [key, value] of smInformation.properties.entries()) {
                logInfo("Property" + key + " = " + value);

                thing.properties[key] = {};
                thing.properties[key].forms = [];

                for (const vi of value) {
                    for (const keyInteraction in vi.interaction) {
                        if (keyInteraction === "description") {
                            const aasDescription = vi.interaction[keyInteraction];
                            // convert
                            //
                            // [{
                            //     "language": "en",
                            //     "text": "Current counter value"
                            //  },
                            //  {
                            //      "language": "de",
                            //      "text": "Derzeitiger Zählerwert"
                            //  }]
                            //
                            // to
                            //
                            // {"en": "Current counter value", "de": "Derzeitiger Zählerwert"}
                            const tdDescription: Record<string, string> = {};
                            if (aasDescription instanceof Array) {
                                for (const aasDescriptionEntry of aasDescription) {
                                    if (aasDescriptionEntry.language && aasDescriptionEntry.text) {
                                        const language: string = aasDescriptionEntry.language;
                                        const text: string = aasDescriptionEntry.text;
                                        tdDescription[language] = text;
                                    }
                                }
                            }
                            thing.properties[key].descriptions = tdDescription;
                        } else if (keyInteraction === "value") {
                            if (vi.interaction.value instanceof Array) {
                                for (const interactionValue of vi.interaction.value)
                                    if (interactionValue.idShort === "type") {
                                        if (interactionValue.value === "float") {
                                            thing.properties[key].type = "number";
                                        } else {
                                            thing.properties[key].type = interactionValue.value;
                                        }
                                    } else if (interactionValue.idShort === "range") {
                                        if (interactionValue.min) {
                                            thing.properties[key].min = interactionValue.min;
                                        }
                                        if (interactionValue.max) {
                                            thing.properties[key].max = interactionValue.max;
                                        }
                                    } else if (interactionValue.idShort === "observable") {
                                        thing.properties[key].observable = interactionValue.value === "true";
                                    } else if (interactionValue.idShort === "readOnly") {
                                        thing.properties[key].readOnly = interactionValue.value === "true";
                                    } else if (interactionValue.idShort === "writeOnly") {
                                        thing.properties[key].writeOnly = interactionValue.value === "true";
                                    } else if (interactionValue.idShort === "forms") {
                                        // will be handled below
                                    } else {
                                        // handle other terms specifically?
                                        const key2 = interactionValue.idShort;
                                        thing.properties[key][key2] = interactionValue.value;
                                    }
                            }
                        }
                    }

                    if (vi.endpointMetadata) {
                        vi.secNamesForEndpoint = secNamesForEndpointMetadata.get(vi.endpointMetadata);
                    }
                    const form = this.createInteractionForm(vi, smInformation.endpointMetadataArray.length > 1);
                    thing.properties[key].forms.push(form);
                }
            }
        }

        // 2. actions
        logDebug("########### ACTIONS (" + smInformation.actions.size + ")");
        if (smInformation.actions.size > 0) {
            thing.actions = {};

            for (const [key, value] of smInformation.actions.entries()) {
                logInfo("Action" + key + " = " + value);

                thing.actions[key] = {};
                thing.actions[key].forms = [];

                for (const vi of value) {
                    if (vi.endpointMetadata) {
                        vi.secNamesForEndpoint = secNamesForEndpointMetadata.get(vi.endpointMetadata);
                    }
                    const form = this.createInteractionForm(vi, smInformation.endpointMetadataArray.length > 1);
                    thing.properties[key].forms.push(form);
                }
            }
        }

        // 3. events
        logDebug("########### EVENTS (" + smInformation.events.size + ")");
        if (smInformation.events.size > 0) {
            thing.events = {};

            for (const [key, value] of smInformation.events.entries()) {
                logInfo("Event " + key + " = " + value);

                thing.events[key] = {};
                thing.events[key].forms = [];

                for (const vi of value) {
                    if (vi.endpointMetadata) {
                        vi.secNamesForEndpoint = secNamesForEndpointMetadata.get(vi.endpointMetadata);
                    }
                    const form = this.createInteractionForm(vi, smInformation.endpointMetadataArray.length > 1);
                    thing.properties[key].forms.push(form);
                }
            }
        }

        return JSON.stringify(thing);
    }

    /** @deprecated use transformAAS2TD method instead */
    public transformToTD(aid: string, template?: string, submodelRegex?: string): string {
        return this.transformAAS2TD(aid, template, submodelRegex);
    }

    /**
     * Transform AAS in JSON format to a WoT ThingDescription (TD)
     *
     * @param aas input AAS in JSON format
     * @param template TD template with basic desired TD template
     * @param submodelRegex allows to filter submodel elements based on regex expression (e.g, "HTTP*") or full text based on idShort (e.g., "InterfaceHTTP")
     * @returns transformed TD
     */
    public transformAAS2TD(aas: string, template?: string, submodelRegex?: string): string {
        const smInformation = this.getSubmodelInformation(aas, submodelRegex);
        return this._transform(smInformation, template);
    }

    /**
     * Transform AID submodel definition in JSON format to a WoT ThingDescription (TD)
     *
     * @param aid input AID submodel in JSON format
     * @param template TD template with basic desired TD template
     * @param submodelRegex allows to filter submodel elements based on regex expression (e.g, "HTTP*") or full text based on idShort (e.g., "InterfaceHTTP")
     * @returns transformed TD
     */
    public transformSM2TD(aid: string, template?: string, submodelRegex?: string): string {
        const submodel = JSON.parse(aid);

        const smInformation: SubmodelInformation = {
            actions: new Map<string, Array<AASInteraction>>(),
            events: new Map<string, Array<AASInteraction>>(),
            properties: new Map<string, Array<AASInteraction>>(),
            endpointMetadataArray: [],
            thing: new Map<string, Record<string, unknown>>(),
        };

        this.processSubmodel(smInformation, submodel, submodelRegex);

        return this._transform(smInformation, template);
    }

    /**
     * Transform WoT ThingDescription (TD) to AAS in JSON format
     *
     * @param td input TD
     * @param protocols protocol prefixes of interest (e.g., ["http", "coap"])
     * @returns transformed AAS in JSON format
     */
    public transformTD2AAS(td: string, protocols: string[]): string {
        const submodel = this.transformTD2SM(td, protocols);
        const submodelObj = JSON.parse(submodel);
        const submodelId = submodelObj.id;

        // configuration
        const aasName = "SampleAAS";
        const aasId = "https://example.com/ids/aas/7474_9002_6022_1115";

        const aas = {
            assetAdministrationShells: [
                {
                    idShort: aasName,
                    id: aasId,
                    assetInformation: {
                        assetKind: "Type",
                    },
                    submodels: [
                        {
                            type: "ModelReference",
                            keys: [
                                {
                                    type: "Submodel",
                                    value: submodelId,
                                },
                            ],
                        },
                    ],
                    modelType: "AssetAdministrationShell",
                },
            ],
            submodels: [submodelObj],
            conceptDescriptions: [],
        };

        return JSON.stringify(aas);
    }

    /**
     * Transform WoT ThingDescription (TD) to AID submodel definition in JSON format
     *
     * @param td input TD
     * @param protocols protocol prefixes of interest (e.g., ["http", "coap"])
     * @returns transformed AID submodel definition in JSON format
     */
    public transformTD2SM(tdAsString: string, protocols: string[]): string {
        const td: ThingDescription = TDParser.parseTD(tdAsString);

        const aidID = td.id ? td.id : "ID_" + Math.random();

        console.log("TD " + td.title + " parsed...");

        const submdelElements = [];
        for (const protocol of protocols) {
            // use protocol binding prefix like "http" for name
            const submodelElementIdShort = protocol === undefined ? "Interface" : "Interface" + protocol.toUpperCase();

            const submdelElement = {
                idShort: submodelElementIdShort,
                // semanticId needed?
                // embeddedDataSpecifications needed?
                value: [
                    {
                        idShort: "title",
                        valueType: "xs:string",
                        value: td.title,
                        modelType: "Property",
                    },
                    // support and other?
                    this.createEndpointMetadata(td), // EndpointMetadata like base, security and securityDefinitions
                    this.createInterfaceMetadata(td, protocol), // InterfaceMetadata like properties, actions and events
                    // externalDescriptor ?
                ],
                modelType: "SubmodelElementCollection",
            };

            submdelElements.push(submdelElement);
        }

        const aidObject = {
            idShort: "AssetInterfacesDescription",
            id: aidID,
            kind: "Instance",
            // semanticId needed?
            description: [
                // TODO does this need to be an array or can it simply be a value
                {
                    language: "en",
                    text: td.title, // TODO should be description, where does title go to? later on in submodel?
                },
            ],
            submodelElements: submdelElements,
            modelType: "Submodel",
        };

        return JSON.stringify(aidObject);
    }

    private createEndpointMetadata(td: ThingDescription): Record<string, unknown> {
        const values: Array<unknown> = [];

        // base ?
        if (td.base) {
            values.push({
                idShort: "base",
                valueType: "xs:anyURI",
                value: td.base, // TODO
                modelType: "Property",
            });
        }

        // TODO wrong place.. not allowed in TD spec?
        /*
        {
            idShort: "contentType",
            valueType: "xs:string",
            value: "application/json", // TODO
            modelType: "Property",
        },
        */

        // security
        const securityValues: Array<unknown> = [];
        if (td.security) {
            for (const secKey of td.security) {
                securityValues.push({
                    valueType: "xs:string",
                    value: secKey,
                    modelType: "Property",
                });
            }
        }
        values.push({
            idShort: "security",
            value: securityValues,
            modelType: "SubmodelElementCollection",
        });

        // securityDefinitions
        const securityDefinitionsValues: Array<unknown> = [];
        for (const secKey in td.securityDefinitions) {
            const secValue: SecurityScheme = td.securityDefinitions[secKey];
            securityDefinitionsValues.push({
                idShort: secKey,
                value: [
                    {
                        idShort: "scheme",
                        valueType: "xs:string",
                        value: secValue.scheme,
                        modelType: "Property",
                    },
                ],
                modelType: "SubmodelElementCollection",
            });
        }
        values.push({
            idShort: "securityDefinitions",
            value: securityDefinitionsValues,
            modelType: "SubmodelElementCollection",
        });

        const endpointMetadata: Record<string, unknown> = {
            idShort: "EndpointMetadata",
            // semanticId ?
            // embeddedDataSpecifications ?
            value: values,
            modelType: "SubmodelElementCollection",
        };

        return endpointMetadata;
    }

    private createInterfaceMetadata(td: ThingDescription, protocol: string): Record<string, unknown> {
        const properties: Array<unknown> = [];
        const actions: Array<unknown> = [];
        const events: Array<unknown> = [];

        if (protocol) {
            // Properties
            if (td.properties) {
                for (const propertyKey in td.properties) {
                    const propertyValue: PropertyElement = td.properties[propertyKey];

                    // check whether protocol prefix exists for a form
                    let formElementPicked: FormElementBase | undefined;
                    if (propertyValue.forms) {
                        for (const formElementProperty of propertyValue.forms) {
                            if (formElementProperty.href?.startsWith(protocol)) {
                                formElementPicked = formElementProperty;
                                // found matching form --> abort loop
                                break;
                            }
                        }
                    }
                    if (formElementPicked === undefined) {
                        // do not add this property, since there will be no href of interest
                        continue;
                    }

                    const propertyValues: Array<unknown> = [];
                    // type
                    if (propertyValue.type) {
                        propertyValues.push({
                            idShort: "type",
                            valueType: "xs:string",
                            value: propertyValue.type,
                            modelType: "Property",
                        });
                    }
                    // title
                    if (propertyValue.title) {
                        propertyValues.push({
                            idShort: "title",
                            valueType: "xs:string",
                            value: propertyValue.title,
                            modelType: "Property",
                        });
                    }
                    // observable
                    if (propertyValue.observable) {
                        propertyValues.push({
                            idShort: "observable",
                            valueType: "xs:boolean",
                            value: `${propertyValue.observable}`, // in AID represented as string
                            modelType: "Property",
                        });
                    }
                    // readOnly and writeOnly marked as EXTERNAL in AID spec
                    // range and others? Simply add them as is?

                    // forms
                    if (formElementPicked) {
                        const propertyForm: Array<unknown> = [];

                        // TODO AID for now supports just *one* href/form
                        // --> pick the first one that matches protocol (other means in future?)

                        // walk over string values like: "href", "contentType", "htv:methodName", ...
                        for (const formTerm in formElementPicked) {
                            const formValue = formElementPicked[formTerm];
                            if (typeof formValue === "string") {
                                propertyForm.push({
                                    idShort: formTerm,
                                    valueType: "xs:string",
                                    value: formValue,
                                    modelType: "Property",
                                });
                            }
                        }

                        // TODO terms that are not string-based, like op arrays?

                        propertyValues.push({
                            idShort: "forms",
                            value: propertyForm,
                            modelType: "SubmodelElementCollection",
                        });
                    }

                    let description;
                    if (propertyValue.descriptions) {
                        description = [];
                        for (const langKey in propertyValue.descriptions) {
                            const langValue = propertyValue.descriptions[langKey];
                            description.push({
                                language: langKey,
                                text: langValue,
                            });
                        }
                    } else if (propertyValue.description) {
                        // fallback
                        description = [];
                        description.push({
                            language: "en", // TODO where to get language identifier
                            text: propertyValue.description,
                        });
                    }

                    properties.push({
                        idShort: propertyKey,
                        description: description,
                        value: propertyValues,
                        modelType: "SubmodelElementCollection",
                    });
                }
            }
            // Actions
            if (td.actions) {
                // TODO actions - TBD by AID
            }

            // Events
            if (td.events) {
                // TODO events - TBD by AID
            }
        }

        const values: Array<unknown> = [];
        // Properties
        values.push({
            idShort: "Properties",
            value: properties,
            modelType: "SubmodelElementCollection",
        });
        // Actions
        values.push({
            idShort: "Actions",
            value: actions,
            modelType: "SubmodelElementCollection",
        });
        // Events
        values.push({
            idShort: "Events",
            value: events,
            modelType: "SubmodelElementCollection",
        });

        const interfaceMetadata: Record<string, unknown> = {
            idShort: "InterfaceMetadata",
            // semanticId ?
            // embeddedDataSpecifications ?
            value: values,
            modelType: "SubmodelElementCollection",
        };

        return interfaceMetadata;
    }
}
