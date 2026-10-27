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
import { structureSize } from "./eip-codec";
import { EIP_PRIMITIVE_TYPES, EIP_SERVICES, EipForm, EipPrimitiveType, EipStructureDefinition } from "./eip-form";

const SUPPORTED_OPERATIONS = ["readproperty", "writeproperty", "observeproperty"];
const READ_SERVICES = ["ReadTag", "ReadTagFragmented"];
const WRITE_SERVICES = ["WriteTag", "WriteTagFragmented"];
const MAX_DIMENSIONS = 3;

function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function validateDimensions(dimensions: unknown, where: string): number[] {
    if (
        !Array.isArray(dimensions) ||
        dimensions.length < 1 ||
        dimensions.length > MAX_DIMENSIONS ||
        !dimensions.every((d) => isNonNegativeInteger(d) && d >= 1)
    ) {
        throw new Error(`${where}: eipv:dimensions must hold 1 to ${MAX_DIMENSIONS} integers of at least 1`);
    }
    return dimensions as number[];
}

function validateArrayElement(
    type: EipPrimitiveType | undefined,
    structure: EipStructureDefinition | undefined,
    where: string
): void {
    if (type === "eipv:BOOL" || type === "eipv:STRING") {
        throw new Error(`${where}: arrays of ${type.substring(5)} are not supported`);
    }
    if (structure !== undefined && structure["eipv:byteSize"] === undefined) {
        throw new Error(`${where}: an array of structures requires eipv:byteSize in the structure definition`);
    }
}

function validateStructure(structure: EipStructureDefinition): void {
    const name = structure["eipv:typeName"];
    if (typeof name !== "string" || name === "") {
        throw new Error("Structure definition requires a non-empty eipv:typeName");
    }
    const fields = structure["eipv:fields"];
    if (!Array.isArray(fields) || fields.length === 0) {
        throw new Error(`Structure ${name} requires a non-empty eipv:fields array`);
    }
    const byteSize = structure["eipv:byteSize"];
    if (byteSize !== undefined && (!isNonNegativeInteger(byteSize) || byteSize < 1)) {
        throw new Error(`Structure ${name}: eipv:byteSize must be an integer of at least 1`);
    }

    const seen = new Set<string>();
    for (const field of fields) {
        if (seen.has(field["eipv:name"])) {
            throw new Error(`Structure ${name} has duplicate field name '${field["eipv:name"]}'`);
        }
        seen.add(field["eipv:name"]);

        const where = `Field '${field["eipv:name"]}' of structure ${name}`;
        const type = field["eipv:type"];
        const nested = field["eipv:structureDefinition"];
        if ((type === undefined) === (nested === undefined)) {
            throw new Error(`${where}: exactly one of eipv:type and eipv:structureDefinition is required`);
        }
        if (type !== undefined && !EIP_PRIMITIVE_TYPES.includes(type)) {
            throw new Error(`${where}: unsupported eipv:type '${type}'`);
        }
        if (!isNonNegativeInteger(field["eipv:byteOffset"])) {
            throw new Error(`${where}: eipv:byteOffset must be a non-negative integer`);
        }
        const bitOffset = field["eipv:bitOffset"];
        if (type === "eipv:BOOL") {
            if (!isNonNegativeInteger(bitOffset) || bitOffset > 7) {
                throw new Error(`${where}: eipv:bitOffset from 0 to 7 is required for BOOL fields`);
            }
        } else if (bitOffset !== undefined) {
            throw new Error(`${where}: eipv:bitOffset is only allowed for BOOL fields`);
        }
        if (field["eipv:dimensions"] !== undefined) {
            validateDimensions(field["eipv:dimensions"], where);
            validateArrayElement(type, nested, where);
        }
        if (nested !== undefined) validateStructure(nested);
    }

    if (byteSize !== undefined && structureSize({ ...structure, "eipv:byteSize": undefined }) > byteSize) {
        throw new Error(`Structure ${name}: fields exceed the declared eipv:byteSize of ${byteSize}`);
    }
}

function normalizeOperations(op: string | string[] | undefined): string[] {
    const ops = typeof op === "string" ? [op] : op;
    if (ops === undefined || ops.length === 0) {
        throw new Error("EtherNet/IP form requires op");
    }
    for (const operation of ops) {
        if (!SUPPORTED_OPERATIONS.includes(operation)) {
            throw new Error(
                `Unsupported operation '${operation}', EtherNet/IP supports ${SUPPORTED_OPERATIONS.join(", ")}`
            );
        }
    }
    return ops;
}

function validateService(service: unknown, ops: string[]): void {
    if (service === undefined) return;
    if (typeof service !== "string" || !(EIP_SERVICES as readonly string[]).includes(service)) {
        throw new Error(`Unsupported eipv:service '${String(service)}'`);
    }
    if (service === "ExecutePCCC") {
        throw new Error("eipv:service ExecutePCCC is not supported: PCCC controller families are not implemented");
    }
    if (READ_SERVICES.includes(service) && ops.some((o) => o === "writeproperty")) {
        throw new Error(`eipv:service ${service} cannot be used with writeproperty`);
    }
    if (WRITE_SERVICES.includes(service) && ops.some((o) => o !== "writeproperty")) {
        throw new Error(`eipv:service ${service} can only be used with writeproperty`);
    }
}

/** Throws when a form violates the rules of the EtherNet/IP binding or uses features this client does not implement. */
export function validateEipForm(form: EipForm): void {
    const ops = normalizeOperations(form.op);
    validateService(form["eipv:service"], ops);

    const type = form["eipv:type"];
    const structure = form["eipv:structureDefinition"];
    if (type !== undefined && structure !== undefined) {
        throw new Error("A form must not carry both eipv:type and eipv:structureDefinition");
    }
    if (type === undefined && structure === undefined) {
        throw new Error("A form requires eipv:type or eipv:structureDefinition");
    }
    if (type !== undefined && !EIP_PRIMITIVE_TYPES.includes(type)) {
        throw new Error(`Unsupported eipv:type '${String(type)}'`);
    }
    if (structure !== undefined) validateStructure(structure);

    const dimensions = form["eipv:dimensions"];
    const elementCount = form["eipv:elementCount"];
    if (dimensions !== undefined) {
        const valid = validateDimensions(dimensions, "Form");
        validateArrayElement(type, structure, "Form");
        if (elementCount !== undefined) {
            const max = valid.reduce((a, b) => a * b, 1);
            if (!isNonNegativeInteger(elementCount) || elementCount < 1 || elementCount > max) {
                throw new Error(`eipv:elementCount must be an integer from 1 to ${max}`);
            }
        }
    } else if (elementCount !== undefined) {
        throw new Error("eipv:elementCount requires eipv:dimensions");
    }

    for (const term of ["eipv:scale", "eipv:offset"]) {
        if (form[term] !== undefined) {
            throw new Error(`${term} is not supported, use map:valueMapping with the mul and add operations`);
        }
    }

    for (const term of ["eipv:pollingTime", "eipv:timeout"] as const) {
        const value = form[term];
        if (value !== undefined && !isNonNegativeInteger(value)) {
            throw new Error(`${term} must be a non-negative integer`);
        }
    }
}
