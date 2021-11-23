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
    if (thingDescription === undefined) {
        return undefined;
    }
    // TODO shall we check wether we deal with a valid TD in the first place?
    const thing = JSON.parse(thingDescription);
    if (thing === undefined || typeof thing !== "object") {
        return undefined;
    }

    // https://w3c.github.io/wot-thing-description/#canonicalization-serialization-json
    //
    // The following sequence of transformations and constraints are to be applied

    // 1. In the Canonical TD, values that are of type dateTime MUST use the literal "Z" representing the UTC time zone instead of an offset.
    // 2. In the Canonical TD, values that are of type dateTime MUST serialize the fractional part of the seconds field as other numbers under the JSON Canonicalization Scheme, except that negative numbers and exponents are not permitted. Note in particular that trailing zeros and zero fractional seconds are not permitted under this serialization.
    // 3. In the Canonical TD, values that are of type dateTime MUST NOT use '24' in the hours field.
    if (thing.created !== undefined && typeof thing.created === "string") {
        thing.created = getCanonicalizedDateTime(thing.created);
    }
    if (thing.modified !== undefined && typeof thing.modified === "string") {
        thing.modified = getCanonicalizedDateTime(thing.modified);
    }

    // 4. In the Canonical TD, all required elements MUST be given explicitly, even if they have defaults and are assigned their default value. For example, the default value of writeOnly is false. If an input TD omits observable where it is allowed, it must still explicitly appear in the canonical form with the value of false. Note that this also applies to extension vocabularies, e.g. for protocol bindings. If any such extension defines default values they must be given explicitly in the canonical form.
    // -> https://w3c.github.io/wot-thing-description/#sec-default-values
    // TODO defaults for AdditionalExpectedResponse, AdditionalExpectedResponse
    applySecurityDefinitionsDefaults(thing.securityDefinitions);
    applyFormDefaults(thing.forms);
    if (thing.properties !== undefined && thing.properties instanceof Object) {
        for (const propName in thing.properties) {
            const prop: TD.ThingProperty = thing.properties[propName];
            applyDataSchemaDefaults(prop as TD.DataSchema);
            applyPropertyAffordanceDefaults(prop);
            if (prop.forms) {
                let defaultOps: string[];
                if (prop.readOnly === false && prop.writeOnly === false) {
                    defaultOps = ["readproperty", "writeproperty"];
                } else if (prop.readOnly === true) {
                    defaultOps = ["readproperty"];
                } else if (prop.writeOnly === false) {
                    defaultOps = ["writeproperty"];
                }
                prop.forms.forEach((item) => applyFormDefaults(item, defaultOps));
            }
        }
    }
    if (thing.actions !== undefined && thing.actions instanceof Object) {
        for (const actName in thing.actions) {
            const act: TD.ThingAction = thing.actions[actName];
            applyActionAffordanceDefaults(act);
            if (act.forms) {
                act.forms.forEach((item) => applyFormDefaults(item, ["invokeaction"]));
            }
            if (act.input && act.input instanceof Object) {
                applyDataSchemaDefaults(act.input);
            }
            if (act.output && act.output instanceof Object) {
                applyDataSchemaDefaults(act.output);
            }
        }
    }
    if (thing.events !== undefined && thing.events instanceof Object) {
        for (const evtName in thing.events) {
            const evt: TD.ThingEvent = thing.events[evtName];
            if (evt.forms) {
                evt.forms.forEach((item) => applyFormDefaults(item, ["subscribeevent", "unsubscribeevent"]));
            }
            if (evt.cancellation && evt.cancellation instanceof Object) {
                applyDataSchemaDefaults(evt.cancellation);
            }
            if (evt.data && evt.data instanceof Object) {
                applyDataSchemaDefaults(evt.data);
            }
            if (evt.subscription && evt.subscription instanceof Object) {
                applyDataSchemaDefaults(evt.subscription);
            }
        }
    }

    // 5. In the Canonical TD, if a prefix is defined it MUST be used in place of that URL.

    // 6. In the Canonical TD, all values that can be expressed as either an array or as a single value MUST be written as a single value if there is only one element. In other words, square brackets around arrays of single elements must be removed.

    // 7. In the Canonical TD, all provisions of the JSON Canonicalization Scheme [RFC8785] MUST be applied. The JSON Canonicalization Scheme [RFC8785], among other transformations, sorts object members by name, removes white space, and normalizes number representations.
    return stringifySorted(thing);
}

