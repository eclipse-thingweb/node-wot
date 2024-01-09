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
import { ProtocolClient, Content, createLoggers, ContentSerdes } from "@node-wot/core";
import { Subscription } from "rxjs/Subscription";
import { promises as asyncFs } from "fs";
import { fileURLToPath } from "node:url";

const { debug } = createLoggers("binding-file", "file-client");

export default class FileClient implements ProtocolClient {
    public toString(): string {
        return "[FileClient]";
    }

    private async readFromFile(uri: string, contentType: string) {
        const filePath = fileURLToPath(uri);
        debug(`Reading file of Content-Type ${contentType} from path ${filePath}.`);

        const fileHandle = await asyncFs.open(filePath);
        const body = fileHandle.createReadStream();
        return new Content(contentType, body);
    }

    public async readResource(form: Form): Promise<Content> {
        const formContentType = form.contentType;
        if (formContentType == null) {
            debug(`Found no Content-Type for Form, defaulting to ${ContentSerdes.DEFAULT}`);
        }
        const contentType = formContentType ?? ContentSerdes.DEFAULT;

        return this.readFromFile(form.href, contentType);
    }

    public async writeResource(form: Form, content: Content): Promise<void> {
        const filePath = fileURLToPath(form.href);

        await asyncFs.writeFile(filePath, content.body);
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
        return this.readFromFile(uri, "application/td+json");
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
