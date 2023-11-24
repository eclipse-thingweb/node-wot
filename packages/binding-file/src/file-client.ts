/********************************************************************************
 * Copyright (c) 2018 Contributors to the Eclipse Foundation
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
 * File protocol binding
 */
import { Form, SecurityScheme } from "@node-wot/td-tools";
import { ProtocolClient, Content, createLoggers } from "@node-wot/core";
import { Subscription } from "rxjs/Subscription";
import fs = require("fs");
import path = require("path");

const { debug, warn } = createLoggers("binding-file", "file-client");

export default class FileClient implements ProtocolClient {
    public toString(): string {
        return "[FileClient]";
    }

    public async readResource(form: Form): Promise<Content> {
        const filepath = form.href.split("//");
        const resource = fs.createReadStream(filepath[1]);
        const extension = path.extname(filepath[1]);
        debug(`FileClient found '${extension}' extension`);
        let contentType;
        if (form.contentType != null) {
            contentType = form.contentType;
        } else {
            // *guess* contentType based on file extension
            contentType = "application/octet-stream";
            switch (extension) {
                case ".txt":
                case ".log":
                case ".ini":
                case ".cfg":
                    contentType = "text/plain";
                    break;
                case ".json":
                    contentType = "application/json";
                    break;
                case ".jsonld":
                    contentType = "application/ld+json";
                    break;
                default:
                    warn(`FileClient cannot determine media type of '${form.href}'`);
            }
        }
        return new Content(contentType, resource);
    }

    public async writeResource(form: Form, content: Content): Promise<void> {
        throw new Error("FileClient does not implement write");
    }

    public async invokeResource(form: Form, content: Content): Promise<Content> {
        throw new Error("FileClient does not implement invoke");
    }

    public async unlinkResource(form: Form): Promise<void> {
        throw new Error("FileClient does not implement unlink");
    }

    public async subscribeResource(
        form: Form,
        next: (value: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ): Promise<Subscription> {
        throw new Error("FileClient does not implement subscribe");
    }

    public async start(): Promise<void> {
        // do nothing
    }

    public async stop(): Promise<void> {
        // do nothing
    }

    public setSecurity = (metadata: Array<SecurityScheme>): boolean => false;
}
