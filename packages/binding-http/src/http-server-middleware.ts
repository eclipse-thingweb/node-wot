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

/**
 * HTTP Middleware for the HTTP Server
 */

import { createLoggers } from "@node-wot/core";
import * as http from "http";

const { debug } = createLoggers("binding-http", "http-server-middleware");

export type MiddlewareRequestHandler = (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next: () => void
) => Promise<void>;

export default class HttpMiddleware {
    public handler: MiddlewareRequestHandler;

    constructor(handler: MiddlewareRequestHandler) {
        this.handler = handler;
    }

    public handleRequest(req: http.IncomingMessage, res: http.ServerResponse, next: () => void): Promise<void> {
        debug("Hit middleware");
        return this.handler(req, res, next);
    }
}
