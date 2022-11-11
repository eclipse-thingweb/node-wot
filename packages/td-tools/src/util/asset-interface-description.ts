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

/** Utilities around Asset Interface Description
 * https://github.com/admin-shell-io/submodel-templates/tree/main/development/Asset%20Interface%20Description/1/0
 *
 * e.g, transform to TD
 *
 */

const TD_TEMPLATE = `{
    "@context": "https://www.w3.org/2022/wot/td/v1.1"
}`;

// "id": "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
// "title": "MyAssetInterfaceDescriptionThing",
// "securityDefinitions": {
//     "basic_sc": { "scheme": "basic", "in": "header"}
// },
// "security": "basic_sc",

/*
 * TODOs
 * - what is the desired input/output? string, object, ... ?
 * - what are options that would be desired? (context version, id, security, ...)
 *
 */

interface AASInteraction {
    endpointMetadata?: Record<string, unknown>;
    interaction: Record<string, unknown>;
}

export class AssetInterfaceDescriptionUtil {
    // TODO allow to set options

    private getBaseFromEndpointMetadata(endpointMetadata?: Record<string, unknown>): string {
        if (endpointMetadata?.value && endpointMetadata.value instanceof Array) {
            for (const v of endpointMetadata.value) {
                if (v.idShort === "base") {
                    // e.g., "value": "modbus+tcp://192.168.1.187:502"
                    return v.value;
                }
            }
        }
        return "undefined"; // TODO what is teh right value if setting cannot be found
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
        return ""; // TODO what is the right value if setting cannot be found
    }

