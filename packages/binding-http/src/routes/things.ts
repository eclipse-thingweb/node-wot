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
import { ContentSerdes, Helpers } from "@node-wot/core";
import { IncomingMessage, ServerResponse } from "http";
import HttpServer from "../http-server";

export default function thingsRoute(
    this: HttpServer,
    req: IncomingMessage,
    res: ServerResponse,
    _params: unknown
): void {
    res.setHeader("Content-Type", ContentSerdes.DEFAULT);
    res.writeHead(200);
    const list = [];
    for (const address of Helpers.getAddresses()) {
        for (const name in this.getThings()) {
            // FIXME the undefined check should NOT be necessary (however there seems to be null in it)
            if (name) {
                list.push(
                    this.scheme +
                        "://" +
                        Helpers.toUriLiteral(address) +
                        ":" +
                        this.getPort() +
                        "/" +
                        encodeURIComponent(name)
                );
            }
        }
    }
    res.end(JSON.stringify(list));
}
