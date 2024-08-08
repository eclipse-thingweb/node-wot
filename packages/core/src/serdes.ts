/********************************************************************************
 * Copyright (c) 2018 Contributors to the Eclipse Foundation
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

import { Thing } from "./thing-description";
import * as TD from "./thing-description";
import { createLoggers } from "./logger";

import isAbsoluteUrl = require("is-absolute-url");
import URLToolkit = require("url-toolkit");
import {
    ThingContext,
    PropertyElement,
    ActionElement,
    EventElement,
    ThingDescription,
} from "wot-thing-description-types";

const { debug, warn } = createLoggers("core", "serdes");

type AffordanceElement = PropertyElement | ActionElement | EventElement;

/**
 * Initializes the affordances field of a thing with an empty object if its
 * type should be incorrect or undefined.
 *
 * This avoids potential errors that could occur due to an undefined
 * affordance field.
 *
 * @param thing The Thing whose affordance field is being adjusted.
 * @param affordanceKey The key of the affordance field.
 */
function adjustAffordanceField(thing: Thing, affordanceKey: string) {
    const affordance = thing[affordanceKey];

    if (typeof affordance !== "object" || affordance == null) {
        thing[affordanceKey] = {};
    }
}

function adjustBooleanField(affordance: AffordanceElement, key: string) {
    const currentValue = affordance[key];

    if (currentValue === undefined || typeof currentValue !== "boolean") {
        affordance[key] = false;
    }
}

export function setContextLanguage(thing: ThingDescription, language: string, forceOverride: boolean): void {
    // forceOverride == false -> set @language if no @language set
    // forceOverride == true  -> set/override @language in any case
    if (Array.isArray(thing["@context"])) {
        const arrayContext = thing["@context"];
        let languageSet = false;
        for (const arrayEntry of arrayContext) {
            if (typeof arrayEntry === "object") {
                if ((arrayEntry as Record<string, unknown>)["@language"] !== undefined) {
                    if (forceOverride) {
                        (arrayEntry as Record<string, unknown>)["@language"] = language;
                    }
                    languageSet = true;
                }
            }
        }
        if (!languageSet) {
            (arrayContext as unknown[]).push({
                "@language": language,
            });
        }
    }
}

