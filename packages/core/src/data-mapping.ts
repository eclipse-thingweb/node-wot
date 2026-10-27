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

import { DataSchema } from "wot-typescript-definitions";
import { ContentSerdes } from "./content-serdes";
import Helpers from "./helpers";
import { Endianness } from "./protocol-interfaces";

type CoerceType = "number" | "integer" | "boolean" | "string";

type Direction = "fromWire" | "toWire";

const NUMERIC_OPERATIONS = ["mul", "add", "round", "clamp"];
const TO_WIRE_OPERATIONS = [...NUMERIC_OPERATIONS, "enum", "enumRange"];

export interface DataMappingStep {
    "map:proc": string;
    "jsonv:path"?: string;
    "map:fields"?: Record<string, DataMappingStep[]>;
    "map:type"?: CoerceType;
    "map:decimalSeparator"?: "." | ",";
    "map:sentinels"?: string[];
    "map:sentinelValue"?: unknown;
    "map:name"?: string;
    "map:value"?: number;
    "map:mode"?: "floor" | "ceil" | "nearest" | "towardZero";
    "map:min"?: number;
    "map:max"?: number;
    "map:map"?: Array<{ "map:wire": unknown; "map:app": unknown }>;
    "map:ranges"?: Array<{ "map:min": number; "map:max": number; "map:app": unknown; "map:canonical"?: number }>;
    "map:onNoMatch"?: "error";
    "octv:fields"?: Array<{
        "octv:fieldName": string;
        "octv:mask": number;
        "octv:shift": number;
        "octv:fieldType"?: "boolean" | "integer";
    }>;
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
    const text = String(value)
        .trim()
        .replace(decimalSeparator === "," ? "," : /$^/, ".");
    const number = Number(text);
    if (!Number.isFinite(number)) {
        throw new Error(`Cannot coerce '${String(value)}' to ${targetType}`);
    }
    if (targetType === "integer" && !Number.isInteger(number)) {
        throw new Error(`Cannot coerce '${String(value)}' to integer`);
    }
    return number;
}

function requireNoMatchError(step: DataMappingStep): void {
    // No default value is defined by the mapping model, so 'default' cannot be honoured.
    const policy = step["map:onNoMatch"];
    if (policy !== undefined && policy !== "error") {
        throw new Error("map:onNoMatch must be 'error'");
    }
}

// Applies convert to the whole value, or in place to the member named by map:name.
function applyToTarget(current: unknown, step: DataMappingStep, convert: (value: unknown) => unknown): unknown {
    const name = step["map:name"];
    if (name === undefined) {
        return convert(current);
    }
    if (typeof name !== "string") {
        throw new Error("map:name must be a string");
    }
    if (
        current == null ||
        typeof current !== "object" ||
        Array.isArray(current) ||
        !Object.prototype.hasOwnProperty.call(current, name)
    ) {
        throw new Error(`Mapping member '${name}' was not found`);
    }
    return { ...current, [name]: convert((current as Record<string, unknown>)[name]) };
}

function enumValue(value: unknown, step: DataMappingStep, direction: Direction): unknown {
    const entries = step["map:map"];
    if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error("enum requires map:map as a non-empty array");
    }
    requireNoMatchError(step);

    // A read looks up the wire value, a write looks up the application value.
    const lookup = direction === "fromWire" ? "map:wire" : "map:app";
    const replacement = direction === "fromWire" ? "map:app" : "map:wire";
    const seen = new Set<unknown>();
    let matched = false;
    let result: unknown;
    for (const entry of entries) {
        if (entry == null || typeof entry !== "object" || !("map:wire" in entry) || !("map:app" in entry)) {
            throw new Error("enum entries require map:wire and map:app");
        }
        if (seen.has(entry[lookup])) {
            throw new Error(`enum contains duplicate ${lookup} value '${String(entry[lookup])}'`);
        }
        seen.add(entry[lookup]);
        if (!matched && entry[lookup] === value) {
            matched = true;
            result = entry[replacement];
        }
    }
    if (!matched) {
        throw new Error(`No enum entry matches '${String(value)}'`);
    }
    return result;
}

