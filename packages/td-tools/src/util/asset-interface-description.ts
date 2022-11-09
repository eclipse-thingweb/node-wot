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
// import * as TD from "../thing-description";

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

export class AssetInterfaceDescriptionUtil {
    // TODO allow to set options

    public transformToTD(aid: string): string {
        const thing: Thing = JSON.parse(TD_TEMPLATE);
        const aidModel = JSON.parse(aid);

        const properties: Map<string, Array<unknown>> = new Map<string, Array<unknown>>();
        const actions: Map<string, Array<unknown>> = new Map<string, Array<unknown>>();
        const events: Map<string, Array<unknown>> = new Map<string, Array<unknown>>();

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
                                console.log("D");
                                if (submodelElement instanceof Object) {
                                    console.log("\tSubmodelElement.idShort: " + submodelElement.idShort);
                                    // EndpointMetadata vs. InterfaceMetadata
                                    if (submodelElement.value && submodelElement.value instanceof Array) {
                                        for (const smValue of submodelElement.value) {
                                            if (smValue instanceof Object) {
                                                if (smValue.idShort === "EndpointMetadata") {
                                                    console.log("\t\t EndpointMetadata");
                                                } else if (smValue.idShort === "InterfaceMetadata") {
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
                                                                        properties.get(iValue.idShort)?.push(iValue);
                                                                    }
                                                                }
                                                            } else if (interactionValue.idShort === "Operations") {
                                                                if (interactionValue.value instanceof Array) {
                                                                    for (const iValue of interactionValue.value) {
                                                                        console.log("\t\t\t Action: " + iValue.idShort);
                                                                        if (!actions.has(iValue.idShort)) {
                                                                            actions.set(iValue.idShort, []);
                                                                        }
                                                                        actions.get(iValue.idShort)?.push(iValue);
                                                                    }
                                                                }
                                                            } else if (interactionValue.idShort === "Events") {
                                                                if (interactionValue.value instanceof Array) {
                                                                    for (const iValue of interactionValue.value) {
                                                                        console.log("\t\t\t Event: " + iValue.idShort);
                                                                        if (!events.has(iValue.idShort)) {
                                                                            events.set(iValue.idShort, []);
                                                                        }
                                                                        events.get(iValue.idShort)?.push(iValue);
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

        console.log("########### PROPERTIES (" + properties.size + ")");
        if (properties.size > 0) {
            thing.properties = {};

            for (const entry of properties.entries()) {
                const key = entry[0];
                const value: unknown[] = entry[1];
                console.log(key + " = " + value);

                thing.properties[key] = {};
                for (const vi of value) {
                    // TODO different protocol
                    // console.log(vi);
                }
            }
        }

        console.log("########### ACTIONS (" + actions.size + ")");
        if (actions.size > 0) {
            thing.actions = {};

            for (const entry of actions.entries()) {
                const key = entry[0];
                const value: unknown[] = entry[1];
                console.log(key + " = " + value);

                thing.actions[key] = {};
                for (const vi of value) {
                    // TODO different protocol
                    console.log(vi);
                }
            }
        }

        console.log("########### EVENTS (" + events.size + ")");
        if (events.size > 0) {
            thing.events = {};

            for (const entry of events.entries()) {
                const key = entry[0];
                const value: unknown[] = entry[1];
                console.log(key + " = " + value);

                thing.events[key] = {};
                for (const vi of value) {
                    // TODO different protocol
                    console.log(vi);
                }
            }
        }

        // TODO add interactions
        // 1. properties
        // 2. actions
        // 3. events

        return JSON.stringify(thing);
    }
}
