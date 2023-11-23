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
 * File protocol binding
 */
import { Form, SecurityScheme } from "@node-wot/td-tools";
import { ProtocolClient, Content, createLoggers } from "@node-wot/core";
import { Subscription } from "rxjs/Subscription";
import fs = require("fs");
import path = require("path");

const { debug, warn } = createLoggers("binding-file", "file-client");

/**
 * Used to determine the Content-Type of a file from the extension in its
 * {@link filePath} if no explicit Content-Type is defined.
 *
 * @param filepath The file path the Content-Type is determined for.
 * @returns An appropriate Content-Type or `application/octet-stream` as a fallback.
 */
function mapFileExtensionToContentType(filepath: string) {
    const fileExtension = path.extname(filepath);
    debug(`FileClient found '${fileExtension}' extension`);
    switch (fileExtension) {
        case ".txt":
        case ".log":
        case ".ini":
        case ".cfg":
            return "text/plain";
        case ".json":
            return "application/json";
        case ".jsontd":
            return "application/td+json";
        case ".jsonld":
            return "application/ld+json";
        default:
            warn(`FileClient cannot determine media type for path '${filepath}'`);
            return "application/octet-stream";
    }
}

export default class FileClient implements ProtocolClient {
    public toString(): string {
        return "[FileClient]";
    }

    private async readFile(filepath: string, contentType?: string): Promise<Content> {
        const resource = fs.createReadStream(filepath);
        const resourceContentType = contentType ?? mapFileExtensionToContentType(filepath);
        return new Content(resourceContentType, resource);
    }

    public async readResource(form: Form): Promise<Content> {
        const filepath = form.href.split("//")[1];
        return this.readFile(filepath, form.contentType);
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

    /**
     * @inheritdoc
     */
    public async requestThingDescription(uri: string): Promise<Content> {
        return this.readFile(uri, "application/td+json");
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
