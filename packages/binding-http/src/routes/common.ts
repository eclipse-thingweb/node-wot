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
import { ContentSerdes, ExposedThing, Helpers, createLoggers } from "@node-wot/core";
import { IncomingMessage, ServerResponse } from "http";

const { debug, warn } = createLoggers("binding-http", "routes", "common");

export function respondUnallowedMethod(
    req: IncomingMessage,
    res: ServerResponse,
    allowed: string,
    corsPreflightWithCredentials = false
): void {
    // Always allow OPTIONS to handle CORS pre-flight requests
    if (!allowed.includes("OPTIONS")) {
        allowed += ", OPTIONS";
    }
    if (req.method === "OPTIONS" && req.headers.origin && req.headers["access-control-request-method"]) {
        debug(
            `HttpServer received an CORS preflight request from ${Helpers.toUriLiteral(req.socket.remoteAddress)}:${
                req.socket.remotePort
            }`
        );
        if (corsPreflightWithCredentials) {
            res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
            res.setHeader("Access-Control-Allow-Credentials", "true");
        } else {
            res.setHeader("Access-Control-Allow-Origin", "*");
        }
        res.setHeader("Access-Control-Allow-Methods", allowed);
        res.setHeader("Access-Control-Allow-Headers", "content-type, authorization, *");
        res.writeHead(200);
        res.end();
    } else {
        res.setHeader("Allow", allowed);
        res.writeHead(405);
        res.end("Method Not Allowed");
    }
}

export function validOrDefaultRequestContentType(
    req: IncomingMessage,
    res: ServerResponse,
    contentType: string
): string {
    if (req.method === "PUT" || req.method === "POST") {
        if (!contentType) {
            // FIXME should be rejected with 400 Bad Request, as guessing is not good in M2M -> debug/testing flag to allow
            // FIXME would need to check if payload is present
            warn(
                `HttpServer received no Content-Type from ${Helpers.toUriLiteral(req.socket.remoteAddress)}:${
                    req.socket.remotePort
                }`
            );
            return ContentSerdes.DEFAULT;
        } else if (ContentSerdes.get().getSupportedMediaTypes().indexOf(ContentSerdes.getMediaType(contentType)) < 0) {
            throw new Error("Unsupported Media Type");
        }
        return contentType;
    }
    return contentType;
}

export function isEmpty(obj: Record<string, unknown>): boolean {
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) return false;
    }
    return true;
}

export function securitySchemeToHttpHeader(scheme: string): string {
    const [first, ...rest] = scheme;
    // HTTP Authentication Scheme for OAuth does not contain the version number
    // see https://www.iana.org/assignments/http-authschemes/http-authschemes.xhtml
    if (scheme === "oauth2") return "OAuth";
    return first.toUpperCase() + rest.join("").toLowerCase();
}

export function setCorsForThing(req: IncomingMessage, res: ServerResponse, thing: ExposedThing): void {
    const securityScheme = thing.securityDefinitions[Helpers.toStringArray(thing.security)[0]].scheme;
    // Set CORS headers
    if (securityScheme !== "nosec" && req.headers.origin) {
        res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
        res.setHeader("Access-Control-Allow-Origin", "*");
    }
}
