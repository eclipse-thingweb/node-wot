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

import debug from "debug";
const namespace = "node-wot:td-tools:asset-interface-description-util";
const logDebug = debug(`${namespace}:debug`);
const logInfo = debug(`${namespace}:info`);

/** Utilities around Asset Interface Description
 * https://github.com/admin-shell-io/submodel-templates/tree/main/development/Asset%20Interface%20Description/1/0
 *
 * e.g, transform to TD
 *
 */

/*
 * TODOs
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

    endpointMetadataArray: Array<Record<string, unknown>>;
}

const noSecSS: SecurityScheme = { scheme: "nosec" };
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

    private getSecuritySchemesFromEndpointMetadata(
        endpointMetadata?: Record<string, unknown>
    ): Array<SecurityScheme> | undefined {
        if (endpointMetadata?.value && endpointMetadata.value instanceof Array) {
            for (const v of endpointMetadata.value) {
                if (v.idShort === "securityDefinitions") {
                    const securitySchemes: Array<SecurityScheme> = [];
                    if (v.value && v.value instanceof Array) {
                        for (const secValue of v.value) {
                            // allow all *other* security schemes like "uasec" as welll
                            const ss: SecurityScheme = { scheme: secValue.idShort };
                            securitySchemes.push(ss);
                            /* if (secValue.idShort === "nosec" || secValue.idShort === "auto" || secValue.idShort === "combo" || secValue.idShort === "basic" || secValue.idShort === "digest" || secValue.idShort === "apikey" || secValue.idShort === "bearer" || secValue.idShort === "psk" || secValue.idShort === "oauth2" ) {
                                const ss : SecurityScheme = { scheme: secValue.idShort};
                                securitySchemes.push(ss);
                            } */
                            if (secValue.value && secValue.value instanceof Array) {
                                for (const v of secValue.value) {
                                    if (v.idShort && typeof v.idShort === "string" && v.idShort.length > 0 && v.value) {
                                        ss[v.idShort] = v.value;
                                    }
                                }
                            }
                        }
                    }
                    return securitySchemes;
                }
            }
        }
        return undefined;
    }

    private createInteractionForm(vi: AASInteraction, addSecurity: boolean): TD.Form {
        const form: TD.Form = {
            href: this.getBaseFromEndpointMetadata(vi.endpointMetadata),
            contentType: this.getContentTypeFromEndpointMetadata(vi.endpointMetadata),
        };
        // need to add security at form level at all ?
        if (addSecurity) {
            const securitySchemes = this.getSecuritySchemesFromEndpointMetadata(vi.endpointMetadata);
            if (securitySchemes === undefined) {
                form.security = [noSecName];
            } else {
                if (vi.secNamesForEndpoint) {
                    form.security = vi.secNamesForEndpoint as [string, ...string[]];
                }
            }
        }
        if (vi.interaction.value instanceof Array) {
            for (const v of vi.interaction.value) {
                // Binding HTTP
                if (v.idShort === "href") {
                    if (form.href && form.href.length > 0) {
                        form.href = form.href + v.value; // TODO handle leading/trailing slashes
                    } else {
                        form.href = v.value;
                    }
                } else if (typeof v.idShort === "string" && v.idShort.length > 0) {
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
        return form;
    }

    private processSubmodel(
        smInformation: SubmodelInformation,
        submodel: Record<string, unknown>,
        submodelRegex?: string
    ): void {
        if (submodel instanceof Object && submodel.idShort && submodel.idShort === "AssetInterfaceDescription") {
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

        // TODO required fields possible in AID also?
        if (!thing["@context"]) {
            thing["@context"] = "https://www.w3.org/2022/wot/td/v1.1";
        }
        if (!thing.title) {
            thing.title = "?TODO?"; // generate one?
        }

        // Security in AID is defined for each submodel
        // add "securityDefinitions" globally and add them on form level if necessary
        // Note: possible collisions for "security" names handled by cnt
        if (!thing.securityDefinitions) {
            thing.securityDefinitions = {};
        }
        let cnt = 1;
        const secSchemeNamesAll = new Array<string>();
        const secNamesForEndpointMetadata = new Map<Record<string, unknown>, string[]>();
        for (const endpointMetadata of smInformation.endpointMetadataArray) {
            const secNames: Array<string> = [];
            const securitySchemes = this.getSecuritySchemesFromEndpointMetadata(endpointMetadata);
            if (securitySchemes === undefined) {
                // we need "nosec" scheme
                thing.securityDefinitions[noSecName] = noSecSS;
                secSchemeNamesAll.push(noSecName);
                secNames.push(noSecName);
            } else {
                // iterate over securitySchemes
                for (const secScheme of securitySchemes) {
                    const secName = cnt + "_sc";
                    thing.securityDefinitions[secName] = secScheme;
                    secSchemeNamesAll.push(secName);
                    secNames.push(secName);
                    cnt++;
                }
            }
            secNamesForEndpointMetadata.set(endpointMetadata, secNames);
        }
        if (secSchemeNamesAll.length === 0) {
            thing.securityDefinitions.nosec_sc = noSecSS;
            thing.security = [noSecName];
        } else {
            thing.security = secSchemeNamesAll as [string, ...string[]];
        }

        // add interactions
        // 1. properties
        logDebug("########### PROPERTIES (" + smInformation.properties.size + ")");
        if (smInformation.properties.size > 0) {
            thing.properties = {};

            for (const entry of smInformation.properties.entries()) {
                const key = entry[0];
                const value: AASInteraction[] = entry[1];
                logInfo("Property" + key + " = " + value);

                thing.properties[key] = {};
                thing.properties[key].forms = [];

                for (const vi of value) {
                    // The first block of if condition is expected to be temporary. will be adjusted or removed when a decision on how the datapoint's datatype would be modelled is made for AID.
                    if (vi.interaction.constraints && vi.interaction.constraints instanceof Array) {
                        for (const constraint of vi.interaction.constraints)
                            if (constraint.type === "valueType") {
                                if (constraint.value === "float") {
                                    thing.properties[key].type = "number";
                                } else {
                                    thing.properties[key].type = constraint.value;
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

            for (const entry of smInformation.actions.entries()) {
                const key = entry[0];
                const value: AASInteraction[] = entry[1];
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

            for (const entry of smInformation.events.entries()) {
                const key = entry[0];
                const value: AASInteraction[] = entry[1];
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
        return this.transformAAS2TD(aid, submodelRegex);
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
        };

        this.processSubmodel(smInformation, submodel, submodelRegex);

        return this._transform(smInformation, template);
    }
}
