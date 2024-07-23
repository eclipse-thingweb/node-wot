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
import { DataSchemaError, NotReadableError, NotSupportedError } from "./errors";
import { Content } from "./content";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { createLoggers } from "./logger";

const { debug, warn } = createLoggers("core", "interaction-output");

// Problem: strict mode ajv does not accept unknown keywords in schemas
// however property affordances could contain all sort of fields
// since people could use their own ontologies.

// Strict mode has a lot of other checks and it prevents runtime unexpected problems
// TODO: in the future we should use the strict mode
// addUsedSchema may cause memory leak in our use-case / environment (see https://github.com/eclipse-thingweb/node-wot/issues/1062)
const ajv = new Ajv({ strict: false, addUsedSchema: false });
addFormats(ajv);

export class InteractionOutput implements WoT.InteractionOutput {
    #content: Content;
    #value: unknown;
    #buffer?: ArrayBuffer;
    #stream?: ReadableStream;
    dataUsed: boolean;
    form?: WoT.Form;
    schema?: WoT.DataSchema;
    ignoreValidation: boolean; // by default set to false

    public get data(): ReadableStream {
        if (this.#stream) {
            return this.#stream;
        }

        if (this.dataUsed) {
            throw new Error("Can't read the stream once it has been already used");
        }
        // Once the stream is created data might be pulled unpredictably
        // therefore we assume that it is going to be used to be safe.
        this.dataUsed = true;
        return (this.#stream = ProtocolHelpers.toWoTStream(this.#content.body) as ReadableStream);
    }

    constructor(content: Content, form?: WoT.Form, schema?: WoT.DataSchema, options = { ignoreValidation: false }) {
        this.#content = content;
        this.form = form;
        this.schema = schema;
        this.ignoreValidation = options.ignoreValidation ?? false;
        this.dataUsed = false;
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
        if (this.#buffer) {
            return this.#buffer;
        }

        if (this.dataUsed) {
            throw new Error("Can't read the stream once it has been already used");
        }

        const data = await this.#content.toBuffer();
        this.dataUsed = true;
        this.#buffer = data;

        return data;
    }

    async value<T extends WoT.DataSchemaValue>(): Promise<T> {
        // is there any value expected at all?
        if (this.schema == null) {
            warn(
                `No schema defined. Hence undefined is reported for value() function. If you are invoking an action with no output that is on purpose, otherwise consider using arrayBuffer().`
            );
            return undefined as unknown as T;
        }

        // the value has been already read?
        if (this.#value !== undefined) {
            return this.#value as T;
        }

        if (this.dataUsed) {
            throw new NotReadableError("Can't read the stream once it has been already used");
        }

        if (this.form == null) {
            throw new NotReadableError("No form defined");
        }

        if (
            this.schema.const == null &&
            this.schema.enum == null &&
            this.schema.oneOf == null &&
            this.schema.type == null
        ) {
            throw new NotReadableError("No schema type defined");
        }

        // is content type valid?
        if (!ContentSerdes.get().isSupported(this.#content.type)) {
            const message = `Content type ${this.#content.type} not supported`;
            throw new NotSupportedError(message);
        }

        // read fully the stream
        const bytes = await this.#content.toBuffer();
        this.dataUsed = true;
        this.#buffer = bytes;

        const json = ContentSerdes.get().contentToValue({ type: this.#content.type, body: bytes }, this.schema);

        // validate the schema
        const validate = ajv.compile<T>(this.schema);

        if (!this.ignoreValidation && !validate(json)) {
            debug(`schema = ${util.inspect(this.schema, { depth: 10, colors: true })}`);
            debug(`value: ${json}`);
            debug(`Error: ${validate.errors}`);
            throw new DataSchemaError("Invalid value according to DataSchema", json as WoT.DataSchemaValue);
        }

        this.#value = json;
        return json as T;
    }
}
