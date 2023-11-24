/********************************************************************************
 * Copyright (c) 2021 Contributors to the Eclipse Foundation
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
import * as util from "util";
import * as WoT from "wot-typescript-definitions";
import { ContentSerdes } from "./content-serdes";
import { ProtocolHelpers } from "./core";
import { DataSchemaError, NotSupportedError } from "./errors";
import { Content } from "./content";
import Ajv from "ajv";
import { createLoggers } from "./logger";

const { debug } = createLoggers("core", "interaction-output");

// Problem: strict mode ajv does not accept unknown keywords in schemas
// however property affordances could contain all sort of fields
// since people could use their own ontologies.

// Strict mode has a lot of other checks and it prevents runtime unexpected problems
// TODO: in the future we should use the strict mode
const ajv = new Ajv({ strict: false });

export class InteractionOutput implements WoT.InteractionOutput {
    private content: Content;
    private parsedValue: unknown;
    private buffer?: ArrayBuffer;
    private _stream?: ReadableStream;
    dataUsed: boolean;
    form?: WoT.Form;
    schema?: WoT.DataSchema;

    public get data(): ReadableStream {
        if (this._stream) {
            return this._stream;
        }

        if (this.dataUsed) {
            throw new Error("Can't read the stream once it has been already used");
        }
        // Once the stream is created data might be pulled unpredictably
        // therefore we assume that it is going to be used to be safe.
        this.dataUsed = true;
        return (this._stream = ProtocolHelpers.toWoTStream(this.content.body) as ReadableStream);
    }

    constructor(content: Content, form?: WoT.Form, schema?: WoT.DataSchema) {
        this.content = content;
        this.form = form;
        this.schema = schema;
        this.dataUsed = false;
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
        if (this.buffer) {
            return this.buffer;
        }

        if (this.dataUsed) {
            throw new Error("Can't read the stream once it has been already used");
        }

        const data = await this.content.toBuffer();
        this.dataUsed = true;
        this.buffer = data;

        return data;
    }

    async value<T>(): Promise<T> {
        // the value has been already read?
        if (this.parsedValue != null) return this.parsedValue as T;

        if (this.dataUsed) {
            throw new Error("Can't read the stream once it has been already used");
        }

        // is content type valid?
        if (!this.form || !ContentSerdes.get().isSupported(this.content.type)) {
            const message = !this.form ? "Missing form" : `Content type ${this.content.type} not supported`;
            throw new NotSupportedError(message);
        }

        // read fully the stream
        const data = await this.content.toBuffer();
        this.dataUsed = true;
        this.buffer = data;

        // call the contentToValue
        // TODO: should be fixed contentToValue MUST define schema as nullable
        const value = ContentSerdes.get().contentToValue({ type: this.content.type, body: data }, this.schema ?? {});

        // any data (schema)?
        if (this.schema) {
            // validate the schema
            const validate = ajv.compile<T>(this.schema);

            if (!validate(value)) {
                debug(`schema = ${util.inspect(this.schema, { depth: 10, colors: true })}`);
                debug(`value: ${value}`);
                debug(`Errror: ${validate.errors}`);
                throw new DataSchemaError("Invalid value according to DataSchema", value as WoT.DataSchemaValue);
            }
        }

        this.parsedValue = value;
        return this.parsedValue as T;
    }
}
