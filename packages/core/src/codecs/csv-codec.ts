/********************************************************************************
 * Copyright (c) 2026 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0 or the W3C Software Notice and
 * Document License (2015-05-13) which is available at
 * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.
 *
 * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513
 ********************************************************************************/

import { parse } from "csv-parse/sync";
import { ContentCodec, ContentDecodingContext } from "../content-serdes";
import { csvBindingOptionsFromForm, CsvBindingOptions, normalizeCsvBindingOptions } from "../csv-binding";
import { DataSchema, DataSchemaValue } from "wot-typescript-definitions";
import { createLoggers } from "../logger";

const { debug } = createLoggers("core", "csv-codec");

export default class CsvCodec implements ContentCodec {
    getMediaType(): string {
        return "text/csv";
    }

    bytesToValue(
        bytes: Buffer,
        schema?: DataSchema,
        parameters?: { [key: string]: string | undefined },
        context?: ContentDecodingContext
    ): DataSchemaValue {
        const options: Partial<CsvBindingOptions> =
            context?.form == null ? {} : csvBindingOptionsFromForm(context.form);
        const csvOptions = normalizeCsvBindingOptions({
            ...options,
            delimiter: options.delimiter ?? parameters?.delimiter,
            quoteChar: options.quoteChar ?? parameters?.quote,
            escapeChar: options.escapeChar ?? parameters?.escape,
            recordDelimiter: options.recordDelimiter ?? parameters?.recordDelimiter,
        });
        const encoding = csvOptions.encoding;
        const text = bytes.toString(encoding);
        debug(`CsvCodec parsing '${text}'`);

        if (text.length === 0) {
            return [];
        }

        const rows = parse(text, {
            delimiter: csvOptions.delimiter,
            quote: csvOptions.quoteChar,
            escape: csvOptions.escapeChar,
            record_delimiter: csvOptions.recordDelimiter,
            comment: csvOptions.commentPrefix,
            skip_empty_lines: true,
            relax_column_count: true,
            bom: true,
        }) as string[][];

        const headerRow = csvOptions.headerRow;
        const metadataRows = new Set(csvOptions.metadataRows);
        const dataRows = rows.filter((_row, index) => index !== headerRow && !metadataRows.has(index));
        const columnNames = csvOptions.columns ?? (headerRow === undefined ? undefined : rows[headerRow]);

        if (csvOptions.rowRepresentation === "object") {
            if (columnNames === undefined) {
                throw new Error("CSV object rows require csvv:headerRow or csvv:columns");
            }

            return dataRows.map((row) => {
                if (row.length !== columnNames.length) {
                    throw new Error("CSV row length does not match the column definition");
                }

                return Object.fromEntries(columnNames.map((column, index) => [column, row[index]]));
            }) as DataSchemaValue;
        }

        if (csvOptions.rowRepresentation === "array") {
            return dataRows as DataSchemaValue;
        }

        throw new Error("csvv:rowRepresentation must be 'array' or 'object'");
    }

    valueToBytes(): Buffer {
        throw new Error("CSV serialization is not supported yet");
    }
}
