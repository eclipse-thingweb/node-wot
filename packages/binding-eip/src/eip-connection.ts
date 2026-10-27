/********************************************************************************
 * Copyright (c) 2026 Contributors to the Eclipse Foundation
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
import { EipValueLayout, byteLength, decodeValue, elementSize, encodeValue } from "./eip-codec";
import { EipPrimitiveType, EipService } from "./eip-form";
import {
    EipError,
    STRUCTURE_TYPE_CODE,
    TagData,
    assertCipSuccess,
    encodeReadTag,
    encodeReadTagFragmented,
    encodeTagPath,
    encodeWriteTag,
    encodeWriteTagFragmented,
    parseTagData,
    tagTypeHeader,
    typeCodeOf,
} from "./eip-protocol";
import { EipSession } from "./eip-session";

export interface EipOperationOptions {
    service?: EipService;
    timeout: number;
    /** Raw byte offset into the tag value, from the `?offset=` query of the href. */
    byteOffset?: number;
}

const PARTIAL_TRANSFER = 0x06;
const DEFAULT_WRITE_CHUNK_SIZE = 400;

function hex(value: number): string {
    return `0x${value.toString(16)}`;
}

/** Elements to request so that `byteLength(layout)` bytes are available after skipping `byteOffset` bytes. */
function transferElements(layout: EipValueLayout, byteOffset: number): number {
    return Math.ceil((byteOffset + byteLength(layout)) / elementSize(layout));
}

/** Reads and writes tags of one controller through an {@link EipSession}. */
export class EipConnection {
    constructor(
        private readonly session: EipSession,
        private readonly writeChunkSize = DEFAULT_WRITE_CHUNK_SIZE
    ) {}

    async read(tagPath: string, layout: EipValueLayout, options: EipOperationOptions): Promise<unknown> {
        const raw = await this.readRaw(tagPath, layout, options);
        this.checkType(tagPath, layout, raw.typeCode);
        return decodeValue(layout, raw.value);
    }

    async write(tagPath: string, layout: EipValueLayout, value: unknown, options: EipOperationOptions): Promise<void> {
        const path = encodeTagPath(tagPath);
        const byteOffset = options.byteOffset ?? 0;
        const elements = transferElements(layout, byteOffset);
        const context = `Writing tag '${tagPath}'`;

        let data: Buffer;
        let typeHeader: Buffer;
        if (layout.structure !== undefined || layout.type === "eipv:STRING") {
            // The structure handle and the bytes outside the fields come from the controller.
            const current = await this.readRaw(tagPath, layout, { timeout: options.timeout, byteOffset });
            this.checkType(tagPath, layout, current.typeCode);
            if (current.structureHandle === undefined) {
                throw new EipError(`${context} failed: the controller reported no structure handle`);
            }
            data = encodeValue(layout, value, current.value.subarray(0, byteLength(layout)));
            typeHeader = tagTypeHeader(undefined, current.structureHandle);
        } else {
            data = encodeValue(layout, value);
            typeHeader = tagTypeHeader(layout.type);
        }

        const fragmented =
            options.service === "WriteTagFragmented" || byteOffset > 0 || data.length > this.writeChunkSize;
        if (!fragmented) {
            const reply = await this.session.request(encodeWriteTag(path, typeHeader, elements, data), options.timeout);
            assertCipSuccess(reply, false, context);
            return;
        }
        for (let sent = 0; sent < data.length; sent += this.writeChunkSize) {
            const part = data.subarray(sent, sent + this.writeChunkSize);
            const request = encodeWriteTagFragmented(path, typeHeader, elements, byteOffset + sent, part);
            assertCipSuccess(await this.session.request(request, options.timeout), false, context);
        }
    }

    private async readRaw(tagPath: string, layout: EipValueLayout, options: EipOperationOptions): Promise<TagData> {
        const path = encodeTagPath(tagPath);
        const byteOffset = options.byteOffset ?? 0;
        const elements = transferElements(layout, byteOffset);
        const context = `Reading tag '${tagPath}'`;

        if (options.service !== "ReadTagFragmented" && byteOffset === 0) {
            const reply = await this.session.request(encodeReadTag(path, elements), options.timeout);
            if (reply.status !== PARTIAL_TRANSFER) {
                assertCipSuccess(reply, false, context);
                return parseTagData(reply.data);
            }
        }

        let header: TagData | undefined;
        const chunks: Buffer[] = [];
        let received = byteOffset;
        for (;;) {
            const request = encodeReadTagFragmented(path, elements, received);
            const reply = await this.session.request(request, options.timeout);
            assertCipSuccess(reply, true, context);
            const part = parseTagData(reply.data);
            header ??= part;
            if (reply.status === PARTIAL_TRANSFER && part.value.length === 0) {
                throw new EipError(`${context} failed: the controller returned an empty fragment`);
            }
            chunks.push(part.value);
            received += part.value.length;
            if (reply.status !== PARTIAL_TRANSFER) {
                return {
                    typeCode: header.typeCode,
                    structureHandle: header.structureHandle,
                    value: Buffer.concat(chunks),
                };
            }
        }
    }

    private checkType(tagPath: string, layout: EipValueLayout, typeCode: number): void {
        const expected =
            layout.structure !== undefined ? STRUCTURE_TYPE_CODE : typeCodeOf(layout.type as EipPrimitiveType);
        if (typeCode !== expected) {
            const declared = layout.structure?.["eipv:typeName"] ?? layout.type;
            throw new EipError(
                `Tag '${tagPath}' has CIP type ${hex(typeCode)} but the form declares ${declared} (${hex(expected)})`
            );
        }
    }
}