function enumRangeValue(value: unknown, step: DataMappingStep, direction: Direction): unknown {
    const ranges = step["map:ranges"];
    if (!Array.isArray(ranges) || ranges.length === 0) {
        throw new Error("enumRange requires map:ranges as a non-empty array");
    }
    requireNoMatchError(step);

    const accepted: Array<{ min: number; max: number }> = [];
    let matched = false;
    let missingCanonical = false;
    let result: unknown;
    for (const range of ranges) {
        if (range == null || typeof range !== "object" || !("map:app" in range)) {
            throw new Error("enumRange entries require map:app");
        }
        const min = range["map:min"];
        const max = range["map:max"];
        if (!Number.isFinite(min) || !Number.isFinite(max)) {
            throw new Error("enumRange entries require finite numeric map:min and map:max");
        }
        if (min > max) {
            throw new Error(`enumRange entry has map:min ${min} greater than map:max ${max}`);
        }
        const canonical = range["map:canonical"];
        if (canonical !== undefined && !(Number.isFinite(canonical) && canonical >= min && canonical <= max)) {
            throw new Error("map:canonical must be a number within its range");
        }
        if (accepted.some((other) => min <= other.max && max >= other.min)) {
            throw new Error(`enumRange entry [${min}, ${max}] overlaps another entry`);
        }
        accepted.push({ min, max });
        if (matched) {
            continue;
        }
        if (direction === "fromWire" && typeof value === "number" && value >= min && value <= max) {
            matched = true;
            result = range["map:app"];
        } else if (direction === "toWire" && range["map:app"] === value) {
            matched = true;
            missingCanonical = canonical === undefined;
            result = canonical;
        }
    }
    if (direction === "fromWire" && typeof value !== "number") {
        throw new Error(`enumRange requires a numeric input, got '${String(value)}'`);
    }
    if (!matched) {
        throw new Error(`No enumRange entry matches '${String(value)}'`);
    }
    if (missingCanonical) {
        throw new Error(`enumRange entry '${String(value)}' has no map:canonical, so it cannot be written`);
    }
    return result;
}

function finiteNumberParameter(step: DataMappingStep, key: string): number | undefined {
    const value = step[key];
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`${String(step["map:proc"])} requires ${key} as a finite number`);
    }
    return value;
}

// Round half to even, as the US3 `nearest` mode requires; Math.round would round halves up.
function roundNearestEven(value: number): number {
    return Math.abs(value % 1) === 0.5 ? 2 * Math.round(value / 2) : Math.round(value);
}

function roundValue(value: number, step: DataMappingStep): number {
    switch (step["map:mode"]) {
        case "floor":
            return Math.floor(value);
        case "ceil":
            return Math.ceil(value);
        case "towardZero":
            return Math.trunc(value);
        case "nearest":
            return roundNearestEven(value);
        default:
            throw new Error("round requires map:mode 'floor', 'ceil', 'nearest' or 'towardZero'");
    }
}

function clampValue(value: number, step: DataMappingStep): number {
    const min = finiteNumberParameter(step, "map:min");
    const max = finiteNumberParameter(step, "map:max");
    if (min === undefined && max === undefined) {
        throw new Error("clamp requires map:min and/or map:max");
    }
    if (min !== undefined && max !== undefined && min > max) {
        throw new Error(`clamp has map:min ${min} greater than map:max ${max}`);
    }
    return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, value));
}

function numericValue(value: unknown, step: DataMappingStep): number {
    const operation = String(step["map:proc"]);
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`${operation} requires a finite numeric input, got '${String(value)}'`);
    }

    let result: number;
    if (operation === "round") {
        result = roundValue(value, step);
    } else if (operation === "clamp") {
        result = clampValue(value, step);
    } else {
        const operand = finiteNumberParameter(step, "map:value");
        if (operand === undefined) {
            throw new Error(`${operation} requires map:value as a finite number`);
        }
        result = operation === "mul" ? value * operand : value + operand;
    }
    if (!Number.isFinite(result)) {
        throw new Error(`${operation} produced a non-finite result`);
    }
    // Normalise -0 so that JSON consumers do not see a signed zero.
    return result === 0 ? 0 : result;
}

function bitExtractValue(value: unknown, step: DataMappingStep): Record<string, unknown> {
    const fields = step["octv:fields"];
    if (!Array.isArray(fields) || fields.length === 0) {
        throw new Error("bitExtract requires octv:fields as a non-empty array");
    }

    const definitions: Array<{ name: string; mask: bigint; shift: bigint; boolean: boolean }> = [];
    const names = new Set<string>();
    let claimed = BigInt(0);
    for (const field of fields) {
        if (field == null || typeof field !== "object") {
            throw new Error("bitExtract fields must be objects");
        }
        const name = field["octv:fieldName"];
        if (typeof name !== "string" || name === "" || name === "__proto__") {
            throw new Error("bitExtract fields require a valid octv:fieldName");
        }
        if (names.has(name)) {
            throw new Error(`bitExtract contains duplicate octv:fieldName '${name}'`);
        }
        names.add(name);

        const mask = field["octv:mask"];
        if (typeof mask !== "number" || !Number.isSafeInteger(mask) || mask <= 0) {
            throw new Error(`bitExtract field '${name}' requires octv:mask as a positive safe integer`);
        }
        const shift = field["octv:shift"];
        if (typeof shift !== "number" || !Number.isSafeInteger(shift) || shift < 0) {
            throw new Error(`bitExtract field '${name}' requires octv:shift as a non-negative integer`);
        }
        const fieldType = field["octv:fieldType"] ?? "integer";
        if (fieldType !== "boolean" && fieldType !== "integer") {
            throw new Error(`bitExtract field '${name}' has unsupported octv:fieldType '${String(fieldType)}'`);
        }

        const bigMask = BigInt(mask);
        const lowestBit = mask.toString(2).length - 1 - mask.toString(2).lastIndexOf("1");
        // A shift beyond the lowest mask bit would drop selected bits.
        if (shift > lowestBit) {
            throw new Error(`bitExtract field '${name}' has octv:shift larger than its mask's lowest bit`);
        }
        if ((claimed & bigMask) !== BigInt(0)) {
            throw new Error(`bitExtract field '${name}' has an octv:mask overlapping another field`);
        }
        claimed |= bigMask;
        definitions.push({ name, mask: bigMask, shift: BigInt(shift), boolean: fieldType === "boolean" });
    }

    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        throw new Error(`bitExtract requires a non-negative integer input, got '${String(value)}'`);
    }
    const wire = BigInt(value);
    const result: Record<string, unknown> = {};
    for (const { name, mask, shift, boolean } of definitions) {
        const extracted = (wire & mask) >> shift;
        result[name] = boolean ? extracted !== BigInt(0) : Number(extracted);
    }
    return result;
}

