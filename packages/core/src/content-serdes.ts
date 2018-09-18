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

/** is a plugin for ContentSerdes for a specific format (such as JSON or EXI) */
export interface ContentCodec {
  getMediaType(): string
  bytesToValue(bytes: Buffer, schema: WoT.DataSchema, parameters?: {[key: string]: string}): any
  valueToBytes(value: any, schema: WoT.DataSchema, parameters?: {[key: string]: string}): Buffer
}

export class Content {
  public contentType: string;
  public body: Buffer;

  constructor(contentType: string, body: Buffer) {
    this.contentType = contentType;
    this.body = body;
  }
}

import { OctetstreamCodec } from "./octetstream-codec";

/** default implementation offerin Json de-/serialisation */
class JsonCodec implements ContentCodec {

  private subMediaType: string;

  constructor(subMediaType?: string) {
    if (!subMediaType) {
      this.subMediaType = ContentSerdes.DEFAULT; // 'application/json' 
    } else {
      this.subMediaType = subMediaType;
    }
  }

  getMediaType(): string {
    return this.subMediaType;
  }

  bytesToValue(bytes: Buffer, schema: WoT.DataSchema, parameters: {[key: string]: string}): any {
    //console.debug(`JsonCodec parsing '${bytes.toString()}'`);


    let parsed: any;
    try {
      parsed = JSON.parse(bytes.toString());
    } catch (err) {
      if (err instanceof SyntaxError) {
        if (bytes.byteLength == 0) {
          // empty payload -> void/undefined
          parsed = undefined;
        } else {
          // be relaxed about what is received -> string without quotes
          parsed = bytes.toString();
        }
      } else {
        throw err;
      }
    }

    // TODO validate using schema

    // remove legacy wrapping and use RFC 7159
    // TODO remove once dropped from all PlugFest implementation
    if (parsed && parsed.value !== undefined) {
      console.warn(`JsonCodec removing { value: ... } wrapper`);
      parsed = parsed.value;
    }
    return parsed;
  }

  valueToBytes(value: any, schema: WoT.DataSchema, parameters?: {[key: string]: string}): Buffer {
    //console.debug("JsonCodec serializing", value);
    let body = "";
    if (value !== undefined) {
      body = JSON.stringify(value);
    }
    return Buffer.from(body);
  }
}

class TextCodec implements ContentCodec {
  getMediaType(): string {
    return 'text/plain'
  }

  bytesToValue(bytes: Buffer, schema: WoT.DataSchema, parameters: {[key: string]: string}): any {
    //console.debug(`TextCodec parsing '${bytes.toString()}'`);
    
    let parsed: any;
    parsed = bytes.toString(parameters.charset);

    // TODO apply schema to convert string to real type

    return parsed;
  }

  valueToBytes(value: any, schema: WoT.DataSchema, parameters?: {[key: string]: string}): Buffer {
    //console.debug(`TextCodec serializing '${value}'`);
    let body = "";
    if (value !== undefined) {
      body = value;
    }

    return Buffer.from(body, parameters.charset);
  }
}


/**
 * is a singleton that is used to serialize and deserialize data
 * it can accept multiple serializers and decoders
 */
export class ContentSerdes {
  private static instance: ContentSerdes;

  public static readonly DEFAULT: string = "application/json";
  // provide DEFAULT also on instance
  public readonly DEFAUT: string = ContentSerdes.DEFAULT;
  private codecs: Map<string, ContentCodec> = new Map();
  private constructor() { }

  public static get(): ContentSerdes {
    if (!this.instance) {
      this.instance = new ContentSerdes();
      this.instance.addCodec(new JsonCodec());
      this.instance.addCodec(new JsonCodec('application/senml+json'));
      this.instance.addCodec(new TextCodec());
      this.instance.addCodec(new OctetstreamCodec());
    }
    return this.instance;
  }

  public static getMediaType(contentType: string): string {
    
    let parts = contentType.split(";");
    return parts[0].trim();
  }
  public static getMediaTypeParameters(contentType: string): { [key: string]: string } {
    let parts = contentType.split(";").slice(1);

    // parse parameters into object
    let params: { [key: string]: string } = {};
    parts.forEach((p) => {
      let eq = p.indexOf("=");

      if (eq >= 0) {
        params[p.substr(0, eq).trim()] = p.substr(eq + 1).trim();
      } else {
        // handle parameters without value
        params[p.trim()] = null;
      }
    })

    return params;
  }

  public addCodec(codec: ContentCodec) {
    ContentSerdes.get().codecs.set(codec.getMediaType(), codec);
  }

  public getSupportedMediaTypes(): Array<string> {
    return Array.from(ContentSerdes.get().codecs.keys());
  }

  public contentToValue(content: Content, schema: WoT.DataSchema): any {

    if (content.contentType === undefined) {
      if (content.body.byteLength > 0) {
        // default to application/json
        content.contentType = ContentSerdes.DEFAULT;
      } else {
        // empty payload without media type -> void/undefined (note: e.g., empty payload with text/plain -> "")
        return;
      }
    }

    // split into media type and parameters
    let mt = ContentSerdes.getMediaType(content.contentType);
    let par = ContentSerdes.getMediaTypeParameters(content.contentType);

    // choose codec based on mediaType
    if (this.codecs.has(mt)) {
      console.debug(`ContentSerdes deserializing from ${content.contentType}`);

      let codec = this.codecs.get(mt)

      // use codec to deserialize
      let res = codec.bytesToValue(content.body, schema, par);

      return res;

    } else {
      console.warn(`ContentSerdes passthrough due to unsupported media type '${mt}'`);
      return content.body.toString();
    }
  }

  public valueToContent(value: any, schema: WoT.DataSchema, contentType = ContentSerdes.DEFAULT): Content {

    if (value === undefined) console.warn("ContentSerdes valueToContent got no value");

    let bytes = null;

    // split into media type and parameters
    let mt = ContentSerdes.getMediaType(contentType);
    let par = ContentSerdes.getMediaTypeParameters(contentType);

    // choose codec based on mediaType
    if (this.codecs.has(mt)) {
      console.debug(`ContentSerdes serializing to ${contentType}`);
      let codec = this.codecs.get(mt);
      bytes = codec.valueToBytes(value, schema, par);
    } else {
      console.warn(`ContentSerdes passthrough due to unsupported serialization format '${contentType}'`);
      bytes = Buffer.from(value);
    }

    return { contentType: contentType, body: bytes };
  }
}

// export singleton instance
export default ContentSerdes.get();
