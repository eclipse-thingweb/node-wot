/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
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

import { Content } from "./protocol-interfaces";
import JsonCodec from "./codecs/json-codec";
import TextCodec from "./codecs/text-codec";
import Base64Codec from "./codecs/base64-codec";
import OctetstreamCodec from "./codecs/octetstream-codec";
import { DataSchema, DataSchemaValue } from "wot-typescript-definitions";
import { Readable } from "stream";
import { ProtocolHelpers } from "./core";
import { ReadableStream } from "web-streams-polyfill/ponyfill/es2018";

/** is a plugin for ContentSerdes for a specific format (such as JSON or EXI) */
export interface ContentCodec {
    getMediaType(): string;
    bytesToValue(bytes: Buffer, schema: DataSchema, parameters?: { [key: string]: string }): DataSchemaValue;
    valueToBytes(value: unknown, schema: DataSchema, parameters?: { [key: string]: string }): Buffer;
}

interface ReadContent {
    type: string;
    body: Buffer;
}
/**
 * is a singleton that is used to serialize and deserialize data
 * it can accept multiple serializers and decoders
 */
export class ContentSerdes {
    private static instance: ContentSerdes;

    public static readonly DEFAULT: string = "application/json";
    public static readonly TD: string = "application/td+json";
    public static readonly JSON_LD: string = "application/ld+json";

    private codecs: Map<string, ContentCodec> = new Map();
    private offered: Set<string> = new Set<string>();

    public static get(): ContentSerdes {
        if (!this.instance) {
            this.instance = new ContentSerdes();
            // JSON
            this.instance.addCodec(new JsonCodec(), true);
            this.instance.addCodec(new JsonCodec("application/senml+json"));
            // Text
            this.instance.addCodec(new TextCodec());
            this.instance.addCodec(new TextCodec("text/html"));
            this.instance.addCodec(new TextCodec("text/css"));
            this.instance.addCodec(new TextCodec("application/xml"));
            this.instance.addCodec(new TextCodec("application/xhtml+xml"));
            this.instance.addCodec(new TextCodec("image/svg+xml"));
            // Base64
            this.instance.addCodec(new Base64Codec("image/png"));
            this.instance.addCodec(new Base64Codec("image/gif"));
            this.instance.addCodec(new Base64Codec("image/jpeg"));
            // OctetStream
            this.instance.addCodec(new OctetstreamCodec());
        }
        return this.instance;
    }

    public static getMediaType(contentType: string): string {
        const parts = contentType.split(";");
        return parts[0].trim();
    }

    public static getMediaTypeParameters(contentType: string): { [key: string]: string } {
        const parts = contentType.split(";").slice(1);

        // parse parameters into object
        const params: { [key: string]: string } = {};
        parts.forEach((p) => {
            const eq = p.indexOf("=");

            if (eq >= 0) {
                params[p.substr(0, eq).trim()] = p.substr(eq + 1).trim();
            } else {
                // handle parameters without value
                params[p.trim()] = null;
            }
        });

        return params;
    }

    public addCodec(codec: ContentCodec, offered = false): void {
        ContentSerdes.get().codecs.set(codec.getMediaType(), codec);
        if (offered) ContentSerdes.get().offered.add(codec.getMediaType());
    }

    public getSupportedMediaTypes(): Array<string> {
        return Array.from(ContentSerdes.get().codecs.keys());
    }

    public getOfferedMediaTypes(): Array<string> {
        return Array.from(ContentSerdes.get().offered);
    }

    public isSupported(contentType: string): boolean {
        const mt = ContentSerdes.getMediaType(contentType);
        return this.codecs.has(mt);
    }

    public contentToValue(content: ReadContent, schema: DataSchema): DataSchemaValue {
        if (content.type === undefined) {
            if (content.body.byteLength > 0) {
                // default to application/json
                content.type = ContentSerdes.DEFAULT;
            } else {
                // empty payload without media type -> void/undefined (note: e.g., empty payload with text/plain -> "")
                return undefined;
            }
        }

        // split into media type and parameters
        const mt = ContentSerdes.getMediaType(content.type);
        const par = ContentSerdes.getMediaTypeParameters(content.type);

        // choose codec based on mediaType
        if (this.codecs.has(mt)) {
            console.debug("[core/content-serdes]", `ContentSerdes deserializing from ${content.type}`);

            const codec = this.codecs.get(mt);

            // use codec to deserialize
            const res = codec.bytesToValue(content.body, schema, par);

            return res;
        } else {
            console.warn("[core/content-serdes]", `ContentSerdes passthrough due to unsupported media type '${mt}'`);
            return content.body.toString();
        }
    }

    public valueToContent(
        value: DataSchemaValue | ReadableStream,
        schema: DataSchema,
        contentType = ContentSerdes.DEFAULT
    ): Content {
        if (value === undefined) console.warn("[core/content-serdes]", "ContentSerdes valueToContent got no value");

        if (value instanceof ReadableStream) {
            return { type: contentType, body: ProtocolHelpers.toNodeStream(value) };
        }

        let bytes = null;

        // split into media type and parameters
        const mt = ContentSerdes.getMediaType(contentType);
        const par = ContentSerdes.getMediaTypeParameters(contentType);

        // choose codec based on mediaType
        if (this.codecs.has(mt)) {
            console.debug("[core/content-serdes]", `ContentSerdes serializing to ${contentType}`);
            const codec = this.codecs.get(mt);
            bytes = codec.valueToBytes(value, schema, par);
        } else {
            console.warn(
                "[core/content-serdes]",
                `ContentSerdes passthrough due to unsupported serialization format '${contentType}'`
            );
            bytes = Buffer.from(value.toString());
        }
        // http server does not like Readable.from(bytes)
        // it works only with Arrays or strings
        return { type: contentType, body: Readable.from([bytes]) };
    }
}

// export singleton instance
export default ContentSerdes.get();