function applyMappingSteps(value: unknown, steps: unknown, direction: Direction = "fromWire"): unknown {
    if (!Array.isArray(steps)) {
        throw new Error("Mapping steps must be an ordered array");
    }

    let current: unknown = value;
    for (const step of steps) {
        if (step == null || typeof step !== "object" || Array.isArray(step)) {
            throw new Error(`map:${direction} steps must be objects`);
        }
        const operation = step["map:proc"];
        if (direction === "toWire" && !TO_WIRE_OPERATIONS.includes(operation)) {
            throw new Error(`Unsupported to-wire mapping operation '${String(operation)}'`);
        }
        if (NUMERIC_OPERATIONS.includes(operation)) {
            current = applyToTarget(current, step, (member) => numericValue(member, step));
            continue;
        }
        if (operation === "coerce") {
            current = coerceValue(current, step);
            continue;
        }
        if (operation === "enum") {
            current = applyToTarget(current, step, (member) => enumValue(member, step, direction));
            continue;
        }
        if (operation === "enumRange") {
            current = applyToTarget(current, step, (member) => enumRangeValue(member, step, direction));
            continue;
        }
        if (operation === "bitExtract") {
            current = applyToTarget(current, step, (member) => bitExtractValue(member, step));
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

/**
 * Applies the `map:toWire` pipeline of a form to an application value before it is written.
 * A form with a `map:fromWire` pipeline but no `map:toWire` pipeline cannot be written, because
 * the inverse of a read mapping is not derived implicitly.
 */
export function applyToWireMapping(value: unknown, form: Record<string, unknown>): unknown {
    const valueMapping = getValueMapping(form);
    if (valueMapping === undefined) {
        return value;
    }
    const steps = valueMapping["map:toWire"];
    if (steps === undefined) {
        if (valueMapping["map:fromWire"] !== undefined) {
            throw new Error("map:toWire is required to write a form that has a map:fromWire mapping");
        }
        return value;
    }
    if (!Array.isArray(steps)) {
        throw new Error("map:toWire must be an ordered array");
    }

    return applyMappingSteps(value, steps, "toWire");
}

export interface WireDecoding {
    contentType: string;
    schema: DataSchema;
}

/**
 * The codec decodes octet-streams according to the schema it is given, but the
 * input of a `map:fromWire` pipeline is the wire value, not the application value.
 * Returns how to decode that wire value (an unsigned integer unless the content type
 * says otherwise), or undefined when the application schema should be used.
 */
export function getWireDecoding(form: Record<string, unknown>, contentType: string): WireDecoding | undefined {
    if (getValueMapping(form)?.["map:fromWire"] === undefined) {
        return undefined;
    }
    if (ContentSerdes.getMediaType(contentType).toLowerCase() !== "application/octet-stream") {
        return undefined;
    }

    const byteOffset = form["octv:byteOffset"];
    if (byteOffset !== undefined && byteOffset !== 0) {
        throw new Error("octv:byteOffset other than 0 is not supported");
    }

    const parameters = ContentSerdes.getMediaTypeParameters(contentType);
    const additions: string[] = [];
    if (!("signed" in parameters)) {
        additions.push("signed=false");
    }

    const byteLength = form["octv:byteLength"];
    if (byteLength !== undefined) {
        if (typeof byteLength !== "number" || !Number.isInteger(byteLength) || byteLength < 1) {
            throw new Error("octv:byteLength must be a positive integer");
        }
        if (!("length" in parameters)) {
            additions.push(`length=${byteLength}`);
        }
    }

    const byteOrder = form["octv:byteOrder"];
    if (byteOrder !== undefined) {
        if (byteOrder !== "bigEndian" && byteOrder !== "littleEndian") {
            throw new Error("octv:byteOrder must be 'bigEndian' or 'littleEndian'");
        }
        if (!("byteSeq" in parameters)) {
            additions.push(`byteSeq=${byteOrder === "bigEndian" ? Endianness.BIG_ENDIAN : Endianness.LITTLE_ENDIAN}`);
        }
    }

    return { contentType: [contentType, ...additions].join(";"), schema: { type: "integer" } };
}
