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
    securitySchemeToHTTPHeader,
    setCORSForThing,
    validOrDefaultRequestContentType,
} from "./common";
import HttpServer from "../http-server";

const { error, warn } = createLoggers("binding-http", "routes", "action");

export default async function actionRoute(
    this: HttpServer,
    req: IncomingMessage,
    res: ServerResponse,
    _params: { thing: string; action: string }
): Promise<void> {
    const thing = this.getThings().get(_params.thing);

    if (!thing) {
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

    const action = thing.actions[_params.action];

    if (!action) {
        res.writeHead(404);
        res.end();
        return;
    }
    // TODO: refactor this part to move into a common place
    setCORSForThing(req, res, thing);
    let corsPreflightWithCredentials = false;
    const securityScheme = thing.securityDefinitions[Helpers.toStringArray(thing.security)[0]].scheme;

    if (securityScheme !== "nosec" && !(await this.checkCredentials(thing, req))) {
        if (req.method === "OPTIONS" && req.headers.origin) {
            corsPreflightWithCredentials = true;
        } else {
            res.setHeader("WWW-Authenticate", `${securitySchemeToHTTPHeader(securityScheme)} realm="${thing.id}"`);
            res.writeHead(401);
            res.end();
            return;
        }
    }

    if (req.method === "POST") {
        const options: WoT.InteractionOptions & { formIndex: number } = {
            formIndex: ProtocolHelpers.findRequestMatchingFormIndex(action.forms, this.scheme, req.url, contentType),
        };
        const uriVariables = Helpers.parseUrlParameters(req.url, thing.uriVariables, action.uriVariables);
        if (!isEmpty(uriVariables)) {
            options.uriVariables = uriVariables;
        }
        try {
            const output = await thing.handleInvokeAction(_params.action, new Content(contentType, req), options);
            if (output) {
                res.setHeader("Content-Type", output.type);
                res.writeHead(200);
                output.body.pipe(res);
            } else {
                res.writeHead(204);
                res.end();
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : JSON.stringify(err);

            error(`HttpServer on port ${this.getPort()} got internal error on invoke '${req.url}': ${message}`);
            res.writeHead(500);
            res.end(message);
        }
    } else {
        // may have been OPTIONS that failed the credentials check
        // as a result, we pass corsPreflightWithCredentials
        respondUnallowedMethod(req, res, "POST", corsPreflightWithCredentials);
    }
}
