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

import * as TD from "@node-wot/td-tools";
import { Readable } from "stream";
import { ReadableStream as PolyfillStream } from "web-streams-polyfill/ponyfill/es2018";

export interface IManagedStream {
    nodeStream: Readable;
    wotStream: ReadableStream;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
function ManagedStream<TBase extends new (...args: any[]) => {}>(Base: TBase) {
    return class extends Base implements IManagedStream {
        _nodeStream: Readable;
        _wotStream: ReadableStream;
        set nodeStream(nodeStream: Readable) {
            this._nodeStream = nodeStream;
        }

        get nodeStream(): Readable {
            return this._nodeStream;
        }

        set wotStream(wotStream: ReadableStream) {
            this._wotStream = wotStream;
        }

        get wotStream(): ReadableStream {
            return this._wotStream;
        }
    };
}

const ManagedReadable = ManagedStream(Readable);
const ManagedReadableStream = ManagedStream(PolyfillStream);

function isManaged(obj: unknown): obj is IManagedStream {
    return obj instanceof ManagedReadableStream || obj instanceof ManagedReadable;
}
export default class ProtocolHelpers {
    // set contentType (extend with more?)
    public static updatePropertyFormWithTemplate(
        form: TD.Form,
        tdTemplate: WoT.ExposedThingInit,
        propertyName: string
    ): void {
        if (
            form &&
            tdTemplate &&
            tdTemplate.properties &&
            tdTemplate.properties[propertyName] &&
            tdTemplate.properties[propertyName].forms
        ) {
            for (const formTemplate of tdTemplate.properties[propertyName].forms) {
                // 1. Try to find match with correct href scheme
                if (formTemplate.href) {
                    // TODO match for example http only?
                }

                // 2. Use any form
                if (formTemplate.contentType) {
                    form.contentType = formTemplate.contentType;
                    return; // abort loop
                }
            }
        }
    }

    public static updateActionFormWithTemplate(
        form: TD.Form,
        tdTemplate: WoT.ExposedThingInit,
        actionName: string
    ): void {
        if (
            form &&
            tdTemplate &&
            tdTemplate.actions &&
            tdTemplate.actions[actionName] &&
            tdTemplate.actions[actionName].forms
        ) {
            for (const formTemplate of tdTemplate.actions[actionName].forms) {
                // 1. Try to find match with correct href scheme
                if (formTemplate.href) {
                    // TODO match for example http only?
                }

                // 2. Use any form
                if (formTemplate.contentType) {
                    form.contentType = formTemplate.contentType;
                    return; // abort loop
                }
            }
        }
    }

    public static updateEventFormWithTemplate(
        form: TD.Form,
        tdTemplate: WoT.ExposedThingInit,
        eventName: string
    ): void {
        if (
            form &&
            tdTemplate &&
            tdTemplate.events &&
            tdTemplate.events[eventName] &&
            tdTemplate.events[eventName].forms
        ) {
            for (const formTemplate of tdTemplate.events[eventName].forms) {
                // 1. Try to find match with correct href scheme
                if (formTemplate.href) {
                    // TODO match for example http only?
                }

                // 2. Use any form
                if (formTemplate.contentType) {
                    form.contentType = formTemplate.contentType;
                    return; // abort loop
                }
            }
        }
    }

    public static getPropertyContentType(td: WoT.ThingDescription, propertyName: string, uriScheme: string): string {
        // try to find contentType (How to do this better)
        // Should interaction methods like readProperty() return an encapsulated value container with value&contenType
        // as sketched in https://github.com/w3c/wot-scripting-api/issues/201#issuecomment-573702999
        if (
            td &&
            propertyName &&
            uriScheme &&
            td.properties &&
            td.properties[propertyName] &&
            td.properties[propertyName].forms &&
            Array.isArray(td.properties[propertyName].forms)
        ) {
            for (const form of td.properties[propertyName].forms) {
                if (form.href && form.href.startsWith(uriScheme) && form.contentType) {
                    return form.contentType; // abort loop
                }
            }
        }

        return undefined; // not found
    }

    public static getActionContentType(td: WoT.ThingDescription, actionName: string, uriScheme: string): string {
        // try to find contentType
        if (
            td &&
            actionName &&
            uriScheme &&
            td.actions &&
            td.actions[actionName] &&
            td.actions[actionName].forms &&
            Array.isArray(td.actions[actionName].forms)
        ) {
            for (const form of td.actions[actionName].forms) {
                if (form.href && form.href.startsWith(uriScheme) && form.contentType) {
                    return form.contentType; // abort loop
                }
            }
        }

        return undefined; // not found
    }

    public static getEventContentType(td: WoT.ThingDescription, eventName: string, uriScheme: string): string {
        // try to find contentType
        if (
            td &&
            eventName &&
            uriScheme &&
            td.events &&
            td.events[eventName] &&
            td.events[eventName].forms &&
            Array.isArray(td.events[eventName].forms)
        ) {
            for (const form of td.events[eventName].forms) {
                if (form.href && form.href.startsWith(uriScheme) && form.contentType) {
                    return form.contentType; // abort loop
                }
            }
        }

        return undefined; // not found
    }

