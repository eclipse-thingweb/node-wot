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

import Helpers from "./helpers";

type CoerceType = "number" | "integer" | "boolean" | "string";

export interface DataMappingStep {
    "map:proc": string;
    "jsonv:path"?: string;
    "map:fields"?: Record<string, DataMappingStep[]>;
    "map:type"?: CoerceType;
    "map:decimalSeparator"?: "." | ",";
    "map:sentinels"?: string[];
    "map:sentinelValue"?: unknown;
    [key: string]: unknown;
}

export interface ValueMapping {
    "map:fromWire"?: DataMappingStep[];
    "map:toWire"?: DataMappingStep[];
    [key: string]: unknown;
}

function getValueMapping(form: Record<string, unknown>): ValueMapping | undefined {
    const valueMapping = form["map:valueMapping"];
    if (valueMapping === undefined) {
        return undefined;
    }
    if (valueMapping == null || typeof valueMapping !== "object" || Array.isArray(valueMapping)) {
        throw new Error("map:valueMapping must be an object");
    }
    return valueMapping as ValueMapping;
}

function coerceValue(value: unknown, step: DataMappingStep): unknown {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const sentinels = step["map:sentinels"];
    if (sentinels !== undefined) {
        if (!Array.isArray(sentinels) || !sentinels.every((sentinel) => typeof sentinel === "string")) {
            throw new Error("map:sentinels must contain strings");
        }
        if (sentinels.includes(String(value))) {
            if (!("map:sentinelValue" in step)) {
                throw new Error("map:sentinelValue is required when a sentinel matches");
            }
            return step["map:sentinelValue"];
        }
    }

    const targetType = step["map:type"];
    if (targetType !== "number" && targetType !== "integer" && targetType !== "boolean" && targetType !== "string") {
        throw new Error("coerce requires map:type 'number', 'integer', 'boolean', or 'string'");
    }

    if (targetType === "string") {
        return String(value);
    }

    if (targetType === "boolean") {
        if (value === true || value === false) {
            return value;
        }
        if (value === "true" || value === "1") {
            return true;
        }
        if (value === "false" || value === "0") {
            return false;
        }
        throw new Error(`Cannot coerce '${String(value)}' to boolean`);
    }

    if (typeof value !== "string" && typeof value !== "number") {
        throw new Error(`Cannot coerce '${String(value)}' to ${targetType}`);
    }
    const decimalSeparator = step["map:decimalSeparator"] ?? ".";
    if (decimalSeparator !== "." && decimalSeparator !== ",") {
        throw new Error("map:decimalSeparator must be '.' or ','");
    }
    const text = String(value).trim().replace(decimalSeparator === "," ? "," : /$^/, ".");
    const number = Number(text);
    if (!Number.isFinite(number)) {
        throw new Error(`Cannot coerce '${String(value)}' to ${targetType}`);
    }
    if (targetType === "integer" && !Number.isInteger(number)) {
        throw new Error(`Cannot coerce '${String(value)}' to integer`);
    }
    return number;
}

function applyMappingSteps(value: unknown, steps: unknown): unknown {
    if (!Array.isArray(steps)) {
        throw new Error("Mapping steps must be an ordered array");
    }

    let current: unknown = value;
    for (const step of steps) {
        if (step == null || typeof step !== "object" || Array.isArray(step)) {
            throw new Error("map:fromWire steps must be objects");
        }
        const operation = step["map:proc"];
        if (operation === "coerce") {
            current = coerceValue(current, step);
            continue;
        }
        if (operation === "record") {
            if (!Array.isArray(current)) {
                throw new Error("record requires an array of input rows");
            }
            const fields = step["map:fields"];
            if (fields == null || typeof fields !== "object" || Array.isArray(fields)) {
                throw new Error("record requires map:fields as an object");
            }

            current = current.map((row) => {
                const record: Record<string, unknown> = {};
                for (const [fieldName, fieldSteps] of Object.entries(fields)) {
                    record[fieldName] = applyMappingSteps(row, fieldSteps);
                }
                return record;
            });
            continue;
        }
        if (operation !== "pick") {
            throw new Error(`Unsupported from-wire mapping operation '${String(operation)}'`);
        }
        const path = step["jsonv:path"];
        if (typeof path !== "string") {
            throw new Error("pick requires jsonv:path");
        }
        const selected = Helpers.extractDataFromPath(current, path);
        if (selected === undefined) {
            throw new Error(`Mapping path '${path}' was not found`);
        }
        current = selected;
    }
    return current;
}

export function applyFromWireMapping(value: unknown, form: Record<string, unknown>): unknown {
    const valueMapping = getValueMapping(form);
    const steps = valueMapping?.["map:fromWire"];
    if (steps === undefined) {
        return value;
    }
    if (!Array.isArray(steps)) {
        throw new Error("map:fromWire must be an ordered array");
    }

    return applyMappingSteps(value, steps);
}
