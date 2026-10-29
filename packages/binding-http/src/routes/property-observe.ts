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

const { debug, warn } = createLoggers("binding-http", "routes", "property", "observe");
export default async function propertyObserveRoute(
    this: HttpServer,
    req: IncomingMessage,
    res: ServerResponse,
    _params: { [k: string]: string | undefined }
): Promise<void> {
    if (_params.thing === undefined || _params.property === undefined) {
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

    const contentTypeHeader = req.headers["content-type"];
    const contentType: string = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;
    const property = thing.properties[_params.property];

    if (property == null) {
        res.writeHead(404);
        res.end();
        return;
    }

    const options: WoT.InteractionOptions & { formIndex: number } = {
        formIndex: ProtocolHelpers.findRequestMatchingFormIndex(property.forms, this.scheme, req.url, contentType),
    };
    const uriVariables = Helpers.parseUrlParameters(req.url, thing.uriVariables, property.uriVariables);
    if (!isEmpty(uriVariables)) {
        options.uriVariables = uriVariables;
    }

    // TODO: refactor this part to move into a common place
    setCorsForThing(req, res, thing, this.getAllowedOrigins());
    let corsPreflightWithCredentials = false;
    const securityScheme = thing.securityDefinitions[Helpers.toStringArray(thing.security)[0]].scheme;

    if (securityScheme !== "nosec" && !(await this.checkCredentials(thing, req))) {
        if (req.method === "OPTIONS" && req.headers.origin != null) {
            corsPreflightWithCredentials = true;
        } else {
            res.setHeader("WWW-Authenticate", `${securitySchemeToHttpHeader(securityScheme)} realm="${thing.id}"`);
            res.writeHead(401);
            res.end();
            return;
        }
    }
    const propertyName = _params.property;
    if (req.method === "GET") {
        const listener = async (value: Content) => {
            try {
                if (!res.headersSent) {
                    // We are polite and use the same request as long as the client
                    // does not close the connection (or we hit the timeout; see below).
                    // Therefore we are sending the headers
                    // only if we didn't have sent them before.
                    res.setHeader("Content-Type", value.type);
                    res.writeHead(200);
                }
                // send property data
                value.body.pipe(res);
            } catch (err) {
                // Safe cast to NodeJS.ErrnoException we are checking if it is equal to ERR_HTTP_HEADERS_SENT
                if ((err as NodeJS.ErrnoException)?.code === "ERR_HTTP_HEADERS_SENT") {
                    thing.handleUnobserveProperty(propertyName, listener, options);
                    return;
                }
                const message = err instanceof Error ? err.message : JSON.stringify(err);
                warn(
                    `HttpServer on port ${this.getPort()} cannot process data for Property '${
                        _params.property
                    }: ${message}'`
                );
                res.writeHead(500);
                res.end("Invalid Property Data");
            }
        };
        await thing.handleObserveProperty(_params.property, listener, options);
        res.on("finish", () => {
            debug(`HttpServer on port ${this.getPort()} closed connection`);
            thing.handleUnobserveProperty(propertyName, listener, options);
        });
        res.setTimeout(60 * 60 * 1000, () => thing.handleUnobserveProperty(propertyName, listener, options));
    } else if (req.method === "HEAD") {
        // HEAD support for long polling subscription
        // TODO: set the Content-Type header to the type of the property
        res.writeHead(202);
        res.end();
    } else {
        respondUnallowedMethod(req, res, "GET", corsPreflightWithCredentials, this.getAllowedOrigins());
    }
}
