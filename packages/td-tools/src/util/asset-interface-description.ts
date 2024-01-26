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

import Thing from "../thing-description";
import * as TD from "../thing-description";
import { SecurityScheme } from "wot-thing-description-types";
import * as TDParser from "../td-parser";

import debug from "debug";
import { ThingDescription } from "wot-typescript-definitions";
import { FormElementBase, PropertyElement } from "wot-thing-model-types";
import isAbsoluteUrl = require("is-absolute-url");
import URLToolkit = require("url-toolkit");
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
                    idShort: this.sanitizeIdShort(aasName),
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
            const submodelElementIdShort = this.sanitizeIdShort(
                protocol === undefined ? "Interface" : "Interface" + protocol.toUpperCase()
            );

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

            const values = [
                {
                    idShort: "title",
                    valueType: "xs:string",
                    value: td.title,
                    modelType: "Property",
                    semanticId: this.createSemanticId("https://www.w3.org/2019/wot/td#title"),
                },
                this.createEndpointMetadata(td, protocol, aidID, submodelElementIdShort), // EndpointMetadata like base, security and securityDefinitions
                this.createInteractionMetadata(td, protocol), // InteractionMetadata like properties, actions and events
                // Note: "ExternalDescriptor" should contain file values --> not applicable to TD
                /* {
                    idShort: "ExternalDescriptor",
                    semanticId: this.createSemanticId(
                        "https://admin-shell.io/idta/AssetInterfacesDescription/1/0/ExternalDescriptor"
                    ),
                    // embeddedDataSpecifications ?
                    value: [],
                    modelType: "SubmodelElementCollection",
                }, */
            ];
            if (td.created != null) {
                values.push({
                    idShort: "created",
                    valueType: "xs:dateTime",
                    value: td.created,
                    modelType: "Property",
                    semanticId: this.createSemanticId("http://purl.org/dc/terms/created"),
                });
            }
            if (td.modified != null) {
                values.push({
                    idShort: "modified",
                    valueType: "xs:dateTime",
                    value: td.modified,
                    modelType: "Property",
                    semanticId: this.createSemanticId("http://purl.org/dc/terms/modified"),
                });
            }
            if (td.support != null) {
                values.push({
                    idShort: "support",
                    valueType: "xs:anyURI",
                    value: td.support,
                    modelType: "Property",
                    semanticId: this.createSemanticId("https://www.w3.org/2019/wot/td#supportContact"),
                });
            }

            const submdelElement = {
                idShort: submodelElementIdShort,
                semanticId: this.createSemanticId(
                    "https://admin-shell.io/idta/AssetInterfacesDescription/1/0/Interface"
                ),
                supplementalSemanticIds,
                // embeddedDataSpecifications needed?
                value: values,
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

    private replaceCharAt(str: string, index: number, char: string) {
        if (index > str.length - 1) return str;
        return str.substring(0, index) + char + str.substring(index + 1);
    }

    private sanitizeIdShort(value: string): string {
        // idShort of Referables shall only feature letters, digits, underscore ("_");
        // starting mandatory with a letter, i.e. [a-zA-Z][a-zA-Z0-9]*.
        //
        // see https://github.com/eclipse-thingweb/node-wot/issues/1145
        // and https://github.com/admin-shell-io/aas-specs/issues/295
        if (value != null) {
            for (let i = 0; i < value.length; i++) {
                const char = value.charCodeAt(i);
                if (i !== 0 && char === " ".charCodeAt(0)) {
                    // underscore -> fine as is
                } else if (char >= "0".charCodeAt(0) && char <= "9".charCodeAt(0)) {
                    // digit -> fine as is
                } else if (char >= "A".charCodeAt(0) && char <= "Z".charCodeAt(0)) {
                    // small letter -> fine as is
                } else if (char >= "a".charCodeAt(0) && char <= "z".charCodeAt(0)) {
                    // capital letter -> fine as is
                } else {
                    // replace with underscore "_"
                    value = this.replaceCharAt(value, i, "_");
                }
            }
        }
        return value;
    }

    private getSimpleValueTypeXsd(value: unknown): string {
        // see https://www.w3.org/TR/xmlschema-2/#built-in-datatypes
        if (typeof value === "boolean") {
            return "xs:boolean";
        } else if (typeof value === "number") {
            const number = Number(value);
            // TODO XSD can be even more fine-grained
            if (Number.isInteger(number)) {
                //  int is ·derived· from long by setting the value of ·maxInclusive· to be 2147483647 and ·minInclusive· to be -2147483648
                if (number <= 2147483647 && number >= -2147483648) {
                    return "xs:int";
                } else {
                    return "xs:integer";
                }
            } else {
                return "xs:double";
            }
        } else {
            return "xs:string";
        }
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
                            if (securityValue.value != null && securityValue.value.keys instanceof Array) {
                                // e.g.,
                                // {
                                //    "type": "SubmodelElementCollection",
                                //    "value": "nosec_sc"
                                // }
                                const key = securityValue.value.keys[securityValue.value.keys.length - 1]; // last path
                                if (key.value != null) {
                                    security.push(key.value);
                                }
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
        // EndpointMetadata vs. InteractionMetadata
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
                    } else if (smValue.idShort === "InteractionMetadata") {
                        // handled later
                    } else if (smValue.idShort === "externalDescriptor") {
                        // needed?
                    } else {
                        smInformation.thing.set(smValue.idShort, smValue.value);
                    }
                }
            }
            // the 2nd time look for InteractionMetadata that *need* EndpointMetadata
            for (const smValue of submodelElement.value) {
                if (smValue instanceof Object) {
                    if (smValue.idShort === "InteractionMetadata") {
                        logInfo("InteractionMetadata");
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

    private createEndpointMetadata(
        td: ThingDescription,
        protocol: string,
        submodelIdShort: string,
        submodelElementIdShort: string
    ): Record<string, unknown> {
        const values: Array<unknown> = [];

        // base (AID requires base)
        let base = td.base ?? "NO_BASE";
        if (td.base == null && td.properties) {
            // do best effort if base is not specified by looking at property forms
            for (const propertyKey in td.properties) {
                const property: PropertyElement = td.properties[propertyKey];
                // check whether form exists for a given protocol (prefix)
                const formElementPicked = this.getFormForProtocol(property, protocol);
                if (formElementPicked?.href !== undefined) {
                    const urlParts = URLToolkit.parseURL(formElementPicked.href);
                    if (urlParts != null) {
                        // keep scheme and netLoc only
                        urlParts.path = urlParts.params = urlParts.query = urlParts.fragment = "";
                        base = URLToolkit.buildURLFromParts(urlParts);
                        continue; // abort to loop over remaining properties
                    }
                }
            }
        }
        values.push({
            idShort: "base",
            semanticId: this.createSemanticId("https://www.w3.org/2019/wot/td#baseURI"),
            valueType: "xs:anyURI",
            value: base,
            modelType: "Property",
        });

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
                    value: {
                        type: "ModelReference",
                        keys: [
                            {
                                type: "Submodel",
                                value: submodelIdShort,
                            },
                            {
                                type: "SubmodelElementCollection",
                                value: submodelElementIdShort,
                            },
                            {
                                type: "SubmodelElementCollection",
                                value: "EndpointMetadata",
                            },
                            {
                                type: "SubmodelElementCollection",
                                value: "securityDefinitions",
                            },
                            {
                                type: "SubmodelElementCollection",
                                value: secKey,
                            },
                        ],
                    },
                    modelType: "ReferenceElement",
                });
            }
        }
        values.push({
            idShort: "security",
            semanticId: this.createSemanticId("https://www.w3.org/2019/wot/td#hasSecurityConfiguration"),
            typeValueListElement: "ReferenceElement",
            value: securityValues,
            modelType: "SubmodelElementList",
        });

        // securityDefinitions
        const securityDefinitionsValues: Array<unknown> = [];
        for (const secKey in td.securityDefinitions) {
            const secValue: SecurityScheme = td.securityDefinitions[secKey];
            const values = [];
            // scheme always
            values.push({
                idShort: "scheme",
                semanticId: this.createSemanticId("https://www.w3.org/2019/wot/security#SecurityScheme"),
                valueType: "xs:string",
                value: secValue.scheme,
                modelType: "Property",
            });
            // other security information
            if (secValue.proxy != null) {
                values.push({
                    idShort: "proxy",
                    semanticId: this.createSemanticId("https://www.w3.org/2019/wot/security#proxy"),
                    valueType: "xs:string",
                    value: secValue.proxy,
                    modelType: "Property",
                });
            }
            if (secValue.name != null) {
                values.push({
                    idShort: "name",
                    semanticId: this.createSemanticId("https://www.w3.org/2019/wot/security#name"),
                    valueType: "xs:string",
                    value: secValue.name,
                    modelType: "Property",
                });
            }
            if (secValue.in != null) {
                values.push({
                    idShort: "in",
                    semanticId: this.createSemanticId("https://www.w3.org/2019/wot/security#in"),
                    valueType: "xs:string",
                    value: secValue.in,
                    modelType: "Property",
                });
            }
            if (secValue.qop != null) {
                values.push({
                    idShort: "qop",
                    semanticId: this.createSemanticId("https://www.w3.org/2019/wot/security#qop"),
                    valueType: "xs:string",
                    value: secValue.qop,
                    modelType: "Property",
                });
            }
            if (secValue.authorization != null) {
                values.push({
                    idShort: "authorization",
                    semanticId: this.createSemanticId("https://www.w3.org/2019/wot/security#authorization"),
                    valueType: "xs:string",
                    value: secValue.authorization,
                    modelType: "Property",
                });
            }
            if (secValue.alg != null) {
                values.push({
                    idShort: "alg",
                    semanticId: this.createSemanticId("https://www.w3.org/2019/wot/security#alg"),
                    valueType: "xs:string",
                    value: secValue.alg,
                    modelType: "Property",
                });
            }
            if (secValue.format != null) {
                values.push({
                    idShort: "format",
                    semanticId: this.createSemanticId("https://www.w3.org/2019/wot/security#format"),
                    valueType: "xs:string",
                    value: secValue.format,
                    modelType: "Property",
                });
            }
            if (secValue.identity != null) {
                values.push({
                    idShort: "identity",
                    semanticId: this.createSemanticId("https://www.w3.org/2019/wot/security#identity"),
                    valueType: "xs:string",
                    value: secValue.identity,
                    modelType: "Property",
                });
            }
            if (secValue.token != null) {
                values.push({
                    idShort: "token",
                    semanticId: this.createSemanticId("https://www.w3.org/2019/wot/security#token"),
                    valueType: "xs:string",
                    value: secValue.token,
                    modelType: "Property",
                });
            }
            if (secValue.refresh != null) {
                values.push({
                    idShort: "refresh",
                    semanticId: this.createSemanticId("https://www.w3.org/2019/wot/security#refresh"),
                    valueType: "xs:string",
                    value: secValue.refresh,
                    modelType: "Property",
                });
            }
            if (secValue.scopes != null) {
                values.push({
                    idShort: "scopes",
                    semanticId: this.createSemanticId("https://www.w3.org/2019/wot/security#scopes"),
                    valueType: "xs:string",
                    value: secValue.scopes,
                    modelType: "Property",
                });
            }
            if (secValue.flow != null) {
                values.push({
                    idShort: "flow",
                    semanticId: this.createSemanticId("https://www.w3.org/2019/wot/security#flow"),
                    valueType: "xs:string",
                    value: secValue.flow,
                    modelType: "Property",
                });
            }

            securityDefinitionsValues.push({
                idShort: secKey,
                value: values,
                modelType: "SubmodelElementCollection",
            });
        }
        values.push({
            idShort: "securityDefinitions",
            semanticId: this.createSemanticId("https://www.w3.org/2019/wot/td#definesSecurityScheme"),
            value: securityDefinitionsValues,
            modelType: "SubmodelElementCollection",
        });

        const endpointMetadata: Record<string, unknown> = {
            idShort: "EndpointMetadata",
            semanticId: this.createSemanticId(
                "https://admin-shell.io/idta/AssetInterfacesDescription/1/0/EndpointMetadata"
            ),
            // embeddedDataSpecifications ?
            value: values,
            modelType: "SubmodelElementCollection",
        };

        return endpointMetadata;
    }

    private getFormForProtocol(property: PropertyElement, protocol: string): FormElementBase | undefined {
        let formElementPicked: FormElementBase | undefined;
        // check whether protocol prefix exists for a form
        if (property.forms) {
            for (const formElementProperty of property.forms) {
                if (formElementProperty.href != null && formElementProperty.href.startsWith(protocol)) {
                    formElementPicked = formElementProperty;
                    // found matching form --> abort loop
                    break;
                }
            }
        }
        return formElementPicked;
    }

    private hasOp(form: FormElementBase, op: string): boolean {
        if (form.op != null) {
            if (typeof form.op === "string" && form.op === op) {
                return true;
            } else if (Array.isArray(form.op) && form.op.includes(op)) {
                return true;
            }
        }
        return false;
    }

    private addRequiredAidTermsForForm(form: FormElementBase, protocol: string): void {
        if (form == null || protocol == null) {
            return;
        }
        if (protocol.startsWith("http")) {
            // HTTP: href, htv_methodName
            // default for htv:methodName depending on op, see https://w3c.github.io/wot-binding-templates/bindings/protocols/http/index.html#http-default-vocabulary-terms
            const htvKey = "htv:methodName";
            if (form[htvKey] == null) {
                if (
                    this.hasOp(form, "readproperty") ||
                    this.hasOp(form, "readallproperties") ||
                    this.hasOp(form, "readmultipleproperties")
                ) {
                    form[htvKey] = "GET";
                } else if (
                    this.hasOp(form, "writeproperty") ||
                    this.hasOp(form, "writeallproperties") ||
                    this.hasOp(form, "writemultipleproperties")
                ) {
                    form[htvKey] = "PUT";
                } else if (this.hasOp(form, "invokeaction")) {
                    form[htvKey] = "POST";
                }
            }
        } else if (protocol.startsWith("modbus")) {
            // Modbus: href, modv_function
            // default for modv:function depending on op, see https://w3c.github.io/wot-binding-templates/bindings/protocols/modbus/index.html#default-mappings
            const mbKey = "modv:function";
            if (form[mbKey] == null) {
                if (this.hasOp(form, "writeproperty") || this.hasOp(form, "invokeaction")) {
                    form[mbKey] = "writeSingleCoil";
                } else if (this.hasOp(form, "readallproperties") || this.hasOp(form, "readmultipleproperties")) {
                    form[mbKey] = "readHoldingRegisters";
                } else if (this.hasOp(form, "writeallproperties") || this.hasOp(form, "writemultipleproperties")) {
                    form[mbKey] = "writeMultipleHoldingRegisters";
                }
            }
        } else if (protocol.startsWith("mqtt")) {
            // MQTT: href, mqv_controlPacket
            // default for mqv:controlPacket depending on op, see https://w3c.github.io/wot-binding-templates/bindings/protocols/mqtt/index.html#default-mappings
            const mqvKey = "mqv:controlPacket";
            if (form[mqvKey] == null) {
                if (
                    this.hasOp(form, "readproperty") ||
                    this.hasOp(form, "observeproperty") ||
                    this.hasOp(form, "readallproperties") ||
                    this.hasOp(form, "readmultipleproperties") ||
                    this.hasOp(form, "subscribeevent")
                ) {
                    form[mqvKey] = "subscribe";
                } else if (
                    this.hasOp(form, "writeproperty") ||
                    this.hasOp(form, "writeallproperties") ||
                    this.hasOp(form, "writemultipleproperties") ||
                    this.hasOp(form, "invokeaction")
                ) {
                    form[mqvKey] = "publish";
                } else if (this.hasOp(form, "unobserveproperty") || this.hasOp(form, "unsubscribeevent")) {
                    form[mqvKey] = "unsubscribe";
                }
            }
        }
    }

    private createInteractionMetadata(td: ThingDescription, protocol: string): Record<string, unknown> {
        const properties: Array<unknown> = [];
        const actions: Array<unknown> = [];
        const events: Array<unknown> = [];

        if (protocol) {
            // Properties
            if (td.properties) {
                for (const propertyKey in td.properties) {
                    const property: PropertyElement = td.properties[propertyKey];

                    // check whether form exists for a given protocol (prefix)
                    const formElementPicked = this.getFormForProtocol(property, protocol);
                    if (formElementPicked === undefined) {
                        // do not add this property, since there will be no href of interest
                        continue;
                    }

                    const propertyValues: Array<unknown> = [];
                    // type
                    if (property.type != null) {
                        propertyValues.push({
                            idShort: "type",
                            semanticId: this.createSemanticId("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
                            valueType: "xs:string",
                            value: property.type,
                            modelType: "Property",
                        });
                        // special AID treatment
                        if (property.minimum != null || property.maximum != null) {
                            const minMax: { [k: string]: unknown } = {
                                idShort: "min_max",
                                semanticId: this.createSemanticId(
                                    "https://admin-shell.io/idta/AssetInterfacesDescription/1/0/minMaxRange"
                                ),
                                supplementalSemanticIds: [],
                                valueType: "integer".localeCompare(property.type) === 0 ? "xs:integer" : "xs:double",
                                modelType: "Range",
                            };
                            if (property.minimum != null) {
                                minMax.min = property.minimum.toString();
                                (minMax.supplementalSemanticIds as Array<unknown>).push(
                                    this.createSemanticId("https://www.w3.org/2019/wot/json-schema#minimum")
                                );
                            }
                            if (property.maximum != null) {
                                minMax.max = property.maximum.toString();
                                (minMax.supplementalSemanticIds as Array<unknown>).push(
                                    this.createSemanticId("https://www.w3.org/2019/wot/json-schema#maximum")
                                );
                            }
                            propertyValues.push(minMax);
                        }
                        if (property.minItems != null || property.maxItems != null) {
                            const itemsRange: { [k: string]: unknown } = {
                                idShort: "itemsRange",
                                semanticId: this.createSemanticId(
                                    "https://admin-shell.io/idta/AssetInterfacesDescription/1/0/itemsRange"
                                ),
                                supplementalSemanticIds: [],
                                valueType: "xs:integer",
                                modelType: "Range",
                            };
                            if (property.minItems != null) {
                                itemsRange.min = property.minItems.toString();
                                (itemsRange.supplementalSemanticIds as Array<unknown>).push(
                                    this.createSemanticId("https://www.w3.org/2019/wot/json-schema#minItems")
                                );
                            }
                            if (property.maxItems != null) {
                                itemsRange.max = property.maxItems.toString();
                                (itemsRange.supplementalSemanticIds as Array<unknown>).push(
                                    this.createSemanticId("https://www.w3.org/2019/wot/json-schema#maxItems")
                                );
                            }
                            propertyValues.push(itemsRange);
                        }
                        if (property.minLength != null || property.maxLength != null) {
                            const lengthRange: { [k: string]: unknown } = {
                                idShort: "lengthRange",
                                semanticId: this.createSemanticId(
                                    "https://admin-shell.io/idta/AssetInterfacesDescription/1/0/lengthRange"
                                ),
                                supplementalSemanticIds: [],
                                valueType: "xs:integer",
                                modelType: "Range",
                            };
                            if (property.minLength != null) {
                                lengthRange.min = property.minLength.toString();
                                (lengthRange.supplementalSemanticIds as Array<unknown>).push(
                                    this.createSemanticId("https://www.w3.org/2019/wot/json-schema#minLength")
                                );
                            }
                            if (property.maxLength != null) {
                                lengthRange.max = property.maxLength.toString();
                                (lengthRange.supplementalSemanticIds as Array<unknown>).push(
                                    this.createSemanticId("https://www.w3.org/2019/wot/json-schema#maxLength")
                                );
                            }
                            propertyValues.push(lengthRange);
                        }
                    }
                    // title
                    if (property.title != null) {
                        propertyValues.push({
                            idShort: "title",
                            semanticId: this.createSemanticId("https://www.w3.org/2019/wot/td#title"),
                            valueType: "xs:string",
                            value: property.title,
                            modelType: "Property",
                        });
                    }
                    // description
                    if (property.description != null) {
                        // AID deals with description in level above
                    }
                    // observable (if it deviates from the default == false only)
                    if (property.observable != null && property.observable === true) {
                        propertyValues.push({
                            idShort: "observable",
                            semanticId: this.createSemanticId("https://www.w3.org/2019/wot/td#isObservable"),
                            valueType: "xs:boolean",
                            value: `${property.observable}`, // in AID represented as string
                            modelType: "Property",
                        });
                    }
                    // contentMediaType
                    if (property.contentMediaType != null) {
                        propertyValues.push({
                            idShort: "contentMediaType",
                            semanticId: this.createSemanticId(
                                "https://www.w3.org/2019/wot/json-schema#contentMediaType"
                            ),
                            valueType: "xs:string",
                            value: property.contentMediaType,
                            modelType: "Property",
                        });
                    }
                    // TODO enum
                    // const
                    if (property.const != null) {
                        propertyValues.push({
                            idShort: "const",
                            valueType: "xs:string",
                            value: property.const,
                            modelType: "Property",
                        });
                    }
                    // default
                    if (property.default != null) {
                        propertyValues.push({
                            idShort: "default",
                            semanticId: this.createSemanticId("https://www.w3.org/2019/wot/json-schema#default"),
                            valueType: this.getSimpleValueTypeXsd(property.default),
                            value: property.default,
                            modelType: "Property",
                        });
                    }
                    // unit
                    if (property.unit != null) {
                        propertyValues.push({
                            idShort: "unit",
                            valueType: "xs:string",
                            value: property.unit,
                            modelType: "Property",
                        });
                    }
                    // TODO items

                    // readOnly and writeOnly marked as EXTERNAL in AID spec
                    // range and others? Simply add them as is?

                    // forms
                    if (formElementPicked != null) {
                        const propertyForm: Array<unknown> = [];

                        // TODO AID for now supports just *one* href/form
                        // --> pick the first one that matches protocol (other means in future?)

                        // AID has required terms that need to be present always for a given interface
                        this.addRequiredAidTermsForForm(formElementPicked, protocol);

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
                            }

                            let semanticId;
                            if (formTerm === "href") {
                                semanticId = "https://www.w3.org/2019/wot/hypermedia#hasTarget";
                            } else if (formTerm === "contentType") {
                                semanticId = "https://www.w3.org/2019/wot/hypermedia#forContentType";
                            } else if (formTerm === "htv:methodName") {
                                semanticId = "https://www.w3.org/2011/http#methodName";
                            } else if (formTerm === "htv:headers") {
                                semanticId = "https://www.w3.org/2011/http#headers";
                            } else if (formTerm === "htv:fieldName") {
                                semanticId = "https://www.w3.org/2011/http#fieldName";
                            } else if (formTerm === "htv:fieldValue") {
                                semanticId = "https://www.w3.org/2011/http#fieldValue";
                            } else if (formTerm === "modv:function") {
                                semanticId = "https://www.w3.org/2019/wot/modbus#hasFunction";
                            } else if (formTerm === "modv:entity") {
                                semanticId = "https://www.w3.org/2019/wot/modbus#hasEntity";
                            } else if (formTerm === "modv:zeroBasedAddressing") {
                                semanticId = "https://www.w3.org/2019/wot/modbus#hasZeroBasedAddressingFlag";
                            } else if (formTerm === "modv:timeout") {
                                semanticId = "https://www.w3.org/2019/wot/modbus#hasTimeout";
                            } else if (formTerm === "modv:pollingTime") {
                                semanticId = "https://www.w3.org/2019/wot/modbus#hasPollingTime";
                            } else if (formTerm === "modv:type") {
                                semanticId = "https://www.w3.org/2019/wot/modbus#hasPayloadDataType";
                            } else if (formTerm === "modv:mostSignificantByte") {
                                semanticId = "https://www.w3.org/2019/wot/modbus#hasMostSignificantByte";
                            } else if (formTerm === "modv:mostSignificantWord") {
                                semanticId = "https://www.w3.org/2019/wot/modbus#hasMostSignificantWord";
                            } else if (formTerm === "mqv:retain") {
                                semanticId = "https://www.w3.org/2019/wot/mqtt#hasRetainFlag";
                            } else if (formTerm === "mqv:controlPacket") {
                                semanticId = "https://www.w3.org/2019/wot/mqtt#ControlPacket";
                            } else if (formTerm === "mqv:qos") {
                                semanticId = "https://www.w3.org/2019/wot/mqtt#hasQoSFlag";
                            }

                            // Note: AID does not allow idShort to contain values with colon (i.e., ":") --> "_" used instead
                            // TODO are there more characters we need to deal with?
                            formTerm = formTerm.replace(":", "_");

                            if (
                                typeof formValue === "string" ||
                                typeof formValue === "number" ||
                                typeof formValue === "boolean"
                            ) {
                                // AID schema restricts terms in form to a finite set of *allowed* terms
                                // e.g., "op" is not allowed
                                // at the momement all of them have "semanticId" -> use this as check
                                if (semanticId !== undefined) {
                                    propertyForm.push({
                                        idShort: formTerm,
                                        semanticId: this.createSemanticId(semanticId),
                                        valueType: this.getSimpleValueTypeXsd(formValue),
                                        value: formValue.toString(),
                                        modelType: "Property",
                                    });
                                } else {
                                    // unknown AID term
                                    /* propertyForm.push({
                                            idShort: formTerm,
                                            valueType: this.getSimpleValueTypeXsd(formValue),
                                            value: formValue.toString(),
                                            modelType: "Property",
                                        }); */
                                }
                            }

                            // TODO terms that are not simple types like op arrays?
                        }

                        propertyValues.push({
                            idShort: "forms",
                            semanticId: this.createSemanticId("https://www.w3.org/2019/wot/td#hasForm"),
                            value: propertyForm,
                            modelType: "SubmodelElementCollection",
                        });
                    }

                    let description;
                    if (property.descriptions) {
                        description = [];
                        for (const langKey in property.descriptions) {
                            const langValue = property.descriptions[langKey];
                            description.push({
                                language: langKey,
                                text: langValue,
                            });
                        }
                    } else if (property.description != null) {
                        // fallback
                        description = [];
                        description.push({
                            language: "en", // TODO where to get language identifier
                            text: property.description,
                        });
                    }

                    properties.push({
                        idShort: propertyKey,
                        description,
                        semanticId: this.createSemanticId(
                            "https://admin-shell.io/idta/AssetInterfaceDescription/1/0/PropertyDefinition"
                        ),
                        supplementalSemanticIds: [this.createSemanticId("https://www.w3.org/2019/wot/td#name")],
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
            semanticId: this.createSemanticId("https://www.w3.org/2019/wot/td#PropertyAffordance"),
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

        const interactionMetadata: Record<string, unknown> = {
            idShort: "InteractionMetadata",
            semanticId: this.createSemanticId(
                "https://admin-shell.io/idta/AssetInterfacesDescription/1/0/InteractionMetadata"
            ),
            supplementalSemanticIds: [this.createSemanticId("https://www.w3.org/2019/wot/td#InteractionAffordance")],
            // embeddedDataSpecifications ?
            value: values,
            modelType: "SubmodelElementCollection",
        };

        return interactionMetadata;
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
