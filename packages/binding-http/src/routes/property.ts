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
import {
    isEmpty,
    respondUnallowedMethod,
    securitySchemeToHttpHeader,
    setCorsForThing,
    validOrDefaultRequestContentType,
} from "./common";
import HttpServer from "../http-server";

const { error, warn } = createLoggers("binding-http", "routes", "property");
export default async function propertyRoute(
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
    let contentType: string = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;
    try {
        contentType = validOrDefaultRequestContentType(req, res, contentType);
    } catch (error) {
        warn(
            `HttpServer received unsupported Content-Type from ${Helpers.toUriLiteral(req.socket.remoteAddress)}:${
                req.socket.remotePort
            }`
        );
        res.writeHead(415);
        res.end("Unsupported Media Type");
        return;
    }

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
    setCorsForThing(req, res, thing);
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

    if (req.method === "GET") {
        try {
            const content = await thing.handleReadProperty(_params.property, options);
            res.setHeader("Content-Type", content.type);
            res.writeHead(200);
            content.body.pipe(res);
        } catch (err) {
            const message = err instanceof Error ? err.message : JSON.stringify(err);

            error(`HttpServer on port ${this.getPort()} got internal error on read '${req.url}': ${message}`);
            res.writeHead(500);
            res.end(message);
        }
    } else if (req.method === "PUT") {
        const readOnly: boolean = property.readOnly ?? false;
        if (readOnly) {
            respondUnallowedMethod(req, res, "GET, PUT");
            return;
        }

        try {
            await thing.handleWriteProperty(_params.property, new Content(contentType, req), options);

            res.writeHead(204);
            res.end("Changed");
        } catch (err) {
            const message = err instanceof Error ? err.message : JSON.stringify(err);

            error(`HttpServer on port ${this.getPort()} got internal error on invoke '${req.url}': ${message}`);
            res.writeHead(500);
            res.end(message);
        }
        // resource found and response sent
    } else {
        // may have been OPTIONS that failed the credentials check
        // as a result, we pass corsPreflightWithCredentials
        respondUnallowedMethod(req, res, "GET, PUT", corsPreflightWithCredentials);
    } // Property exists?
}
