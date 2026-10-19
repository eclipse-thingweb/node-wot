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
// `application/octet-stream` on opc.tcp forms: the payload is an OPC UA Binary DataValue
// (OPC 10000-6 §5.2). Shared by the codec, which runs in core, and by the binding.
// See doc/octet-stream-ua-binary-plan.md.
//

import { BinaryStream } from "node-opcua-binary-stream";
import { DataValue } from "node-opcua-data-value";
import { QualifiedName } from "node-opcua-data-model";
import { OpaqueStructure } from "node-opcua-extension-object";
import { KeyValuePair } from "node-opcua-types";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import type { ExtraDataTypeManager } from "node-opcua-client";

export function encodeUABinaryDataValue(dataValue: DataValue): Buffer {
    const stream = new BinaryStream(dataValue.binaryStoreSize());
    dataValue.encode(stream);
    return stream.buffer;
}

/**
 * A DataValue encoding mask only uses its six low bits, so a UA Binary DataValue never
 * starts with a byte that has 0x40 or 0x80 set. The JSON the codec hands over for values
 * it cannot encode starts with `{`, `[` or `n` (null), which all have 0x40 set.
 */
export function isUABinaryDataValue(bytes: Buffer): boolean {
    return bytes.length > 0 && (bytes[0] & 0xc0) === 0;
}

/**
 * The structure definitions of each session that produced an `octet-stream` payload, so
 * that the codec, which runs in core and has no session, can decode a structure from a
 * companion specification. The binding names the entry in the Content type, `;uaconn=<id>`.
 */
const dataTypeManagers = new Map<string, ExtraDataTypeManager>();
const dataTypeManagerIds = new WeakMap<ExtraDataTypeManager, string>();
let nextDataTypeManagerId = 1;

export function registerDataTypeManager(manager: ExtraDataTypeManager): string {
    let id = dataTypeManagerIds.get(manager);
    if (id === undefined) {
        id = `${nextDataTypeManagerId++}`;
        dataTypeManagerIds.set(manager, id);
    }
    dataTypeManagers.set(id, manager);
    return id;
}

export function unregisterDataTypeManager(manager: ExtraDataTypeManager): void {
    const id = dataTypeManagerIds.get(manager);
    if (id !== undefined) {
        dataTypeManagers.delete(id);
    }
}

export function findDataTypeManager(id: string | undefined): ExtraDataTypeManager | undefined {
    return id === undefined ? undefined : dataTypeManagers.get(id);
}

/** Decode in place the structures of `variant` that the standard types left opaque. */
function promoteVariant(variant: Variant | undefined, manager: ExtraDataTypeManager | undefined): void {
    if (variant?.dataType !== DataType.ExtensionObject || variant.value == null) {
        return;
    }
    const promote = (value: unknown): unknown => {
        if (value instanceof KeyValuePair) {
            // action arguments: the structure is in the value of the pair
            promoteVariant(value.value, manager);
            return value;
        }
        if (!(value instanceof OpaqueStructure) || manager === undefined) {
            return value;
        }
        try {
            // the session that read the value has already loaded this constructor
            const Constructor = manager.getExtensionObjectConstructorFromBinaryEncoding(value.nodeId);
            const object = new Constructor();
            object.decode(new BinaryStream(value.buffer));
            return object;
        } catch {
            // not loaded: keep it opaque, as the application/json path would
            return value;
        }
    };
    variant.value =
        variant.arrayType === VariantArrayType.Scalar
            ? promote(variant.value)
            : (variant.value as unknown[]).map(promote);
}

/**
 * Decode a UA Binary DataValue. A structure that the standard types do not cover is
 * decoded with the definitions of `manager`, when given; otherwise it stays opaque.
 */
export function decodeUABinaryDataValue(bytes: Buffer, manager?: ExtraDataTypeManager): DataValue {
    const dataValue = new DataValue();
    dataValue.decode(new BinaryStream(bytes));
    promoteVariant(dataValue.value, manager);
    return dataValue;
}

/** true when the variant holds a structure, which needs the session's definitions */
export function holdsStructure(variant: Variant | undefined): boolean {
    return variant?.dataType === DataType.ExtensionObject;
}

/**
 * Action arguments as a Variant holding `KeyValuePair[]`: the argument names are kept, as a
 * WoT action input is one object keyed by them (plan A1). The Call service itself carries
 * a `Variant[]` matched by position; the binding converts between the two.
 */
export function argumentsToVariant(args: [name: string, value: Variant][]): Variant {
    return new Variant({
        dataType: DataType.ExtensionObject,
        arrayType: VariantArrayType.Array,
        value: args.map(([name, value]) => new KeyValuePair({ key: new QualifiedName({ name }), value })),
    });
}

/** The arguments held by a `KeyValuePair[]` Variant, or undefined if it holds something else. */
export function variantToArguments(variant: Variant | undefined): Map<string, Variant> | undefined {
    if (variant?.dataType !== DataType.ExtensionObject || variant.arrayType !== VariantArrayType.Array) {
        return undefined;
    }
    const pairs = variant.value as unknown[];
    if (!pairs.every((p) => p instanceof KeyValuePair)) {
        return undefined;
    }
    return new Map((pairs as KeyValuePair[]).map((p) => [p.key.name ?? "", p.value]));
}