    public static toWoTStream(stream: NodeJS.ReadableStream | IManagedStream): ReadableStream | PolyfillStream {
        if (isManaged(stream)) {
            return stream.wotStream;
        }

        const result = new ManagedReadableStream({
            start: (controller) => {
                stream.on("data", (data) => controller.enqueue(data));
                stream.on("error", (e) => controller.error(e));
                stream.on("end", () => controller.close());
            },
            cancel: (reason) => {
                if (stream instanceof Readable) {
                    stream.destroy(reason);
                }
            },
        });

        if (stream instanceof Readable) {
            result.nodeStream = stream;
        } else {
            result.nodeStream = new Readable(stream);
        }

        return result;
    }

    public static toNodeStream(stream: ReadableStream | PolyfillStream | IManagedStream | Readable): Readable {
        if (isManaged(stream)) {
            return stream.nodeStream;
        }

        if (stream instanceof Readable) {
            return stream;
        }

        const reader = stream.getReader();
        const result = new ManagedReadable({
            read: (size) => {
                reader.read().then((data) => {
                    result.push(data.value);
                    if (data.done) {
                        // signal end
                        result.push(null);
                    }
                });
            },
            destroy: (error, callback) => {
                stream.cancel(error);
            },
        });
        result.wotStream = stream as ReadableStream;

        return result;
    }

    static readStreamFully(stream: NodeJS.ReadableStream): Promise<Buffer> {
        return new Promise<Buffer>((resolve, reject) => {
            if (stream) {
                const chunks: Array<unknown> = [];
                stream.on("data", (data) => chunks.push(data));
                stream.on("error", reject);
                stream.on("end", () => {
                    if (
                        chunks[0] &&
                        (chunks[0] instanceof Array || chunks[0] instanceof Buffer || chunks[0] instanceof Uint8Array)
                    ) {
                        resolve(Buffer.concat(chunks as Array<Buffer | Uint8Array>));
                    } else if (chunks[0] && typeof chunks[0] === "string") {
                        resolve(Buffer.from(chunks.join()));
                    } else {
                        resolve(Buffer.from(chunks as Array<number>));
                    }
                });
            } else {
                console.debug(
                    "[core/helpers]",
                    `Protocol-Helper returns empty buffer for readStreamFully due to undefined stream`
                );
                resolve(Buffer.alloc(0));
            }
        });
    }

    public static findRequestMatchingFormIndex(
        forms: TD.Form[] | undefined,
        uriScheme: string,
        requestUrl: string | undefined,
        contentType?: string
    ): number {
        if (forms === undefined) return 0;

        // first find forms with matching url protocol and path
        let matchingForms: TD.Form[] = forms.filter((form) => {
            // remove optional uriVariables from href Form
            const formUrl = new URL(form.href.replace(/(\{[\S]*\})/, ""));

            // remove uriVariables from request url, if any
            const reqUrl =
                requestUrl !== undefined
                    ? requestUrl.indexOf("?") !== -1
                        ? requestUrl.split("?")[0]
                        : requestUrl
                    : undefined;

            return formUrl.protocol === uriScheme + ":" && (reqUrl === undefined || formUrl.pathname === reqUrl);
        });
        // optionally try to match form's content type to the request's one
        if (contentType) {
            const contentTypeMatchingForms: TD.Form[] = matchingForms.filter((form) => {
                return form.contentType === contentType;
            });
            if (contentTypeMatchingForms.length > 0) matchingForms = contentTypeMatchingForms;
        }
        return matchingForms.length > 0 ? forms.indexOf(matchingForms[0]) : 0;
    }

    public static getFormIndexForOperation(
        interaction: TD.ThingInteraction,
        type: "property" | "action" | "event",
        operationName?: string,
        formIndex?: number
    ): number {
        let finalFormIndex = -1;

        // Check for default interaction OPs
        // https://w3c.github.io/wot-thing-description/#sec-default-values
        let defaultOps: string[] = [];
        switch (type) {
            case "property":
                if (
                    (interaction.readOnly && operationName === "writeproperty") ||
                    (interaction.writeOnly && operationName === "readproperty")
                )
                    return finalFormIndex;
                if (interaction.readOnly === undefined || !interaction.readOnly) defaultOps.push("writeproperty");
                if (interaction.writeOnly === undefined || !interaction.writeOnly) defaultOps.push("readproperty");
                break;
            case "action":
                defaultOps = ["invokeaction"];
                break;
            case "event":
                defaultOps = ["subscribeevent", "unsubscribeevent"];
                break;
        }

        if (defaultOps.indexOf(operationName) !== -1) {
            operationName = undefined;
        }

        // If a form index hint is gived, you it. Just check the form actually supports the op
        if (interaction.forms !== undefined && formIndex !== undefined && interaction.forms.length > formIndex) {
            const form = interaction.forms[formIndex];
            if (form && (operationName === undefined || form.op?.includes(operationName))) {
                finalFormIndex = formIndex;
            }
        }

        // If no form was found yet, loop through all forms
        if (interaction.forms !== undefined && finalFormIndex === -1) {
            if (operationName !== undefined) {
                interaction.forms.every((form: TD.Form) => {
                    if (form.op?.includes(operationName)) {
                        finalFormIndex = interaction.forms.indexOf(form);
                    }
                    return finalFormIndex === -1;
                });
            } else {
                interaction.forms.every((form: TD.Form) => {
                    finalFormIndex = interaction.forms.indexOf(form);
                    return false;
                });
            }
        }

        // No suitable form found for this operation
        return finalFormIndex;
    }
}
