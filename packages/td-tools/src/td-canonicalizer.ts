/********************************************************************************
 * Copyright (c) 2021 Contributors to the Eclipse Foundation
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

// import Thing from "./thing-description";
import * as TD from "./thing-description";

/** Canonicalizes a TD into a string */
export function canonicalizeTD(thingDescription: string): string {
    const thing = JSON.parse(thingDescription); // : Thing = JSON.parse(thingDescription);
    // https://w3c.github.io/wot-thing-description/#canonicalization-serialization-json
    //
    // The following sequence of transformations and constraints are to be applied
    //
    // 1. In the Canonical TD, values that are of type dateTime MUST use the literal "Z" representing the UTC time zone instead of an offset.

    // 2. In the Canonical TD, values that are of type dateTime MUST serialize the fractional part of the seconds field as other numbers under the JSON Canonicalization Scheme, except that negative numbers and exponents are not permitted. Note in particular that trailing zeros and zero fractional seconds are not permitted under this serialization.

    // 3. In the Canonical TD, values that are of type dateTime MUST NOT use '24' in the hours field.

    // 4. In the Canonical TD, all required elements MUST be given explicitly, even if they have defaults and are assigned their default value. For example, the default value of writeOnly is false. If an input TD omits observable where it is allowed, it must still explicitly appear in the canonical form with the value of false. Note that this also applies to extension vocabularies, e.g. for protocol bindings. If any such extension defines default values they must be given explicitly in the canonical form.
    // -> https://w3c.github.io/wot-thing-description/#sec-default-values
    if (thing.properties !== undefined && thing.properties instanceof Object) {
        for (const propName in thing.properties) {
            const prop: TD.ThingProperty = thing.properties[propName];
            applyDataSchemaDefaults(prop as TD.DataSchema);
        }
    }
    if (thing.actions !== undefined && thing.actions instanceof Object) {
        for (const actName in thing.actions) {
            const act: TD.ThingAction = thing.actions[actName];
            applyActionAffordanceDefaults(act);
        }
    }
    // TODO DataSchema in Action(input/output), Event (subscription, data, cancellation)  ...

    // 5. In the Canonical TD, if a prefix is defined it MUST be used in place of that URL.

    // 6. In the Canonical TD, all values that can be expressed as either an array or as a single value MUST be written as a single value if there is only one element. In other words, square brackets around arrays of single elements must be removed.

    // 7. In the Canonical TD, all provisions of the JSON Canonicalization Scheme [RFC8785] MUST be applied. The JSON Canonicalization Scheme [RFC8785], among other transformations, sorts object members by name, removes white space, and normalizes number representations.
    // Sorting? eg., via https://www.npmjs.com/package/json-stable-stringify OR JSON.stringify(obj, Object.keys(obj).sort())
    // https://stackoverflow.com/questions/16167581/sort-object-properties-and-json-stringify

    // Note: see https://w3c.github.io/wot-thing-description/#sec-default-values

    // sort
    return stringifySorted(thing);
}

// inspired by https://levelup.gitconnected.com/creating-your-own-simplified-implementation-of-json-stringify-ed8e50b9144a
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stringifySorted(value: any) {
    let objString = "";
    if (Array.isArray(value)) {
        // add first angle brace
        objString += "[";
        for (let i = 0; i < value.length; i++) {
            const entry = value[i];
            objString += `${stringifySorted(entry)}`;
            // add comma?
            if (i < value.length - 1) {
                objString += ",";
            }
        }
        // add last angle brace
        objString += "]";
    } else if (value === null) {
        objString += "null";
    } else if (typeof value === "object") {
        let keys: string[] = Object.keys(value);
        keys = keys.sort(); // sort keys
        // add first curly brace
        objString += "{";
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const valueInner = value[key];
            objString += `"${key}":${stringifySorted(valueInner)}`;
            // add comma?
            if (i < keys.length - 1) {
                objString += ",";
            }
        }
        // add last curly brace
        objString += "}";
    } else if (typeof value === "string") {
        objString += `"${value}"`;
    } else if (typeof value === "number") {
        objString += `${value}`;
    } else if (typeof value === "boolean") {
        objString += `${value}`;
    }
    return objString;
}

// TODO Should be merged with td-parser code
function applyDataSchemaDefaults(dataSchema: TD.DataSchema) {
    // const prop: TD.ThingProperty = thing.properties[propName];
    if (dataSchema.readOnly === undefined || typeof dataSchema.readOnly !== "boolean") {
        dataSchema.readOnly = false;
    }
    if (dataSchema.writeOnly === undefined || typeof dataSchema.writeOnly !== "boolean") {
        dataSchema.writeOnly = false;
    }
    // TODO does this really come fomr DataSchema? Shouldn't it be PropertyAffordance?
    if (dataSchema.observable === undefined || typeof dataSchema.observable !== "boolean") {
        dataSchema.observable = false;
    }
}

// TODO Should be merged with td-parser code
function applyActionAffordanceDefaults(actionAffordance: TD.ThingAction) {
    if (actionAffordance.safe === undefined || typeof actionAffordance.safe !== "boolean") {
        actionAffordance.safe = false;
    }
    if (actionAffordance.idempotent === undefined || typeof actionAffordance.idempotent !== "boolean") {
        actionAffordance.idempotent = false;
    }
}
