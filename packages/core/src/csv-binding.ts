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

export type CsvRowRepresentation = "array" | "object";

export interface CsvBindingOptions {
    delimiter: string;
    quoteChar: string;
    escapeChar: string;
    recordDelimiter?: string;
    encoding: BufferEncoding;
    decimalSeparator: "." | ",";
    commentPrefix?: string;
    headerRow?: number;
    metadataRows: number[];
    dataRowPattern?: unknown;
    rowRepresentation: CsvRowRepresentation;
    columns?: string[];
    tableDiscriminator?: string;
}

export const DEFAULT_CSV_BINDING_OPTIONS: Omit<
    CsvBindingOptions,
    "rowRepresentation"
> = {
    delimiter: ",",
    quoteChar: '"',
    escapeChar: '"',
    encoding: "utf8",
    decimalSeparator: ".",
    metadataRows: [],
};

function readSingleCharacter(value: unknown, name: string, fallback: string): string {
    if (value === undefined) {
        return fallback;
    }
    if (typeof value !== "string" || value.length !== 1) {
        throw new Error(`${name} must be a single character`);
    }
    return value;
}

function readRowIndexes(value: unknown, name: string): number[] {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value) || !value.every((row) => Number.isInteger(row) && row >= 0)) {
        throw new Error(`${name} must contain non-negative integer row indexes`);
    }
    return value as number[];
}

function readColumns(value: unknown): string[] | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (!Array.isArray(value) || !value.every((column) => typeof column === "string" && column.length > 0)) {
        throw new Error("csvv:columns must contain non-empty strings");
    }
    return value as string[];
}

export function csvBindingOptionsFromForm(form: Record<string, unknown>): CsvBindingOptions {
    const rowRepresentation = form["csvv:rowRepresentation"];
    if (rowRepresentation !== "array" && rowRepresentation !== "object") {
        throw new Error("csvv:rowRepresentation must be 'array' or 'object'");
    }

    const encoding = form["csvv:encoding"] ?? DEFAULT_CSV_BINDING_OPTIONS.encoding;
    if (typeof encoding !== "string" || !Buffer.isEncoding(encoding)) {
        throw new Error("csvv:encoding must be a supported character encoding");
    }

    const decimalSeparator = form["csvv:decimalSeparator"] ?? DEFAULT_CSV_BINDING_OPTIONS.decimalSeparator;
    if (decimalSeparator !== "." && decimalSeparator !== ",") {
        throw new Error("csvv:decimalSeparator must be '.' or ','");
    }

    const headerRow = form["csvv:headerRow"];
    if (headerRow !== undefined && (!Number.isInteger(headerRow) || (headerRow as number) < 0)) {
        throw new Error("csvv:headerRow must be a non-negative integer");
    }

    const recordDelimiter = form["csvv:recordDelimiter"];
    if (recordDelimiter !== undefined && recordDelimiter !== "\n" && recordDelimiter !== "\r\n") {
        throw new Error("csvv:recordDelimiter must be '\\n' or '\\r\\n'");
    }

    return {
        delimiter: readSingleCharacter(form["csvv:delimiter"], "csvv:delimiter", DEFAULT_CSV_BINDING_OPTIONS.delimiter),
        quoteChar: readSingleCharacter(form["csvv:quoteChar"], "csvv:quoteChar", DEFAULT_CSV_BINDING_OPTIONS.quoteChar),
        escapeChar: readSingleCharacter(form["csvv:escapeChar"], "csvv:escapeChar", DEFAULT_CSV_BINDING_OPTIONS.escapeChar),
        recordDelimiter: recordDelimiter as string | undefined,
        encoding: encoding as BufferEncoding,
        decimalSeparator,
        commentPrefix: form["csvv:commentPrefix"] as string | undefined,
        headerRow: headerRow as number | undefined,
        metadataRows: readRowIndexes(form["csvv:metadataRows"], "csvv:metadataRows"),
        dataRowPattern: form["csvv:dataRowPattern"],
        rowRepresentation,
        columns: readColumns(form["csvv:columns"]),
        tableDiscriminator: form["csvv:tableDiscriminator"] as string | undefined,
    };
}

export function normalizeCsvBindingOptions(options: Partial<CsvBindingOptions>): CsvBindingOptions {
    return csvBindingOptionsFromForm({
        "csvv:delimiter": options.delimiter,
        "csvv:quoteChar": options.quoteChar,
        "csvv:escapeChar": options.escapeChar,
        "csvv:recordDelimiter": options.recordDelimiter,
        "csvv:encoding": options.encoding,
        "csvv:decimalSeparator": options.decimalSeparator,
        "csvv:commentPrefix": options.commentPrefix,
        "csvv:headerRow": options.headerRow,
        "csvv:metadataRows": options.metadataRows,
        "csvv:dataRowPattern": options.dataRowPattern,
        "csvv:rowRepresentation": options.rowRepresentation,
        "csvv:columns": options.columns,
        "csvv:tableDiscriminator": options.tableDiscriminator,
    });
}
