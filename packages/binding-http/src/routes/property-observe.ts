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
import { isEmpty, respondUnallowedMethod } from "./common";
import HttpServer from "../http-server";

const { debug, warn } = createLoggers("binding-http", "routes", "property", "observe");
export default async function propertyObserveRoute(
    this: HttpServer,
    req: IncomingMessage,
    res: ServerResponse,
    _params: { thing: string; property: string }
): Promise<void> {
    const thing = this.getThings().get(_params.thing);

    if (!thing) {
        res.writeHead(404);
        res.end();
        return;
    }

    const contentTypeHeader: string | string[] = req.headers["content-type"];
    const contentType: string = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;
    const property = thing.properties[_params.property];

    if (!property) {
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
    let corsPreflightWithCredentials = false;
    if (this.getHttpSecurityScheme() !== "NoSec" && !(await this.checkCredentials(thing, req))) {
        if (req.method === "OPTIONS" && req.headers.origin) {
            corsPreflightWithCredentials = true;
        } else {
            res.setHeader("WWW-Authenticate", `${this.getHttpSecurityScheme()} realm="${thing.id}"`);
            res.writeHead(401);
            res.end();
            return;
        }
    }

    if (req.method === "GET") {
        const listener = async (value: Content) => {
            try {
                // send property data
                value.body.pipe(res);
            } catch (err) {
                if (err?.code === "ERR_HTTP_HEADERS_SENT") {
                    thing.handleUnobserveProperty(_params.property, listener, options);
                    return;
                }
                warn(
                    `HttpServer on port ${this.getPort()} cannot process data for Property '${_params.property}: ${
                        err.message
                    }'`
                );
                res.writeHead(500);
                res.end("Invalid Property Data");
            }
        };
        await thing.handleObserveProperty(_params.property, listener, options);
        res.on("finish", () => {
            debug(`HttpServer on port ${this.getPort()} closed connection`);
            thing.handleUnobserveProperty(_params.property, listener, options);
        });
        res.setTimeout(60 * 60 * 1000, () => thing.handleUnobserveProperty(_params.property, listener, options));
    } else if (req.method === "HEAD") {
        // HEAD support for long polling subscription
        res.writeHead(202);
        res.end();
    } else {
        respondUnallowedMethod(req, res, "GET", corsPreflightWithCredentials);
    }
}
