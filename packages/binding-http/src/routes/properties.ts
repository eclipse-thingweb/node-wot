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
import { ContentSerdes, PropertyContentMap, createLoggers } from "@node-wot/core";
import { respondUnallowedMethod } from "./common";
import HttpServer from "../http-server";

const { error } = createLoggers("binding-http", "routes", "properties");
export default async function propertiesRoute(
    this: HttpServer,
    req: IncomingMessage,
    res: ServerResponse,
    _params: { [k: string]: string | undefined }
): Promise<void> {
    if (_params.thing === undefined) {
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

    // all properties
    if (req.method === "GET") {
        try {
            const propMap: PropertyContentMap = await thing.handleReadAllProperties({
                formIndex: 0,
            });
            res.setHeader("Content-Type", ContentSerdes.DEFAULT); // contentType handling?
            res.writeHead(200);
            const recordResponse: Record<string, unknown> = {};
            for (const key of propMap.keys()) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- map key is always present as checked above
                const content = propMap.get(key)!;
                const value = ContentSerdes.get().contentToValue(
                    { type: ContentSerdes.DEFAULT, body: await content.toBuffer() },
                    {}
                );
                recordResponse[key] = value;
            }
            res.end(JSON.stringify(recordResponse));
        } catch (err) {
            const message = err instanceof Error ? err.message : JSON.stringify(err);

            error(`HttpServer on port ${this.getPort()} got internal error on invoke '${req.url}': ${message}`);
            res.writeHead(500);
            res.end(message);
        }
    } else if (req.method === "HEAD") {
        res.writeHead(202);
        res.end();
    } else {
        // may have been OPTIONS that failed the credentials check
        // as a result, we pass corsPreflightWithCredentials
        respondUnallowedMethod(req, res, "GET", corsPreflightWithCredentials);
    }
}