/** Parses a TD into a Thing object */
export function parseTD(td: string, normalize?: boolean): Thing {
    debug(`parseTD() parsing\n\`\`\`\n${td}\n\`\`\``);

    // remove a potential Byte Order Mark (BOM)
    // see https://github.com/eclipse-thingweb/node-wot/issues/109
    const thing: Thing = JSON.parse(td.replace(/^\uFEFF/, ""));

    // apply defaults as per WoT Thing Description spec

    if (thing["@context"] === undefined) {
        thing["@context"] = [TD.DEFAULT_CONTEXT_V1, TD.DEFAULT_CONTEXT_V11];
    } else if (Array.isArray(thing["@context"])) {
        let semContext = thing["@context"] as Array<string>;
        const indexV1 = semContext.indexOf(TD.DEFAULT_CONTEXT_V1);
        const indexV11 = semContext.indexOf(TD.DEFAULT_CONTEXT_V11);
        if (indexV1 === -1 && indexV11 === -1) {
            // insert default contexts as first entries
            semContext.unshift(TD.DEFAULT_CONTEXT_V11);
            semContext.unshift(TD.DEFAULT_CONTEXT_V1);
        } else {
            if (indexV1 !== -1 && indexV11 !== -1) {
                // both default contexts are present (V1 & V11)
                // -> remove both and add them to the top of the array
                semContext = semContext.filter(function (e) {
                    return e !== TD.DEFAULT_CONTEXT_V1;
                });
                semContext = semContext.filter(function (e) {
                    return e !== TD.DEFAULT_CONTEXT_V11;
                });
                semContext.unshift(TD.DEFAULT_CONTEXT_V11);
                semContext.unshift(TD.DEFAULT_CONTEXT_V1);
            } else {
                if (indexV1 !== -1 && indexV1 !== 0) {
                    // V1 present
                    semContext = semContext.filter(function (e) {
                        return e !== TD.DEFAULT_CONTEXT_V1;
                    });
                    semContext.unshift(TD.DEFAULT_CONTEXT_V1);
                }
                if (indexV11 !== -1 && indexV11 !== 0) {
                    // V11 present
                    semContext = semContext.filter(function (e) {
                        return e !== TD.DEFAULT_CONTEXT_V11;
                    });
                    semContext.unshift(TD.DEFAULT_CONTEXT_V11);
                }
            }
            thing["@context"] = semContext as ThingContext;
        }
    } else if (thing["@context"] !== TD.DEFAULT_CONTEXT_V1 && thing["@context"] !== TD.DEFAULT_CONTEXT_V11) {
        const semContext = thing["@context"];
        // insert default contexts as first entries
        thing["@context"] = [TD.DEFAULT_CONTEXT_V1, TD.DEFAULT_CONTEXT_V11, semContext];
    }
    // set @language to "en" if no @language available
    setContextLanguage(thing, TD.DEFAULT_CONTEXT_LANGUAGE, false);

    if (thing["@type"] === undefined) {
        thing["@type"] = TD.DEFAULT_THING_TYPE;
    } else if (Array.isArray(thing["@type"])) {
        const semTypes: Array<string> = thing["@type"];
        if (semTypes.indexOf(TD.DEFAULT_THING_TYPE) === -1) {
            // insert first
            semTypes.unshift(TD.DEFAULT_THING_TYPE);
        }
    } else if (thing["@type"] !== TD.DEFAULT_THING_TYPE) {
        const semType = thing["@type"];
        thing["@type"] = [TD.DEFAULT_THING_TYPE, semType];
    }

    for (const property of Object.values(thing.properties ?? {})) {
        for (const key of ["readOnly", "writeOnly", "observable"]) {
            adjustBooleanField(property, key);
        }
    }

    for (const action of Object.values(thing.actions ?? {})) {
        for (const key of ["safe", "idempotent"]) {
            adjustBooleanField(action, key);
        }
    }

    for (const affordanceKey of ["properties", "actions", "events"]) {
        adjustAffordanceField(thing, affordanceKey);
    }

    if (thing.security === undefined) {
        warn("parseTD() found no security metadata");
    }
    // wrap in array for later simplification
    if (typeof thing.security === "string") {
        thing.security = [thing.security];
    }

    // collect all forms for normalization and use iterations also for checking
    const allForms = [];
    // properties
    for (const [propName, prop] of Object.entries(thing.properties ?? {})) {
        // ensure forms mandatory forms field
        if (prop.forms == null) {
            throw new Error(`Property '${propName}' has no forms field`);
        }
        for (const form of prop.forms) {
            if (!form.href) {
                throw new Error(`Form of Property '${propName}' has no href field`);
            }
            // check if base field required
            if (!isAbsoluteUrl(form.href) && thing.base == null)
                throw new Error(`Form of Property '${propName}' has relative URI while TD has no base field`);
            // add
            allForms.push(form);
        }
    }
    // actions
    for (const [actName, act] of Object.entries(thing.actions ?? {})) {
        // ensure forms mandatory forms field
        if (act.forms == null) {
            throw new Error(`Action '${actName}' has no forms field`);
        }
        for (const form of act.forms) {
            if (!form.href) {
                throw new Error(`Form of Action '${actName}' has no href field`);
            }
            // check if base field required
            if (!isAbsoluteUrl(form.href) && thing.base == null)
                throw new Error(`Form of Action '${actName}' has relative URI while TD has no base field`);
            // add
            allForms.push(form);
        }
    }
    // events
    for (const [evtName, evt] of Object.entries(thing.events ?? {})) {
        // ensure forms mandatory forms field
        if (evt.forms == null) {
            throw new Error(`Event '${evtName}' has no forms field`);
        }
        for (const form of evt.forms) {
            if (!form.href) {
                throw new Error(`Form of Event '${evtName}' has no href field`);
            }
            // check if base field required
            if (!isAbsoluteUrl(form.href) && thing.base == null)
                throw new Error(`Form of Event '${evtName}' has relative URI while TD has no base field`);
            // add
            allForms.push(form);
        }
    }

    if (Object.prototype.hasOwnProperty.call(thing, "base")) {
        if (normalize === undefined || normalize === true) {
            debug("parseTD() normalizing 'base' into 'forms'");

            for (const form of allForms) {
                if (!form.href.match(/^([a-z0-9+-.]+:).+/i)) {
                    debug(`parseTDString() applying base '${thing.base}' to '${form.href}'`);
                    form.href = URLToolkit.buildAbsoluteURL(thing.base, form.href);
                }
            }
        }
    }

    return thing;
}

/** Serializes a Thing object into a TD */
export function serializeTD(thing: Thing): string {
    const copy: Thing = JSON.parse(JSON.stringify(thing));

    // clean-ups
    if (copy.security == null || copy.security.length === 0) {
        copy.securityDefinitions = {
            nosec_sc: { scheme: "nosec" },
        };
        copy.security = ["nosec_sc"];
    }

    if (copy.forms?.length === 0) {
        delete copy.forms;
    }

    if (copy.properties != null && Object.keys(copy.properties).length === 0) {
        delete copy.properties;
    } else if (copy.properties != null) {
        // add mandatory fields (if missing): observable, writeOnly, and readOnly
        for (const property of Object.values(copy.properties)) {
            for (const key of ["readOnly", "writeOnly", "observable"]) {
                adjustBooleanField(property, key);
            }
        }
    }

    if (copy.actions != null && Object.keys(copy.actions).length === 0) {
        delete copy.actions;
    } else if (copy.actions != null) {
        // add mandatory fields (if missing): idempotent and safe
        for (const action of Object.values(copy.actions)) {
            for (const key of ["safe", "idempotent"]) {
                adjustBooleanField(action, key);
            }
        }
    }
    if (copy.events != null && Object.keys(copy.events).length === 0) {
        delete copy.events;
    }

    if (copy?.links.length === 0) {
        delete copy.links;
    }

    const td: string = JSON.stringify(copy);

    return td;
}