    public transformToTD(aid: string): string {
        const thing: Thing = JSON.parse(TD_TEMPLATE);
        const aidModel = JSON.parse(aid);

        const properties: Map<string, Array<AASInteraction>> = new Map<string, Array<AASInteraction>>();
        const actions: Map<string, Array<AASInteraction>> = new Map<string, Array<AASInteraction>>();
        const events: Map<string, Array<AASInteraction>> = new Map<string, Array<AASInteraction>>();

        if (aidModel instanceof Object && aidModel.submodels) {
            if (aidModel.submodels instanceof Array) {
                console.log("### SUBMODELS");
                for (const submodel of aidModel.submodels) {
                    if (
                        submodel instanceof Object &&
                        submodel.idShort &&
                        submodel.idShort === "AssetInterfaceDescription"
                    ) {
                        // console.log(submodel);
                        if (submodel.submodelElements && submodel.submodelElements instanceof Array) {
                            for (const submodelElement of submodel.submodelElements) {
                                if (submodelElement instanceof Object) {
                                    console.log("\tSubmodelElement.idShort: " + submodelElement.idShort);

                                    // EndpointMetadata vs. InterfaceMetadata
                                    if (submodelElement.value && submodelElement.value instanceof Array) {
                                        // Note: iterate twice ove to collect first EndpointMetadata
                                        let endpointMetadata: Record<string, unknown> = {};
                                        for (const smValue of submodelElement.value) {
                                            if (smValue instanceof Object) {
                                                if (smValue.idShort === "EndpointMetadata") {
                                                    console.log("\t\t EndpointMetadata");
                                                    endpointMetadata = smValue;
                                                    // e.g., idShort: base , contentType, securityDefinitions, alternativeEndpointDescriptor?
                                                }
                                            }
                                        }
                                        // the 2nd time look for InterfaceMetadata that *need* EndpointMetadata
                                        for (const smValue of submodelElement.value) {
                                            if (smValue instanceof Object) {
                                                if (smValue.idShort === "InterfaceMetadata") {
                                                    console.log("\t\t InterfaceMetadata");
                                                    if (smValue.value && smValue.value instanceof Array) {
                                                        for (const interactionValue of smValue.value) {
                                                            if (interactionValue.idShort === "Properties") {
                                                                if (interactionValue.value instanceof Array) {
                                                                    for (const iValue of interactionValue.value) {
                                                                        console.log(
                                                                            "\t\t\t Property: " + iValue.idShort
                                                                        );
                                                                        if (!properties.has(iValue.idShort)) {
                                                                            properties.set(iValue.idShort, []);
                                                                        }
                                                                        const propInter: AASInteraction = {
                                                                            endpointMetadata: endpointMetadata,
                                                                            interaction: iValue,
                                                                        };
                                                                        properties.get(iValue.idShort)?.push(propInter);
                                                                    }
                                                                }
                                                            } else if (interactionValue.idShort === "Operations") {
                                                                if (interactionValue.value instanceof Array) {
                                                                    for (const iValue of interactionValue.value) {
                                                                        console.log("\t\t\t Action: " + iValue.idShort);
                                                                        if (!actions.has(iValue.idShort)) {
                                                                            actions.set(iValue.idShort, []);
                                                                        }
                                                                        const actInter: AASInteraction = {
                                                                            endpointMetadata: endpointMetadata,
                                                                            interaction: iValue,
                                                                        };
                                                                        actions.get(iValue.idShort)?.push(actInter);
                                                                    }
                                                                }
                                                            } else if (interactionValue.idShort === "Events") {
                                                                if (interactionValue.value instanceof Array) {
                                                                    for (const iValue of interactionValue.value) {
                                                                        console.log("\t\t\t Event: " + iValue.idShort);
                                                                        if (!events.has(iValue.idShort)) {
                                                                            events.set(iValue.idShort, []);
                                                                        }
                                                                        const evInter: AASInteraction = {
                                                                            endpointMetadata: endpointMetadata,
                                                                            interaction: iValue,
                                                                        };
                                                                        events.get(iValue.idShort)?.push(evInter);
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
                            }
                        }
                    }
                }
            }
        }

        // add interactions
        // 1. properties
        console.log("########### PROPERTIES (" + properties.size + ")");
        if (properties.size > 0) {
            thing.properties = {};

            for (const entry of properties.entries()) {
                const key = entry[0];
                const value: AASInteraction[] = entry[1];
                console.log(key + " = " + value);

                thing.properties[key] = {};
                thing.properties[key].forms = [];

                for (const vi of value) {
                    const form: TD.Form = {
                        href: this.getBaseFromEndpointMetadata(vi.endpointMetadata),
                        contentType: this.getContentTypeFromEndpointMetadata(vi.endpointMetadata),
                    };
                    thing.properties[key].forms.push(form);
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
                                // TODO Should we add all value's ?
                                // if (typeof v.value === "string" ||typeof v.value === "number" || typeof v.value === "boolean") {
                                if (v.value) {
                                    form[v.idShort] = v.value;
                                }
                            }
                            /*
                            } else if (v.idShort === "htv:methodName") {
                                console.log("TODO htv:methodName");
                            } else if (v.idShort === "contentType") {
                                console.log("TODO contentType");
                            } else if (v.idShort === "subprotocol") {
                                console.log("TODO subprotocol");
                            } else if (v.idShort === "dataMapping") {
                                console.log("TODO dataMapping");
                            }
                            // Binding Modbus
                            if (v.idShort === "modbus:function") {
                                console.log("TODO modbus:function"); // e.g., value": "readHoldingRegisters"
                            } else if (v.idShort === "modbus:address") {
                                console.log("TODO modbus:address"); // e.g., "value": "40001"
                            } else if (v.idShort === "modbus:quantity") {
                                console.log("TODO modbus:quantity"); // e.g., "value": "2"
                            }
                            // OPC
                            if (v.idShort === "ua:nodeId") {
                                console.log("TODO ua:nodeId"); // e.g., "value": "\"ns=3;i=29\""
                            } else if (v.idShort === "ua:expandedNodeId") {
                                console.log("TODO ua:expandedNodeId"); // e.g.,  "value": " \"nsu=http://example.com/OPCUAServer/energy;i=29\""
                            } else if (v.idShort === "ua:method") {
                                console.log("TODO ua:method"); // e.g., "value": "READ"
                            }
                            // MQTT
                            if (v.idShort === "mqv:topic") {
                                console.log("TODO mqv:topic"); // e.g., "value": "/devices/thing1/properties/voltage"
                            } else if (v.idShort === "mqv:controlPacket") {
                                console.log("TODO mqv:controlPacket"); // e.g.,  "value": "mqv:subscribe"
                            } else if (v.idShort === "mqv:retain") {
                                console.log("TODO mqv:retain"); // e.g., "value": "true"
                            }
                            */

                            // GENERIC
                            if (v.idShort === "dataMapping") {
                                console.log("TODO dataMapping");
                            }
                        }
                    }
                }
            }
        }

        // 2. actions
        console.log("########### ACTIONS (" + actions.size + ")");
        if (actions.size > 0) {
            thing.actions = {};

            for (const entry of actions.entries()) {
                const key = entry[0];
                const value: AASInteraction[] = entry[1];
                console.log(key + " = " + value);

                thing.actions[key] = {};
                for (const vi of value) {
                    // TODO different protocol
                    console.log(vi);
                }
            }
        }

        // 3. events
        console.log("########### EVENTS (" + events.size + ")");
        if (events.size > 0) {
            thing.events = {};

            for (const entry of events.entries()) {
                const key = entry[0];
                const value: AASInteraction[] = entry[1];
                console.log(key + " = " + value);

                thing.events[key] = {};
                for (const vi of value) {
                    // TODO different protocol
                    console.log(vi);
                }
            }
        }

        return JSON.stringify(thing);
    }
}
