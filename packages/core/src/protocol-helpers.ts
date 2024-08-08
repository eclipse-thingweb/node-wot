/********************************************************************************
 * Copyright (c) 2020 Contributors to the Eclipse Foundation
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

import { Form, ThingInteraction } from "./thing-description";
import { Readable } from "stream";
import { ReadableStream as PolyfillStream } from "web-streams-polyfill/ponyfill/es2018";
import { ActionElement, EventElement, PropertyElement } from "wot-thing-description-types";
import { createLoggers } from "./logger";

const { debug, warn } = createLoggers("core", "protocol-helpers");

export interface IManagedStream {
    nodeStream: Readable;
    wotStream: ReadableStream;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
function ManagedStream<TBase extends new (...args: any[]) => {}>(Base: TBase) {
    return class extends Base implements IManagedStream {
        _nodeStream?: Readable;
        _wotStream?: ReadableStream;
        set nodeStream(nodeStream: Readable) {
            this._nodeStream = nodeStream;
        }

        get nodeStream(): Readable {
            if (!this._nodeStream) {
                throw new Error("ManagedStream not correctly initialized nodeStream is undefined");
            }
            return this._nodeStream;
        }

        set wotStream(wotStream: ReadableStream) {
            this._wotStream = wotStream;
        }

        get wotStream(): ReadableStream {
            if (!this._wotStream) {
                throw new Error("ManagedStream not correctly initialized wotStream is undefined");
            }
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
    public static updatePropertyFormWithTemplate(form: Form, property: PropertyElement): void {
        for (const formTemplate of property.forms ?? []) {
            // 1. Try to find match with correct href scheme
            if (formTemplate.href) {
                // TODO match for example http only?
            }
            // 2. Use any form
            if (formTemplate.contentType != null) {
                form.contentType = formTemplate.contentType;
                return; // abort loop
            }
        }
    }

    public static updateActionFormWithTemplate(form: Form, action: ActionElement): void {
        for (const formTemplate of action.forms ?? []) {
            // 1. Try to find match with correct href scheme
            if (formTemplate.href) {
                // TODO match for example http only?
            }
            // 2. Use any form
            if (formTemplate.contentType != null) {
                form.contentType = formTemplate.contentType;
                return; // abort loop
            }
        }
    }

    public static updateEventFormWithTemplate(form: Form, event: EventElement): void {
        for (const formTemplate of event.forms ?? []) {
            // 1. Try to find match with correct href scheme
            if (formTemplate.href) {
                // TODO match for example http only?
            }
            // 2. Use any form
            if (formTemplate.contentType != null) {
                form.contentType = formTemplate.contentType;
                return; // abort loop
            }
        }
    }

    public static getPropertyContentType(
        td: WoT.ThingDescription,
        propertyName: string,
        uriScheme: string
    ): string | undefined {
        // try to find contentType (How to do this better)
        // Should interaction methods like readProperty() return an encapsulated value container with value&contentType
        // as sketched in https://github.com/w3c/wot-scripting-api/issues/201#issuecomment-573702999
        if (
            propertyName != null &&
            uriScheme != null &&
            td?.properties != null &&
            td.properties[propertyName] != null &&
            td.properties[propertyName].forms != null &&
            Array.isArray(td.properties[propertyName].forms)
        ) {
            for (const form of td.properties[propertyName].forms) {
                if (form.href?.startsWith(uriScheme) && form.contentType != null) {
                    return form.contentType; // abort loop
                }
            }
        }

        return undefined; // not found
    }

    public static getActionContentType(
        td: WoT.ThingDescription,
        actionName: string,
        uriScheme: string
    ): string | undefined {
        // try to find contentType
        if (
            actionName != null &&
            uriScheme != null &&
            td?.actions &&
            td.actions != null &&
            Array.isArray(td.actions[actionName]?.forms)
        ) {
            for (const form of td.actions[actionName].forms) {
                if (form.href && form.href.startsWith(uriScheme) && form.contentType != null) {
                    return form.contentType; // abort loop
                }
            }
        }

        return undefined; // not found
    }

    public static getEventContentType(
        td: WoT.ThingDescription,
        eventName: string,
        uriScheme: string
    ): string | undefined {
        // try to find contentType
        if (
            eventName != null &&
            uriScheme != null &&
            td?.events &&
            td?.events[eventName]?.forms != null &&
            Array.isArray(td.events[eventName].forms)
        ) {
            for (const form of td.events[eventName].forms) {
                if (form.href && form.href.startsWith(uriScheme) && form.contentType != null) {
                    return form.contentType; // abort loop
                }
            }
        }

        return undefined; // not found
    }

    public static toWoTStream(stream: NodeJS.ReadableStream): ReadableStream | PolyfillStream {
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
                reader.releaseLock();
                stream.cancel(error).then(() => callback(error));
            },
        });
        result.wotStream = stream as ReadableStream;
        result.nodeStream = result;
        return result;
    }

    static readStreamFully(stream: NodeJS.ReadableStream): Promise<Buffer> {
        return new Promise<Buffer>((resolve, reject) => {
            if (stream != null) {
                const chunks: Array<unknown> = [];
                stream.on("data", (data) => chunks.push(data));
                stream.on("error", reject);
                stream.on("end", () => {
                    if (
                        chunks[0] != null &&
                        (chunks[0] instanceof Array || chunks[0] instanceof Buffer || chunks[0] instanceof Uint8Array)
                    ) {
                        resolve(Buffer.concat(chunks as Array<Buffer | Uint8Array>));
                    } else if (chunks[0] != null && typeof chunks[0] === "string") {
                        resolve(Buffer.from(chunks.join()));
                    } else {
                        resolve(Buffer.from(chunks as Array<number>));
                    }
                });
            } else {
                debug(`Protocol-Helper returns empty buffer for readStreamFully due to undefined stream`);
                resolve(Buffer.alloc(0));
            }
        });
    }

    public static findRequestMatchingFormIndex(
        forms: Form[] | undefined,
        uriScheme: string,
        requestUrl: string | undefined,
        contentType?: string
    ): number {
        if (forms === undefined) return 0;

        // first find forms with matching url protocol and path
        let matchingForms: Form[] = forms.filter((form) => {
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
        if (contentType != null) {
            const contentTypeMatchingForms: Form[] = matchingForms.filter((form) => {
                return form.contentType === contentType;
            });
            if (contentTypeMatchingForms.length > 0) matchingForms = contentTypeMatchingForms;
        }
        return matchingForms.length > 0 ? forms.indexOf(matchingForms[0]) : 0;
    }

    public static getFormIndexForOperation(
        interaction: ThingInteraction,
        type: "property" | "action" | "event",
        operationName?:
            | "writeproperty"
            | "readproperty"
            | "invokeaction"
            | "subscribeevent"
            | "unsubscribeevent"
            | "unobserveproperty"
            | "observeproperty"
            | "readallproperties"
            | "readmultipleproperties",
        formIndex?: number
    ): number {
        let finalFormIndex = -1;

        // Check for default interaction OPs
        // https://w3c.github.io/wot-thing-description/#sec-default-values
        let defaultOps: (
            | "writeproperty"
            | "readproperty"
            | "invokeaction"
            | "subscribeevent"
            | "unsubscribeevent"
            | "unobserveproperty"
            | "observeproperty"
            | "readallproperties"
            | "readmultipleproperties"
            | undefined
        )[] = [];
        switch (type) {
            case "property":
                if (
                    (interaction.readOnly === true && operationName === "writeproperty") ||
                    (interaction.writeOnly === true && operationName === "readproperty")
                )
                    return finalFormIndex;
                if (interaction.readOnly !== true) defaultOps.push("writeproperty");
                if (interaction.writeOnly !== true) defaultOps.push("readproperty");
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
            if (form != null && (operationName == null || form.op?.includes(operationName) === true)) {
                finalFormIndex = formIndex;
            }
        }

        // If no form was found yet, loop through all forms
        if (interaction.forms !== undefined && finalFormIndex === -1) {
            if (operationName !== undefined) {
                interaction.forms.every((form: Form) => {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- operationName !== undefined
                    if (form.op?.includes(operationName!) === true) {
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- interaction.forms  !== undefined
                        finalFormIndex = interaction.forms!.indexOf(form);
                    }
                    return finalFormIndex === -1;
                });
            } else {
                interaction.forms.every((form: Form) => {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- interaction.forms  !== undefined
                    finalFormIndex = interaction.forms!.indexOf(form);
                    return false;
                });
            }
        }

        // No suitable form found for this operation
        return finalFormIndex;
    }

    public static getPropertyOpValues(property: PropertyElement): string[] {
        const op: string[] = [];

        if (property.readOnly !== true) {
            op.push("writeproperty");
        }

        if (property.writeOnly !== true) {
            op.push("readproperty");
        }

        if (op.length === 0) {
            warn("Property was declared both as readOnly and writeOnly.");
        }

        if (property.observable === true) {
            op.push("observeproperty");
            op.push("unobserveproperty");
        }

        return op;
    }
}
