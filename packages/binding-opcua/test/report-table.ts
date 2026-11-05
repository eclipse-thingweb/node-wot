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

//
// Tables printed by the contentType tests, to show behaviour that assertions state
// one case at a time. They are documentation, so they are off unless asked for:
//
//     BINDING_OPCUA_TEST_VERBOSE=1 npm test
//
// A pipeline therefore sees the usual mocha output and nothing else.
//

/** true when the tables were asked for; anything but unset, "", "0" or "false" counts */
export function verboseReports(): boolean {
    const flag = process.env.BINDING_OPCUA_TEST_VERBOSE;
    return flag !== undefined && flag !== "" && flag !== "0" && flag.toLowerCase() !== "false";
}

/** one cell, already rendered */
export type Cell = string;

export interface TableOptions {
    /** printed above the table */
    title: string;
    /** printed under the title, e.g. how to read the table */
    subtitle?: string;
    headers: Cell[];
    rows: Cell[][];
    /** longest a cell may be before it is cut, per column; default 34 */
    maxWidth?: number;
}

/** cut to `width`, marking what was dropped */
export function truncate(text: string, width: number): string {
    const oneLine = text.replace(/\s+/gu, " ").trim();
    return oneLine.length <= width ? oneLine : oneLine.slice(0, Math.max(1, width - 1)) + "…";
}

/**
 * The gist of an error message: enough to tell two failures apart without wrapping
 * the table. The full message is in the assertion that checks it.
 */
export function shortError(error: string | undefined): string {
    if (error === undefined || error === "") {
        return "";
    }
    const withoutPrefix = error.replace(/^binding-opcua:\s*/u, "");
    const firstSentence = withoutPrefix.split(/\.\s|\. $|,\s(?=but )/u)[0];
    return firstSentence.replace(/\s+/gu, " ").trim();
}

/**
 * A refusal in a few words, so a wide matrix stays readable. The full message is
 * asserted by the test that cares about it.
 */
export function shortVerdict(error: string | undefined): string {
    const message = error ?? "";
    if (/only supported when the value is a ByteString/u.test(message)) {
        return "x refused: not a ByteString";
    }
    if (/only supported when the target is a ByteString/u.test(message)) {
        return "x refused: target not a ByteString";
    }
    if (/cannot frame/u.test(message)) {
        return "x refused: array of ByteString";
    }
    if (/Invalid value according to DataSchema/u.test(message)) {
        return "x TD type does not match";
    }
    if (/No schema type defined/u.test(message)) {
        return "x TD declares no type";
    }
    if (/unsupported contentType/u.test(message)) {
        return "x unsupported contentType";
    }
    return "x " + shortError(message);
}

function pad(text: string, width: number): string {
    return text + " ".repeat(Math.max(0, width - [...text].length));
}

/** Renders an aligned table with a single-line border, or nothing when not verbose. */
export function printTable(options: TableOptions): void {
    if (!verboseReports()) {
        return;
    }
    const maxWidth = options.maxWidth ?? 34;
    const body = options.rows.map((row) => row.map((cell) => truncate(cell ?? "", maxWidth)));
    const headers = options.headers.map((h) => truncate(h, maxWidth));
    const widths = headers.map((h, i) => Math.max([...h].length, ...body.map((row) => [...(row[i] ?? "")].length)));

    const rule = (left: string, mid: string, right: string) =>
        left + widths.map((w) => "─".repeat(w + 2)).join(mid) + right;
    const render = (row: Cell[]) => "│ " + row.map((cell, i) => pad(cell ?? "", widths[i])).join(" │ ") + " │";

    const out: string[] = ["", options.title];
    if (options.subtitle !== undefined) {
        out.push(options.subtitle);
    }
    out.push(rule("┌", "┬", "┐"), render(headers), rule("├", "┼", "┤"));
    for (const row of body) {
        out.push(render(row));
    }
    out.push(rule("└", "┴", "┘"), "");

    // Deliberately console output, not the logger: the table is the deliverable.
    // eslint-disable-next-line no-console
    console.info(out.join("\n"));
}
