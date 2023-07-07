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

import * as http from "http";

/**
 * A middleware function for the HTTP server, which can be used to intercept requests before they are handled by the WoT Servient.
 *
 * Example:
 * ```javascript
 * import { Servient } from "@node-wot/core";
 * import { HttpServer, MiddlewareRequestHandler } from "@node-wot/binding-http";
 *
 * const servient = new Servient();
 *
 * const middleware: MiddlewareRequestHandler = async (req, res, next) => {
 *     // For example, reject requests in which the X-Custom-Header header is missing
*      // by replying with 400 Bad Request
 *     if (!req.headers["x-custom-header"]) {
 *         res.statusCode = 400;
 *         res.end("Bad Request");
 *         return;
 *     }
 *     // Pass all other requests to the WoT Servient
 *     next();
 * };

 * const httpServer = new HttpServer({
 *     middleware,
 * });
 *
 * servient.addServer(httpServer);
 *
 * servient.start().then(async (WoT) => {
 *    // ...
 * });
 * ```
 * @param req The HTTP request.
 * @param res The HTTP response.
 * @param next Call this function to pass the request to the WoT Servient.
 */
export type MiddlewareRequestHandler = (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next: () => void
) => Promise<void>;