// inspired by https://levelup.gitconnected.com/creating-your-own-simplified-implementation-of-json-stringify-ed8e50b9144a
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stringifySorted(value: any) {
    let stringRepresentation = "";
    if (Array.isArray(value)) {
        // add first angle brackets
        stringRepresentation += "[";
        for (let i = 0; i < value.length; i++) {
            const entry = value[i];
            stringRepresentation += `${stringifySorted(entry)}`;
            // add comma?
            if (i < value.length - 1) {
                stringRepresentation += ",";
            }
        }
        // add last angle brackets
        stringRepresentation += "]";
    } else if (value === null) {
        stringRepresentation += "null";
    } else if (typeof value === "object") {
        let keys: string[] = Object.keys(value);
        keys = keys.sort(); // sort keys
        // add first curly brackets
        stringRepresentation += "{";
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const valueInner = value[key];
            stringRepresentation += `"${key}":${stringifySorted(valueInner)}`;
            // add comma?
            if (i < keys.length - 1) {
                stringRepresentation += ",";
            }
        }
        // add last curly brackets
        stringRepresentation += "}";
    } else if (typeof value === "string") {
        stringRepresentation += `"${value}"`;
    } else if (typeof value === "number") {
        stringRepresentation += `${value}`;
    } else if (typeof value === "boolean") {
        stringRepresentation += `${value}`;
    }
    return stringRepresentation;
}

function getCanonicalizedDateTime(dt: string): string {
    // TODO is there a library we could use?
    const date = new Date(Date.parse(dt));
    let iso = date.toISOString(); // 2018-11-13T20:20:39.000Z
    iso = iso.slice(0, -5);
    return iso + "Z";
}

// TODO Should be merged with td-parser code
function applySecurityDefinitionsDefaults(securityDefinitions: { [key: string]: TD.SecurityType }) {
    if (securityDefinitions) {
        for (const securityDefinition in securityDefinitions) {
            if (securityDefinitions[securityDefinition].scheme === "basic") {
                const basicSecurity = securityDefinitions[securityDefinition] as TD.BasicSecurityScheme;
                if (basicSecurity.in === undefined) {
                    basicSecurity.in = "header";
                }
            } else if (securityDefinitions[securityDefinition].scheme === "digest") {
                const digestSecurity = securityDefinitions[securityDefinition] as TD.DigestSecurityScheme;
                if (digestSecurity.in === undefined) {
                    digestSecurity.in = "header";
                }
                if (digestSecurity.qop === undefined) {
                    digestSecurity.qop = "auth";
                }
            } else if (securityDefinitions[securityDefinition].scheme === "bearer") {
                const bearerSecurity = securityDefinitions[securityDefinition] as TD.BearerSecurityScheme;
                if (bearerSecurity.alg === undefined) {
                    bearerSecurity.alg = "ES256";
                }
                if (bearerSecurity.format === undefined) {
                    bearerSecurity.format = "jwt";
                }
                if (bearerSecurity.in === undefined) {
                    bearerSecurity.in = "header";
                }
            } else if (securityDefinitions[securityDefinition].scheme === "apikey") {
                const apikeySecurity = securityDefinitions[securityDefinition] as TD.APIKeySecurityScheme;
                if (apikeySecurity.in === undefined) {
                    apikeySecurity.in = "query";
                }
            }
        }
    }
}

// TODO Should be merged with td-parser code
function applyFormDefaults(form: TD.Form, defaultOps?: string[]) {
    if (form) {
        if (form.contentType === undefined || typeof form.contentType !== "string") {
            form.contentType = "application/json";
        }
        if (form.op === undefined && defaultOps) {
            form.op = defaultOps;
        }
    }
}

// TODO Should be merged with td-parser code
function applyDataSchemaDefaults(dataSchema: TD.DataSchema) {
    if (dataSchema.readOnly === undefined || typeof dataSchema.readOnly !== "boolean") {
        dataSchema.readOnly = false;
    }
    if (dataSchema.writeOnly === undefined || typeof dataSchema.writeOnly !== "boolean") {
        dataSchema.writeOnly = false;
    }
}

function applyPropertyAffordanceDefaults(propertyAffordance: TD.ThingProperty) {
    if (propertyAffordance.observable === undefined || typeof propertyAffordance.observable !== "boolean") {
        propertyAffordance.observable = false;
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
