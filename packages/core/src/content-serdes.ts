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
  bytesToValue(bytes: Buffer): any
  valueToBytes(value: any): Buffer
}

export class Content {
  public mediaType: string;
  public body: Buffer;

  constructor(mediaType: string, body: Buffer) {
    this.mediaType = mediaType;
    this.body = body;
  }
}



/** default implementation offerin Json de-/serialisation */
class JsonCodec implements ContentCodec {

  private subMediaType: string;

  constructor(subMediaType?: string) {
    if(!subMediaType) {
      this.subMediaType = ContentSerdes.DEFAULT; // 'application/json' 
    } else {
      this.subMediaType = subMediaType;
    }
  }

  getMediaType(): string {
    return this.subMediaType;
  }

  bytesToValue(bytes: Buffer): any {
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
    // remove legacy wrapping and use RFC 7159
    if (parsed && parsed.value!==undefined) {
      console.warn(`JsonCodec removing { value: ... } wrapper`);
      parsed = parsed.value;
    }
    return parsed;
  }

  valueToBytes(value: any): Buffer {
    //console.debug("JsonCodec serializing", value);
    let body = "";
    if(value !== undefined) {
      body = JSON.stringify(value);
    }
    return new Buffer(body);
  }
}

class TextCodec implements ContentCodec {
  getMediaType(): string {
    return 'text/plain'
  }

  bytesToValue(bytes: Buffer): any {
    //console.debug(`TextCodec parsing '${bytes.toString()}'`);
    let parsed: any;
    parsed = bytes.toString();
    return parsed;
  }

  valueToBytes(value: any): Buffer {
    //console.debug(`TextCodec serializing '${value}'`);
    let body = "";
    if(value !== undefined) {
      body = value;
    }

    return new Buffer(body);
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
    }
    return this.instance;
  }

  public addCodec(codec: ContentCodec) {
    ContentSerdes.get().codecs.set(codec.getMediaType(), codec);
  }

  public getSupportedMediaTypes(): Array<string> {
    return Array.from(ContentSerdes.get().codecs.keys());
  }

  public contentToValue(content: Content): any {

    if (content.mediaType === undefined) {
      if (content.body.byteLength > 0) {
        // default to application/json
        content.mediaType = ContentSerdes.DEFAULT;
      } else {
        // empty payload without media type -> void/undefined (note: e.g., empty payload with text/plain -> "")
        return;
      }
    }

    console.debug(`ContentSerdes deserializing from ${content.mediaType}`);

    // choose codec based on mediaType
    let isolMediaType: string = this.isolateMediaType(content.mediaType);

    if (!this.codecs.has(isolMediaType)) {
      throw new Error(`Unsupported serialisation format: ${content.mediaType}`);
    }
    let codec = this.codecs.get(isolMediaType)

    // use codec to deserialize
    let res = codec.bytesToValue(content.body);

    return res;
  }
  public isolateMediaType(mediaTypeValue:string):string {
        let semiColumnIndex = mediaTypeValue.indexOf(';');
        if (semiColumnIndex > 0) {
            return mediaTypeValue.substring(0,semiColumnIndex);    
        } else {
            return mediaTypeValue;
        }
  }

  public valueToContent(value: any, mediaType = ContentSerdes.DEFAULT): Content {

    if (value === undefined) console.warn("ContentSerdes valueToContent got no value");

    console.debug(`ContentSerdes serializing to ${mediaType}`);
    // choose codec based on mediaType
    if (!this.codecs.has(mediaType)) {
      throw new Error(`Unsupported serialization format: ${mediaType}`)
    }
    let codec = this.codecs.get(mediaType);

    // use codec to serialize
    let bytes = codec.valueToBytes(value);

    return { mediaType: mediaType, body: bytes };
  }
}

// export singleton instance
export default ContentSerdes.get();
