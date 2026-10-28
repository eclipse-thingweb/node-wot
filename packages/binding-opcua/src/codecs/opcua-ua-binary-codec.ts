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

import { ContentCodec, DataSchema } from "@node-wot/core";
import { DataSchemaValue } from "wot-typescript-definitions";
import { DataValue } from "node-opcua-data-value";
import { DataType } from "node-opcua-variant";

import { OPCUA_UABINARY, OPCUAView, builtInVariantOf, encodeDataValue, viewFormat } from "../opcua-content-negotiation";
import {
    decodeUABinaryDataValue,
    encodeUABinaryDataValue,
    findConnectionContext,
    variantToArguments,
} from "../ua-binary";

const VIEWS: Record<string, OPCUAView> = { value: "value", variant: "variant", datavalue: "dataValue" };

/** The view a `type` parameter asks for; the negotiation has already refused any other value. */
function viewOf(parameters?: { [key: string]: string }): OPCUAView {
    return VIEWS[(parameters?.type ?? "Value").toLowerCase()] ?? "value";
}

/** The OPC UA JSON rendering of a DataValue for a view: the value, the Variant or the DataValue. */
function render(dataValue: DataValue, view: OPCUAView, namespaceArray: string[] = []): DataSchemaValue {
    const shown = view === "dataValue" ? dataValue : new DataValue({ value: dataValue.value });
    const { body } = encodeDataValue(viewFormat(view), shown, `an ${OPCUA_UABINARY} payload`, namespaceArray);
    return JSON.parse(body.toString("utf-8"));
}

/**
 * `application/opcua+uabinary`, the media type of OPC UA forms (OPC 10000-6 Table 80, planned for
 * WoT OPC UA Binding 1.1): the payload is an OPC UA Binary DataValue. Its `type` parameter picks
 * what `value()` returns, as OPC UA JSON:
 * - `Value` (the default): the decoded value, `299.26`;
 * - `Variant`: the value and its OPC UA type, `{"UaType":11,"Value":299.26}`;
 * - `DataValue`: the Variant plus Status, SourceTimestamp and ServerTimestamp.
 *
 * Parameters the binding adds to the Content type, never to the form:
 * - `uaconn=<id>`: the session whose namespace table and structure definitions decode the
 *   payload, as the binding would;
 * - `uapart=arguments`: the payload holds action arguments as `KeyValuePair[]`.
 */
export class OpcuaUABinaryCodec implements ContentCodec {
    getMediaType(): string {
        return OPCUA_UABINARY;
    }

    bytesToValue(bytes: Buffer, _schema?: DataSchema, parameters?: { [key: string]: string }): DataSchemaValue {
        const context = findConnectionContext(parameters?.uaconn);
        const dataValue = decodeUABinaryDataValue(bytes, context?.dataTypeManager);
        if (parameters?.uapart !== "arguments") {
            return render(dataValue, viewOf(parameters), context?.namespaceArray);
        }
        const args = variantToArguments(dataValue.value);
        if (args === undefined) {
            throw new Error(
                `binding-opcua: an action output with contentType '${OPCUA_UABINARY}' must hold KeyValuePair[], ` +
                    `but it holds ${DataType[dataValue.value.dataType]}.`
            );
        }
        // an argument is a Variant: no status, no timestamps, so the DataValue view shows it as
        // the Variant view does
        const argumentView: OPCUAView = viewOf(parameters) === "value" ? "value" : "variant";
        const output: Record<string, DataSchemaValue> = {};
        for (const [name, variant] of args) {
            output[name] = render(new DataValue({ value: variant }), argumentView, context?.namespaceArray);
        }
        return output;
    }

    /**
     * A value of built-in types becomes a DataValue holding only the value. Anything
     * else needs the server to be encoded, so it is handed over to the binding as JSON: a
     * structure or an action input, and a Variant or DataValue view, whose
     * NodeIds only the session's namespace table can map.
     */
    valueToBytes(value: unknown, _schema?: DataSchema, parameters?: { [key: string]: string }): Buffer {
        const variant = viewOf(parameters) === "value" ? builtInVariantOf(value) : undefined;
        if (variant !== undefined) {
            return encodeUABinaryDataValue(new DataValue({ value: variant }));
        }
        return Buffer.from(JSON.stringify(value ?? null), "utf-8");
    }
}

export const theOpcuaUABinaryCodec = new OpcuaUABinaryCodec();
