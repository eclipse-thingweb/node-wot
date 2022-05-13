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
import { Content } from "./protocol-interfaces";
import Ajv from "ajv";

// Problem: strict mode ajv does not accept unknown keywords in schemas
// however property affordances could contain all sort of fields
// since people could use their own ontologies.

// Strict mode has a lot of other checks and it prevents runtime unexpected problems
// TODO: in the future we should use the strict mode
const ajv = new Ajv({ strict: false });

export class InteractionOutput implements WoT.InteractionOutput {
    private content: Content;
    private parsedValue: unknown;
    private buffer: ArrayBuffer;
    data?: ReadableStream;
    dataUsed: boolean;
    form?: WoT.Form;
    schema?: WoT.DataSchema;

    constructor(content: Content, form?: WoT.Form, schema?: WoT.DataSchema) {
        this.content = content;
        this.form = form;
        this.schema = schema;

        if (content && content.body) {
            this.data = ProtocolHelpers.toWoTStream(content.body) as ReadableStream;
        }
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
        if (this.buffer) {
            return this.buffer;
        }

        const data = await ProtocolHelpers.readStreamFully(this.content.body);
        this.dataUsed = true;
        this.buffer = data;

        return data;
    }

    async value<T>(): Promise<T> {
        // the value has been already read?
        if (this.parsedValue) return this.parsedValue as T;

        // is content type valid?
        if (!this.form || !ContentSerdes.get().isSupported(this.content.type)) {
            const message = !this.form ? "Missing form" : `Content type ${this.content.type} not supported`;
            throw new NotSupportedError(message);
        }

        // read fully the stream
        const data = await ProtocolHelpers.readStreamFully(this.content.body);
        this.dataUsed = true;
        this.buffer = data;

        // call the contentToValue
        const value = ContentSerdes.get().contentToValue({ type: this.content.type, body: data }, this.schema);

        // any data (schema)?
        if (this.schema) {
            // validate the schema
            const validate = ajv.compile<T>(this.schema);

            if (!validate(value)) {
                console.debug("[core]", "schema = ", util.inspect(this.schema, { depth: 10, colors: true }));
                console.debug("[core]", "value: ", value);
                console.debug("[core]", "Errror: ", validate.errors);
                throw new DataSchemaError("Invalid value according to DataSchema", value as WoT.DataSchemaValue);
            }
        }

        this.parsedValue = value;
        return this.parsedValue as T;
    }
}
