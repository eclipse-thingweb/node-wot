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
import isAbsoluteUrl = require("is-absolute-url");
const namespace = "node-wot:td-tools:asset-interface-description-util";
const logDebug = debug(`${namespace}:debug`);
const logInfo = debug(`${namespace}:info`);
const logError = debug(`${namespace}:error`);

/**
 * Utilities around Asset Interface Description
 * https://github.com/admin-shell-io/submodel-templates/tree/main/development/Asset%20Interface%20Description/1/0
 *
 * e.g, transform AAS (or AID  submodel) to TD or vicerversa transform TD to AAS (or AID submodel)
 *
 */

export class AssetInterfaceDescriptionUtil {
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
     * @param protocols protocol prefixes of interest (e.g., ["http", "coap"]) or optional if all
     * @returns transformed AAS in JSON format
     */
    public transformTD2AAS(td: string, protocols?: string[]): string {
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
     * @param protocols protocol prefixes of interest (e.g., ["http", "coap"]) or optional if all
     * @returns transformed AID submodel definition in JSON format
     */
    public transformTD2SM(tdAsString: string, protocols?: string[]): string {
        const td: ThingDescription = TDParser.parseTD(tdAsString);

        const aidID = td.id ?? "ID" + Math.random();

        logInfo("TD " + td.title + " parsed...");

        // collect all possible prefixes
        if (protocols === undefined || protocols.length === 0) {
            protocols = this.getProtocolPrefixes(td);
        }

        const submdelElements = [];
        for (const protocol of protocols) {
            // use protocol binding prefix like "http" for name
            const submodelElementIdShort = protocol === undefined ? "Interface" : "Interface" + protocol.toUpperCase();

            const supplementalSemanticIds = [this.createSemanticId("https://www.w3.org/2019/wot/td")];
            if (protocol !== undefined) {
                const protocolLC = protocol.toLocaleLowerCase();
                let supplementalSemanticIdProtocolValue;
                if (protocolLC.includes("modbus")) {
                    supplementalSemanticIdProtocolValue = "http://www.w3.org/2011/modbus";
                } else if (protocolLC.includes("mqtt")) {
                    supplementalSemanticIdProtocolValue = "http://www.w3.org/2011/mqtt";
                } else if (protocolLC.includes("http")) {
                    supplementalSemanticIdProtocolValue = "http://www.w3.org/2011/http";
                }
                if (supplementalSemanticIdProtocolValue !== undefined) {
                    supplementalSemanticIds.push(this.createSemanticId(supplementalSemanticIdProtocolValue));
                }
            }

            const submdelElement = {
                idShort: submodelElementIdShort,
                semanticId: this.createSemanticId(
                    "https://admin-shell.io/idta/AssetInterfacesDescription/1/0/Interface"
                ),
                supplementalSemanticIds,
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
            semanticId: this.createSemanticId("https://admin-shell.io/idta/AssetInterfacesDescription/1/0/Submodel"),
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

    /** @deprecated use transformAAS2TD method instead */
    public transformToTD(aid: string, template?: string, submodelRegex?: string): string {
        return this.transformAAS2TD(aid, template, submodelRegex);
    }

    /*
     * PRIVATE IMPLEMENTATION METHODS ARE FOLLOWING
     *
     */

    private createSemanticId(value: string): object {
        return {
            type: "ExternalReference",
            keys: [
                {
                    type: "GlobalReference",
                    value,
                },
            ],
        };
    }

    private getProtocolPrefixes(td: ThingDescription): string[] {
        const protocols: string[] = [];

        if (td.properties) {
            for (const propertyKey in td.properties) {
                const property = td.properties[propertyKey];
                this.updateProtocolPrefixes(property.forms, protocols);
            }
        }
        if (td.actions) {
            for (const actionKey in td.actions) {
                const action = td.actions[actionKey];
                this.updateProtocolPrefixes(action.forms, protocols);
            }
        }
        if (td.events) {
            for (const eventKey in td.events) {
                const event = td.events[eventKey];
                this.updateProtocolPrefixes(event.forms, protocols);
            }
        }

        return protocols;
    }

    private updateProtocolPrefixes(forms: [FormElementBase, ...FormElementBase[]], protocols: string[]): void {
        if (forms != null) {
            for (const interactionForm of forms) {
                if (interactionForm.href != null) {
                    const positionColon = interactionForm.href.indexOf(":");
                    if (positionColon > 0) {
                        const prefix = interactionForm.href.substring(0, positionColon);
                        if (!protocols.includes(prefix)) {
                            protocols.push(prefix);
                        }
                    }
                }
            }
        }
    }

    private getBaseFromEndpointMetadata(endpointMetadata?: Record<string, unknown>): string {
        if (endpointMetadata?.value instanceof Array) {
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
        if (endpointMetadata?.value instanceof Array) {
            for (const v of endpointMetadata.value) {
                if (v.idShort === "contentType") {
                    // e.g., "value": "application/octet-stream;byteSeq=BIG_ENDIAN"
                    return v.value;
                }
            }
        }
        return ""; // TODO what is the right value if information cannot be found
    }

    private updateRootMetadata(thing: Thing, endpointMetadata?: Record<string, unknown>) {
        const securityDefinitions: {
            [k: string]: SecurityScheme;
        } = {};
        const security: string[] = [];

        if (endpointMetadata?.value instanceof Array) {
            for (const v of endpointMetadata.value) {
                if (v.idShort === "base") {
                    thing.base = v.value;
                } else if (v.idShort === "securityDefinitions") {
                    if (v.value instanceof Array) {
                        for (const securityDefinitionsValues of v.value) {
                            if (securityDefinitionsValues.idShort != null) {
                                // key
                                if (securityDefinitionsValues.value instanceof Array) {
                                    for (const securityDefinitionsValue of securityDefinitionsValues.value) {
                                        if (securityDefinitionsValue.idShort === "scheme") {
                                            if (securityDefinitionsValue.value != null) {
                                                const ss: SecurityScheme = { scheme: securityDefinitionsValue.value };
                                                securityDefinitions[securityDefinitionsValues.idShort] = ss;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else if (v.idShort === "security") {
                    if (v.value instanceof Array) {
                        for (const securityValue of v.value) {
                            if (securityValue.value != null) {
                                security.push(securityValue.value);
                            }
                        }
                    }
                }
            }
        }

        thing.securityDefinitions = securityDefinitions;
        thing.security = security as string | [string, ...string[]];
    }

    private createInteractionForm(vi: AASInteraction, addSecurity: boolean): TD.Form {
        const form: TD.Form = {
            href: this.getBaseFromEndpointMetadata(vi.endpointMetadata),
            contentType: this.getContentTypeFromEndpointMetadata(vi.endpointMetadata),
        };

        if (addSecurity) {
            // XXX need to add security at form level at all ?
            logError("security at form level not added/present");
            /*
            const securitySchemes = this.getSecurityDefinitionsFromEndpointMetadata(vi.endpointMetadata);
            if (securitySchemes === undefined) {
                form.security = [0 + "_sc"];
            } else {
                if (vi.secNamesForEndpoint) {
                    form.security = vi.secNamesForEndpoint as [string, ...string[]];
                }
            }
            */
        }
        if (vi.interaction.value instanceof Array) {
            for (const iv of vi.interaction.value) {
                if (iv.idShort === "forms") {
                    if (iv.value instanceof Array) {
                        for (const v of iv.value) {
                            // Binding
                            if (v.idShort === "href") {
                                if (v.value != null) {
                                    const hrefValue: string = v.value;
                                    if (isAbsoluteUrl(hrefValue)) {
                                        form.href = hrefValue;
                                    } else if (form.href && form.href.length > 0) {
                                        // handle leading/trailing slashes
                                        if (form.href.endsWith("/") && hrefValue.startsWith("/")) {
                                            form.href = form.href + hrefValue.substring(1);
                                        } else if (!form.href.endsWith("/") && !hrefValue.startsWith("/")) {
                                            form.href = form.href + "/" + hrefValue;
                                        } else {
                                            form.href = form.href + hrefValue;
                                        }
                                    } else {
                                        form.href = hrefValue;
                                    }
                                }
                            } else if (typeof v.idShort === "string" && v.idShort.length > 0) {
                                // pick *any* value (and possibly override, e.g. contentType)
                                if (v.value != null) {
                                    // Note: AID does not allow idShort to contain values with colon (i.e., ":") --> "_" used instead
                                    // --> THIS MAY LEAD TO PROBLEMS BUT THAT'S HOW IT IS SPECIFIED
                                    const tdTerm = (v.idShort as string).replace("_", ":");
                                    form[tdTerm] = v.value;
                                    // use valueType to convert the string value
                                    // TODO Should we add/support all value's (e.g., dataMapping might be empty array) ?
                                    if (
                                        v.valueType != null &&
                                        v.valueType.dataObjectType != null &&
                                        v.valueType.dataObjectType.name != null &&
                                        typeof v.valueType.dataObjectType.name === "string"
                                    ) {
                                        // XSD schemaTypes, https://www.w3.org/TR/xmlschema-2/#built-in-datatypes
                                        switch (v.valueType.dataObjectType.name) {
                                            case "boolean":
                                                form[tdTerm] = form[v.value] === "true";
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
                                                form[tdTerm] = Number(form[v.value]);
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
        if (
            submodel instanceof Object &&
            submodel.idShort != null &&
            submodel.idShort === "AssetInterfacesDescription"
        ) {
            if (submodel.submodelElements instanceof Array) {
                for (const submodelElement of submodel.submodelElements) {
                    if (submodelElement instanceof Object) {
                        logDebug("SubmodelElement.idShort: " + submodelElement.idShort);
                        if (typeof submodelRegex === "string" && submodelRegex.length > 0) {
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
        if (submodelElement.value instanceof Array) {
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
                        if (smValue.value instanceof Array) {
                            for (const interactionValue of smValue.value) {
                                if (interactionValue.idShort === "properties") {
                                    if (interactionValue.value instanceof Array) {
                                        for (const iValue of interactionValue.value) {
                                            logInfo("Property: " + iValue.idShort);
                                            if (!smInformation.properties.has(iValue.idShort)) {
                                                smInformation.properties.set(iValue.idShort, []);
                                            }
                                            const propInter: AASInteraction = {
                                                endpointMetadata,
                                                interaction: iValue,
                                            };
                                            smInformation.properties.get(iValue.idShort)?.push(propInter);
                                        }
                                    }
                                } else if (interactionValue.idShort === "actions") {
                                    if (interactionValue.value instanceof Array) {
                                        for (const iValue of interactionValue.value) {
                                            logInfo("Action: " + iValue.idShort);
                                            if (!smInformation.actions.has(iValue.idShort)) {
                                                smInformation.actions.set(iValue.idShort, []);
                                            }
                                            const actInter: AASInteraction = {
                                                endpointMetadata,
                                                interaction: iValue,
                                            };
                                            smInformation.actions.get(iValue.idShort)?.push(actInter);
                                        }
                                    }
                                } else if (interactionValue.idShort === "events") {
                                    if (interactionValue.value instanceof Array) {
                                        for (const iValue of interactionValue.value) {
                                            logInfo("Event: " + iValue.idShort);
                                            if (!smInformation.events.has(iValue.idShort)) {
                                                smInformation.events.set(iValue.idShort, []);
                                            }
                                            const evInter: AASInteraction = {
                                                endpointMetadata,
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

        if (aidModel instanceof Object && aidModel.submodels != null) {
            if (aidModel.submodels instanceof Array) {
                for (const submodel of aidModel.submodels) {
                    this.processSubmodel(smInformation, submodel, submodelRegex);
                }
            }
        }

        return smInformation;
    }

    private _transform(smInformation: SubmodelInformation, template?: string): string {
        const thing: Thing = template != null ? JSON.parse(template) : {};

        // walk over thing information and set them
        for (const [key, value] of smInformation.thing) {
            if (typeof value === "string") {
                thing[key] = value;
            } else {
                // TODO what to do with non-string values?
            }
        }

        // required TD fields
        if (thing["@context"] == null) {
            thing["@context"] = "https://www.w3.org/2022/wot/td/v1.1";
        }
        if (!thing.title) {
            thing.title = "?TODO?"; // generate one?
        }

        // Security in AID is defined for each submodel
        // add "securityDefinitions" globally and add them on form level if necessary
        // TODO: possible collisions for "security" names *could* be handled by cnt
        if (thing.securityDefinitions == null) {
            thing.securityDefinitions = {};
        }
        // let cnt = 1;
        const secNamesForEndpointMetadata = new Map<Record<string, unknown>, string[]>();
        for (const endpointMetadata of smInformation.endpointMetadataArray) {
            const secNames: Array<string> = [];
            // update base, securityDefinitions, security, ...
            this.updateRootMetadata(thing, endpointMetadata);
            // iterate over securitySchemes
            // eslint-disable-next-line unused-imports/no-unused-vars
            for (const [key, value] of Object.entries(thing.securityDefinitions)) {
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
                                    if (aasDescriptionEntry.language != null && aasDescriptionEntry.text != null) {
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
                                        if (interactionValue.min != null) {
                                            thing.properties[key].min = interactionValue.min;
                                        }
                                        if (interactionValue.max != null) {
                                            thing.properties[key].max = interactionValue.max;
                                        }
                                    } else if (interactionValue.idShort === "observable") {
                                        thing.properties[key].observable = interactionValue.value === "true";
                                    } else if (interactionValue.idShort === "readOnly") {
                                        thing.properties[key].readOnly = interactionValue.value === "true";
                                    } else if (interactionValue.idShort === "writeOnly") {
                                        thing.properties[key].writeOnly = interactionValue.value === "true";
                                    } else if (interactionValue.idShort === "min_max") {
                                        // special treatment
                                        if (thing.properties[key].type == null) {
                                            thing.properties[key].type = "number";
                                        }
                                        if (interactionValue.min != null) {
                                            thing.properties[key].minimum = Number(interactionValue.min);
                                        }
                                        if (interactionValue.max != null) {
                                            thing.properties[key].maximum = Number(interactionValue.max);
                                        }
                                    } else if (interactionValue.idShort === "itemsRange") {
                                        // special treatment
                                        if (thing.properties[key].type == null) {
                                            thing.properties[key].type = "array";
                                        }
                                        if (interactionValue.min != null) {
                                            thing.properties[key].minItems = Number(interactionValue.min);
                                        }
                                        if (interactionValue.max != null) {
                                            thing.properties[key].maxItems = Number(interactionValue.max);
                                        }
                                    } else if (interactionValue.idShort === "lengthRange") {
                                        // special treatment
                                        if (thing.properties[key].type == null) {
                                            thing.properties[key].type = "string";
                                        }
                                        if (interactionValue.min != null) {
                                            thing.properties[key].minLength = Number(interactionValue.min);
                                        }
                                        if (interactionValue.max != null) {
                                            thing.properties[key].maxLength = Number(interactionValue.max);
                                        }
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

    private createEndpointMetadata(td: ThingDescription): Record<string, unknown> {
        const values: Array<unknown> = [];

        // base ?
        if (td.base != null) {
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
        if (td.security != null) {
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
                            if (formElementProperty.href != null && formElementProperty.href.startsWith(protocol)) {
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
                    if (propertyValue.type != null) {
                        propertyValues.push({
                            idShort: "type",
                            valueType: "xs:string",
                            value: propertyValue.type,
                            modelType: "Property",
                        });
                        // special AID treatment
                        if (propertyValue.minimum != null || propertyValue.maximum != null) {
                            const minMax: { [k: string]: unknown } = {
                                idShort: "min_max",
                                valueType:
                                    "integer".localeCompare(propertyValue.type) === 0 ? "xs:integer" : "xs:double",
                                modelType: "Range",
                            };
                            if (propertyValue.minimum != null) {
                                minMax.min = propertyValue.minimum.toString();
                            }
                            if (propertyValue.maximum != null) {
                                minMax.max = propertyValue.maximum.toString();
                            }
                            propertyValues.push(minMax);
                        }
                        if (propertyValue.minItems != null || propertyValue.maxItems != null) {
                            const itemsRange: { [k: string]: unknown } = {
                                idShort: "itemsRange",
                                valueType: "xs:integer",
                                modelType: "Range",
                            };
                            if (propertyValue.minItems != null) {
                                itemsRange.min = propertyValue.minItems.toString();
                            }
                            if (propertyValue.maxItems != null) {
                                itemsRange.max = propertyValue.maxItems.toString();
                            }
                            propertyValues.push(itemsRange);
                        }
                        if (propertyValue.minLength != null || propertyValue.maxLength != null) {
                            const lengthRange: { [k: string]: unknown } = {
                                idShort: "lengthRange",
                                valueType: "xs:integer",
                                modelType: "Range",
                            };
                            if (propertyValue.minLength != null) {
                                lengthRange.min = propertyValue.minLength.toString();
                            }
                            if (propertyValue.maxLength != null) {
                                lengthRange.max = propertyValue.maxLength.toString();
                            }
                            propertyValues.push(lengthRange);
                        }
                    }
                    // title
                    if (propertyValue.title != null) {
                        propertyValues.push({
                            idShort: "title",
                            valueType: "xs:string",
                            value: propertyValue.title,
                            modelType: "Property",
                        });
                    }
                    // description
                    if (propertyValue.description != null) {
                        propertyValues.push({
                            idShort: "description",
                            valueType: "xs:string",
                            value: propertyValue.description,
                            modelType: "Property",
                        });
                    }
                    // observable (if it deviates from the default == false only)
                    if (propertyValue.observable != null && propertyValue.observable === true) {
                        propertyValues.push({
                            idShort: "observable",
                            valueType: "xs:boolean",
                            value: `${propertyValue.observable}`, // in AID represented as string
                            modelType: "Property",
                        });
                    }
                    // contentMediaType
                    if (propertyValue.contentMediaType != null) {
                        propertyValues.push({
                            idShort: "contentMediaType",
                            valueType: "xs:string",
                            value: propertyValue.contentMediaType,
                            modelType: "Property",
                        });
                    }
                    // TODO enum
                    // const
                    if (propertyValue.const != null) {
                        propertyValues.push({
                            idShort: "const",
                            valueType: "xs:string",
                            value: propertyValue.const,
                            modelType: "Property",
                        });
                    }
                    // default
                    if (propertyValue.default != null) {
                        propertyValues.push({
                            idShort: "default",
                            valueType: "xs:string",
                            value: propertyValue.default,
                            modelType: "Property",
                        });
                    }
                    // unit
                    if (propertyValue.unit != null) {
                        propertyValues.push({
                            idShort: "unit",
                            valueType: "xs:string",
                            value: propertyValue.unit,
                            modelType: "Property",
                        });
                    }

                    // readOnly and writeOnly marked as EXTERNAL in AID spec
                    // range and others? Simply add them as is?

                    // forms
                    if (formElementPicked != null) {
                        const propertyForm: Array<unknown> = [];

                        // TODO AID for now supports just *one* href/form
                        // --> pick the first one that matches protocol (other means in future?)

                        // walk over string values like: "href", "contentType", "htv:methodName", ...
                        for (let formTerm in formElementPicked) {
                            let formValue = formElementPicked[formTerm];

                            // Note: node-wot uses absolute URIs *almost* everywhere but we want to use "base" in AID
                            // --> try to create relative href's as much as possible
                            if (
                                formTerm === "href" &&
                                td.base != null &&
                                td.base.length > 0 &&
                                typeof formValue === "string" &&
                                formValue.startsWith(td.base)
                            ) {
                                formValue = formValue.substring(td.base.length);
                                console.log("dsadsa: " + formValue);
                            }

                            // Note: AID does not allow idShort to contain values with colon (i.e., ":") --> "_" used instead
                            // TODO are there more characters we need to deal with?
                            formTerm = formTerm.replace(":", "_");

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
                    } else if (propertyValue.description != null) {
                        // fallback
                        description = [];
                        description.push({
                            language: "en", // TODO where to get language identifier
                            text: propertyValue.description,
                        });
                    }

                    properties.push({
                        idShort: propertyKey,
                        description,
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
            idShort: "properties",
            value: properties,
            modelType: "SubmodelElementCollection",
        });
        // Actions
        values.push({
            idShort: "actions",
            value: actions,
            modelType: "SubmodelElementCollection",
        });
        // Events
        values.push({
            idShort: "events",
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
