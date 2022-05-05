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

import Thing from "./thing-description";
import * as TD from "./thing-description";

import isAbsoluteUrl = require("is-absolute-url");
import URLToolkit = require("url-toolkit");
import { ThingContext } from "wot-thing-description-types";

/** Parses a TD into a Thing object */

function addDefaultLanguage(thing: Thing) {
    // add @language : "en" if no @language set
    if (Array.isArray(thing["@context"])) {
        const arrayContext: Array<string | Record<string, unknown>> = thing["@context"];
        let languageSet = false;
        for (const arrayEntry of arrayContext) {
            if (typeof arrayEntry === "object") {
                if (arrayEntry["@language"] !== undefined) {
                    languageSet = true;
                }
            }
        }
        if (!languageSet) {
            arrayContext.push({
                "@language": TD.DEFAULT_CONTEXT_LANGUAGE,
            });
        }
    }
}
export function parseTD(td: string, normalize?: boolean): Thing {
    console.debug("[td-tools/td-parser]", `parseTD() parsing\n\`\`\`\n${td}\n\`\`\``);

    // remove a potential Byte Order Mark (BOM)
    // see https://github.com/eclipse/thingweb.node-wot/issues/109
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
    // add @language : "en" if no @language set
    addDefaultLanguage(thing);

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

    if (thing.properties !== undefined && thing.properties instanceof Object) {
        for (const propName in thing.properties) {
            const prop: TD.ThingProperty = thing.properties[propName];
            if (prop.readOnly === undefined || typeof prop.readOnly !== "boolean") {
                prop.readOnly = false;
            }
            if (prop.writeOnly === undefined || typeof prop.writeOnly !== "boolean") {
                prop.writeOnly = false;
            }
            if (prop.observable === undefined || typeof prop.observable !== "boolean") {
                prop.observable = false;
            }
        }
    }

    if (thing.actions !== undefined && thing.actions instanceof Object) {
        for (const actName in thing.actions) {
            const act: TD.ThingAction = thing.actions[actName];
            if (act.safe === undefined || typeof act.safe !== "boolean") {
                act.safe = false;
            }
            if (act.idempotent === undefined || typeof act.idempotent !== "boolean") {
                act.idempotent = false;
            }
        }
    }

    // avoid errors due to 'undefined'
    if (typeof thing.properties !== "object" || thing.properties === null) {
        thing.properties = {};
    }
    if (typeof thing.actions !== "object" || thing.actions === null) {
        thing.actions = {};
    }
    if (typeof thing.events !== "object" || thing.events === null) {
        thing.events = {};
    }

    if (thing.security === undefined) {
        console.warn("[td-tools/td-parser]", `parseTD() found no security metadata`);
    }
    // wrap in array for later simplification
    if (typeof thing.security === "string") {
        thing.security = [thing.security];
    }

    // collect all forms for normalization and use iterations also for checking
    const allForms = [];
    // properties
    for (const propName in thing.properties) {
        const prop: TD.ThingProperty = thing.properties[propName];
        // ensure forms mandatory forms field
        if (!prop.forms) {
            throw new Error(`Property '${propName}' has no forms field`);
        }
        for (const form of prop.forms) {
            if (!form.href) {
                throw new Error(`Form of Property '${propName}' has no href field`);
            }
            // check if base field required
            if (!isAbsoluteUrl(form.href) && !thing.base)
                throw new Error(`Form of Property '${propName}' has relative URI while TD has no base field`);
            // add
            allForms.push(form);
        }
    }
    // actions
    for (const actName in thing.actions) {
        const act: TD.ThingProperty = thing.actions[actName];
        // ensure forms mandatory forms field
        if (!act.forms) {
            throw new Error(`Action '${actName}' has no forms field`);
        }
        for (const form of act.forms) {
            if (!form.href) {
                throw new Error(`Form of Action '${actName}' has no href field`);
            }
            // check if base field required
            if (!isAbsoluteUrl(form.href) && !thing.base)
                throw new Error(`Form of Action '${actName}' has relative URI while TD has no base field`);
            // add
            allForms.push(form);
        }
    }
    // events
    for (const evtName in thing.events) {
        const evt: TD.ThingProperty = thing.events[evtName];
        // ensure forms mandatory forms field
        if (!evt.forms) {
            throw new Error(`Event '${evtName}' has no forms field`);
        }
        for (const form of evt.forms) {
            if (!form.href) {
                throw new Error(`Form of Event '${evtName}' has no href field`);
            }
            // check if base field required
            if (!isAbsoluteUrl(form.href) && !thing.base)
                throw new Error(`Form of Event '${evtName}' has relative URI while TD has no base field`);
            // add
            allForms.push(form);
        }
    }

    if (Object.prototype.hasOwnProperty.call(thing, "base")) {
        if (normalize === undefined || normalize === true) {
            console.debug("[td-tools/td-parser]", `parseTD() normalizing 'base' into 'forms'`);

            for (const form of allForms) {
                if (!form.href.match(/^([a-z0-9+-.]+:).+/i)) {
                    console.debug(
                        "[td-tools/td-parser]",
                        `parseTDString() applying base '${thing.base}' to '${form.href}'`
                    );
                    form.href = URLToolkit.buildAbsoluteURL(thing.base, form.href);
                }
            }
        }
    }

    return thing;
}

/** Serializes a Thing object into a TD */
export function serializeTD(thing: Thing): string {
    const copy = JSON.parse(JSON.stringify(thing));

    // clean-ups
    if (!copy.security || copy.security.length === 0) {
        copy.securityDefinitions = {
            nosec_sc: { scheme: "nosec" },
        };
        copy.security = ["nosec_sc"];
    }

    if (copy.forms && copy.forms.length === 0) {
        delete copy.forms;
    }

    if (copy.properties && Object.keys(copy.properties).length === 0) {
        delete copy.properties;
    } else if (copy.properties) {
        // add mandatory fields (if missing): observable, writeOnly, and readOnly
        for (const propName in copy.properties) {
            const prop = copy.properties[propName];
            if (prop.readOnly === undefined || typeof prop.readOnly !== "boolean") {
                prop.readOnly = false;
            }
            if (prop.writeOnly === undefined || typeof prop.writeOnly !== "boolean") {
                prop.writeOnly = false;
            }
            if (prop.observable === undefined || typeof prop.observable !== "boolean") {
                prop.observable = false;
            }
        }
    }

    if (copy.actions && Object.keys(copy.actions).length === 0) {
        delete copy.actions;
    } else if (copy.actions) {
        // add mandatory fields (if missing): idempotent and safe
        for (const actName in copy.actions) {
            const act = copy.actions[actName];
            if (act.idempotent === undefined || typeof act.idempotent !== "boolean") {
                act.idempotent = false;
            }
            if (act.safe === undefined || typeof act.safe !== "boolean") {
                act.safe = false;
            }
        }
    }
    if (copy.events && Object.keys(copy.events).length === 0) {
        delete copy.events;
    }

    if (copy.links && copy.links.length === 0) {
        delete copy.links;
    }

    const td: string = JSON.stringify(copy);

    return td;
}
