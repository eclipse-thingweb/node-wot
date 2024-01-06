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

import { ContentSerdes, createLoggers } from "@node-wot/core";
import { IncomingMessage, ServerResponse } from "http";
import { ExposedThing, ThingDescription } from "wot-typescript-definitions";
import * as acceptLanguageParser from "accept-language-parser";
import * as TD from "@node-wot/td-tools";
import HttpServer from "../http-server";

const { debug } = createLoggers("binding-http", "routes", "thing-description");

function resetMultiLangInteraction(
    interactions: ThingDescription["properties"] | ThingDescription["actions"] | ThingDescription["events"],
    prefLang: string
) {
    if (interactions != null) {
        for (const interaction of Object.values(interactions)) {
            // unset any current title and/or description
            delete interaction.title;
            delete interaction.description;

            // use new language title
            for (const [titleLang, titleValue] of Object.entries(interaction.titles ?? {})) {
                if (titleLang.startsWith(prefLang)) {
                    interaction.title = titleValue;
                    break;
                }
            }

            // use new language description
            for (const [descLang, descriptionValue] of Object.entries(interaction.descriptions ?? {})) {
                if (descLang.startsWith(prefLang)) {
                    interaction.description = descriptionValue;
                    break;
                }
            }

            // unset any multilanguage titles and/or descriptions
            delete interaction.titles;
            delete interaction.descriptions;
        }
    }
}

function resetMultiLangThing(thing: ThingDescription, prefLang: string) {
    // TODO can we reset "title" to another name given that title is used in URI creation?

    // set @language in @context
    TD.setContextLanguage(thing, prefLang, true);

    // use new language title
    if (thing.titles) {
        for (const titleLang in thing.titles) {
            if (titleLang.startsWith(prefLang)) {
                thing.title = thing.titles[titleLang];
            }
        }
    }

    // use new language description
    if (thing.descriptions) {
        for (const titleLang in thing.descriptions) {
            if (titleLang.startsWith(prefLang)) {
                thing.description = thing.descriptions[titleLang];
            }
        }
    }

    // remove any titles or descriptions and update title / description accordingly
    delete thing.titles;
    delete thing.descriptions;

    // reset multi-language terms for interactions
    resetMultiLangInteraction(thing.properties, prefLang);
    resetMultiLangInteraction(thing.actions, prefLang);
    resetMultiLangInteraction(thing.events, prefLang);
}

/**
 * Look for language negotiation through the Accept-Language header field of HTTP (e.g., "de", "de-CH", "en-US,en;q=0.5")
 * Note: "title" on thing level is mandatory term --> check whether "titles" exists for multi-languages
 * Note: HTTP header names are case-insensitive and req.headers seems to contain them in lowercase
 *
 *
 * @param td
 * @param thing
 * @param req
 */
function negotiateLanguage(td: ThingDescription, thing: ExposedThing, req: IncomingMessage) {
    const acceptLanguage = req.headers["accept-language"];
    const noPreference = acceptLanguage == null || acceptLanguage === "*";

    if (noPreference) {
        return;
    }

    if (td.titles != null) {
        const supportedLanguages = Object.keys(td.titles); // e.g., ['fr', 'en']
        // the loose option allows partial matching on supported languages (e.g., returns "de" for "de-CH")
        const prefLang = acceptLanguageParser.pick(supportedLanguages, acceptLanguage, {
            loose: true,
        });
        if (prefLang != null) {
            // if a preferred language can be found use it
            debug(`TD language negotiation through the Accept-Language header field of HTTP leads to "${prefLang}"`);
            // TODO: reset titles and descriptions to only contain the preferred language
            resetMultiLangThing(td, prefLang);
        }
    }
}

export default async function thingDescriptionRoute(
    this: HttpServer,
    req: IncomingMessage,
    res: ServerResponse,
    _params: { [k: string]: string | undefined }
): Promise<void> {
    if (_params.thing === undefined) {
        res.writeHead(400);
        res.end();
        return;
    }

    const thing = this.getThings().get(_params.thing);
    if (thing == null) {
        res.writeHead(404);
        res.end();
        return;
    }

    const td = thing.getThingDescription();
    const contentSerdes = ContentSerdes.get();

    // TODO: Parameters need to be considered here as well
    const acceptValues = req.headers.accept?.split(",").map((acceptValue) => acceptValue.split(";")[0]) ?? [
        ContentSerdes.TD,
    ];
    // TODO: Better handling of wildcard values
    const filteredAcceptValues = acceptValues
        .map((acceptValue) => {
            if (acceptValue === "*/*") {
                return ContentSerdes.TD;
            }
            return acceptValue;
        })
        .filter((acceptValue) => contentSerdes.isSupported(acceptValue))
        .sort((a, b) => {
            // weight function last places weight more than first: application/td+json > application/json > text/html
            const aWeight = ["text/html", "application/json", "application/td+json"].findIndex((value) => value === a);
            const bWeight = ["text/html", "application/json", "application/td+json"].findIndex((value) => value === b);
            return bWeight - aWeight;
        });

    if (filteredAcceptValues.length > 0) {
        const contentType = filteredAcceptValues[0];
        const content = contentSerdes.valueToContent(td, undefined, contentType);
        const payload = await content.toBuffer();

        negotiateLanguage(td, thing, req);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Content-Type", contentType);
        res.writeHead(200);
        debug(`Sending HTTP response for TD with Content-Type ${contentType}.`);
        res.end(payload);
        return;
    }

    debug(`Request contained an accept header with the values ${acceptValues}, none of which are supported.`);
    res.writeHead(406);
    res.end(`Accept header contained no Content-Types supported by this resource. (Was ${acceptValues})`);
}
