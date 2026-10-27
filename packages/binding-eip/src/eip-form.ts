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
import { Form } from "@node-wot/core";

export const EIP_PRIMITIVE_TYPES = [
    "eipv:BOOL",
    "eipv:SINT",
    "eipv:INT",
    "eipv:DINT",
    "eipv:LINT",
    "eipv:USINT",
    "eipv:UINT",
    "eipv:UDINT",
    "eipv:ULINT",
    "eipv:REAL",
    "eipv:LREAL",
    "eipv:BYTE",
    "eipv:WORD",
    "eipv:DWORD",
    "eipv:LWORD",
    "eipv:STRING",
] as const;

export type EipPrimitiveType = (typeof EIP_PRIMITIVE_TYPES)[number];

export const EIP_SERVICES = ["ReadTag", "ReadTagFragmented", "WriteTag", "WriteTagFragmented", "ExecutePCCC"] as const;

export type EipService = (typeof EIP_SERVICES)[number];

export interface EipFieldDefinition {
    "eipv:name": string;
    "eipv:type"?: EipPrimitiveType;
    "eipv:structureDefinition"?: EipStructureDefinition;
    "eipv:byteOffset": number;
    /** Bit position (0-7) of a BOOL field inside the byte at `eipv:byteOffset`. */
    "eipv:bitOffset"?: number;
    "eipv:dimensions"?: number[];
    description?: string;
}

export interface EipStructureDefinition {
    "eipv:typeName": string;
    "eipv:fields": EipFieldDefinition[];
    /** Size of one instance including trailing padding; the element stride of an array of structures. */
    "eipv:byteSize"?: number;
}

export class EipForm extends Form {
    public "eipv:type"?: EipPrimitiveType;
    public "eipv:structureDefinition"?: EipStructureDefinition;
    public "eipv:service"?: EipService;
    /** Polling interval in milliseconds for observeproperty. */
    public "eipv:pollingTime"?: number;
    /** Response timeout in milliseconds. */
    public "eipv:timeout"?: number;
    public "eipv:scale"?: number;
    public "eipv:offset"?: number;
    public "eipv:dimensions"?: number[];
    public "eipv:elementCount"?: number;
}
