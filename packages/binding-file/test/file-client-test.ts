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

import { Content, ContentSerdes } from "@node-wot/core";

import FileClient from "../src/file-client";
import { Form } from "@node-wot/td-tools";
import { expect } from "chai";
import { promises as asyncFs } from "fs";
import { fileURLToPath } from "node:url";

const jsonValue = {
    foo: "bar",
};

function formatContentType(contentType?: string) {
    if (contentType == null) {
        return "no Content-Type";
    }

    return `Content-Type ${contentType}`;
}

describe("File Client Implementation", () => {
    let fileClient: FileClient;

    beforeEach(async () => {
        fileClient = new FileClient();
        await fileClient.start();
    });

    afterEach(async () => {
        await fileClient.stop();
    });

    for (const uriScheme of ["file:///", "file://"]) {
        for (const [index, testData] of [
            {
                value: jsonValue,
                contentType: "application/json",
                fileExtension: "json",
            },
            { value: jsonValue, contentType: undefined, fileExtension: "json" },
            { value: "Lorem ipsum dolor sit amet.", contentType: "text/plain", fileExtension: "txt" },
        ].entries()) {
            it(`should be able to write and read files using URI scheme ${uriScheme} with ${formatContentType(
                testData.contentType
            )}`, async () => {
                const contentType = testData.contentType;
                const originalValue = testData.value;
                const fileName = `test${index}.${testData.fileExtension}`;

                // eslint-disable-next-line n/no-path-concat
                const href = `${uriScheme}${__dirname}/${fileName}`;
                const filePath = fileURLToPath(href);

                const form: Form = {
                    href,
                    contentType,
                };

                const writeContent = ContentSerdes.get().valueToContent(
                    originalValue,
                    undefined,
                    contentType ?? ContentSerdes.DEFAULT
                );

                await fileClient.writeResource(form, writeContent);

                const rawContent: Content = await fileClient.readResource(form);

                const readContent = {
                    body: await rawContent.toBuffer(),
                    type: writeContent.type,
                };

                const readValue = ContentSerdes.get().contentToValue(readContent, {});
                expect(readValue).to.deep.eq(originalValue);

                await asyncFs.unlink(filePath);
            });
        }
    }
});
