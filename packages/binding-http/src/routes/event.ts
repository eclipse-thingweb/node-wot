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
import { IncomingMessage, ServerResponse } from "http";
import { Content, Helpers, ProtocolHelpers, createLoggers } from "@node-wot/core";
import { isEmpty, respondUnallowedMethod, securitySchemeToHttpHeader, setCorsForThing } from "./common";
import HttpServer from "../http-server";

const { warn, debug } = createLoggers("binding-http", "routes", "event");
export default async function eventRoute(
    this: HttpServer,
    req: IncomingMessage,
    res: ServerResponse,
    _params: { [k: string]: string | undefined }
): Promise<void> {
    if (_params.thing === undefined || _params.event === undefined) {
        res.writeHead(400);
        res.end();
        return;
    }
    const thing = this.getThings().get(_params.thing);

    if (!thing) {
        res.writeHead(404);
        res.end();
        return;
    }

    const contentTypeHeader = req.headers["content-type"];
    const contentType: string = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;

    const event = thing.events[_params.event];
    if (!event) {
        res.writeHead(404);
        res.end();
        return;
    }
    // TODO: refactor this part to move into a common place
    setCorsForThing(req, res, thing);
    let corsPreflightWithCredentials = false;
    const securityScheme = thing.securityDefinitions[Helpers.toStringArray(thing.security)[0]].scheme;

    if (securityScheme !== "nosec" && !(await this.checkCredentials(thing, req))) {
        if (req.method === "OPTIONS" && req.headers.origin) {
            corsPreflightWithCredentials = true;
        } else {
            res.setHeader("WWW-Authenticate", `${securitySchemeToHttpHeader(securityScheme)} realm="${thing.id}"`);
            res.writeHead(401);
            res.end();
            return;
        }
    }

    if (req.method === "GET") {
        const options: WoT.InteractionOptions & { formIndex: number } = {
            formIndex: ProtocolHelpers.findRequestMatchingFormIndex(event.forms, this.scheme, req.url, contentType),
        };
        const uriVariables = Helpers.parseUrlParameters(req.url, thing.uriVariables, event.uriVariables);
        if (!isEmpty(uriVariables)) {
            options.uriVariables = uriVariables;
        }
        const eventName = _params.event;
        const listener = async (value: Content) => {
            try {
                // send event data
                if (!res.headersSent) {
                    // We are polite and use the same request as long as the client
                    // does not close the connection (or we hit the timeout; see below).
                    // Therefore we are sending the headers
                    // only if we didn't have sent them before.
                    res.setHeader("Content-Type", value.type);
                    res.writeHead(200);
                }
                value.body.pipe(res);
            } catch (err) {
                // Safe cast to NodeJS.ErrnoException we are checking if it is equal to ERR_HTTP_HEADERS_SENT
                if ((err as NodeJS.ErrnoException)?.code === "ERR_HTTP_HEADERS_SENT") {
                    thing.handleUnsubscribeEvent(eventName, listener, options);
                    return;
                }
                const message = err instanceof Error ? err.message : JSON.stringify(err);
                warn(`HttpServer on port ${this.getPort()} cannot process data for Event '${eventName}: ${message}'`);
                res.writeHead(500);
                res.end("Invalid Event Data");
            }
        };

        await thing.handleSubscribeEvent(eventName, listener, options);
        res.on("close", () => {
            debug(`HttpServer on port ${this.getPort()} closed Event connection`);
            thing.handleUnsubscribeEvent(eventName, listener, options);
        });
        res.setTimeout(60 * 60 * 1000, () => thing.handleUnsubscribeEvent(eventName, listener, options));
    } else if (req.method === "HEAD") {
        // HEAD support for long polling subscription
        res.writeHead(202);
        res.end();
    } else {
        // may have been OPTIONS that failed the credentials check
        // as a result, we pass corsPreflightWithCredentials
        respondUnallowedMethod(req, res, "GET", corsPreflightWithCredentials);
    }
    // resource found and response sent
}
