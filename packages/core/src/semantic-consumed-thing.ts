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

import * as WoT from "wot-typescript-definitions";

import ConsumedThing from "./consumed-thing";

/**
 * Represents a semantic composed thing (i.e. helper wrapper around ConsumedThing) to allow interactions
 * with a thing based on semantic types.
 * @experimental
 */
export default class SemanticConsumedThing extends ConsumedThing implements WoT.ConsumedThing {
    /**
     * Read a property based on semantic type
     */
    // Open Questions
    // - define semantic input as string and/or array
    // - allow AND / OR combinations? e.g., @type must have XYZ but should not have CBA
    // - do we want to make the selection on output type as well ?
    async readSemanticProperty(semanticType: string, options?: WoT.InteractionOptions): Promise<WoT.InteractionOutput> {
        // try to find property by semantic look-up
        const propertyName = this.getSemanticPropertyName(semanticType);
        if (propertyName != null) {
            // found property -> hand over to core functionality
            return this.readProperty(propertyName, options);
        }
        // no match found
        throw new Error(
            `SemanticConsumedThing '${this.title}' did not find suitable semantic property for ${semanticType}`
        );
    }

    private getSemanticPropertyName(semanticType: string): string | undefined {
        // walk over available properties and find (the) right one
        // e.g., .read( {"@type": "iot:BinarySwitchData"}
        for (const propertyName in this.properties) {
            const property = this.properties[propertyName];
            if (property["@type"] != null) {
                if (typeof property["@type"] === "string") {
                    if (property["@type"] === semanticType) {
                        return propertyName;
                    }
                } else if (Array.isArray(property["@type"])) {
                    const types = property["@type"];
                    if (types.includes(semanticType)) {
                        return propertyName;
                    }
                }
            }
        }
        return undefined;
    }

    // Open Questions
    // - is a method necessary to check for availability ?
    public isSemanticPropertyAvailable(semanticType: string): boolean {
        return this.getSemanticPropertyName(semanticType) != null;
    }

    /**
     * Write a property based on semantic type
     */
    // Open Questions
    // - how to know the input value up-front ?
    // - how to select desired property based on input type?
    async writeSemanticProperty(
        propertyName: string,
        value: WoT.InteractionInput,
        options?: WoT.InteractionOptions
    ): Promise<void> {
        throw new Error(`Not implemented`);
    }

    // ..., invokeAction, readAllProperties, readMultipleProperties, ...
    // w.r.t. interaction that need input and/or provide output we might want to know the input/output type as well
}
