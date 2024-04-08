/********************************************************************************
 * Copyright (c) 2020 Contributors to the Eclipse Foundation
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
import { Form } from "@node-wot/td-tools";
export { default as ModbusClientFactory } from "./modbus-client-factory";
export { default as ModbusClient } from "./modbus-client";
export * from "./modbus-client";
export * from "./modbus-client-factory";

export type ModbusEntity = "Coil" | "InputRegister" | "HoldingRegister" | "DiscreteInput";

export enum ModbusFunction {
    "readCoil" = 1,
    "readDiscreteInput" = 2,
    "readHoldingRegisters" = 3,
    "readInputRegister" = 4,
    "writeSingleCoil" = 5,
    "writeSingleHoldingRegister" = 6,
    "writeMultipleCoils" = 15,
    "writeMultipleHoldingRegisters" = 16,
    "readDeviceIdentification" = 43,
}

/**
 * Different modbus function names as defined in
 * https://w3c.github.io/wot-binding-templates/bindings/protocols/modbus/#function.
 */
export type ModbusFunctionName =
    | "readCoil"
    | "readDiscreteInput"
    | "readHoldingRegisters"
    | "writeSingleCoil"
    | "writeSingleHoldingRegister"
    | "writeMultipleCoils"
    | "writeMultipleHoldingRegisters"
    | "readDeviceIdentification";

export class ModbusForm extends Form {
    /**
     * The modbus function issued in the request.
     */
    public "modv:function"?: ModbusFunction | ModbusFunctionName;
    /**
     * Describe the entity type of the request. This property can be
     * used instead of 'modv:function' when the form has multiple op. For
     * example if op = ['readProperty','writeProperty'] and 'modv:function
     * is 'Coil', the low level modbus function will be mapped to 1 when
     * reading and to 5 when writing.
     */
    public "modv:entity"?: ModbusEntity;
    /**
     * Physical address of the unit connected to the bus.
     */
    public "modv:unitID"?: number;
    /**
     * Defines the starting address of registers or coils that are
     * meant to be written.
     */
    public "modv:address"?: number;
    /**
     * Defines the total amount of registers or coils that
     * should be written, beginning with the register specified
     * with the property 'modbus:address'.
     */
    public "modv:quantity"?: number;
    /**
     * Maximum polling rate that this implementation uses for subscriptions.
     * The client will issue a reading
     * command every modv:pollingTime milliseconds. Note that
     * the reading request timeout can be still controlled using
     * modv:timeout property.
     */
    public "modv:pollingTime"?: number;
    /**
     * When true, it describes that the byte order of the data in the Modbus message is the most significant byte first (i.e., Big-Endian). When false, it describes the least significant byte first (i.e., Little-Endian).
     */
    public "modv:mostSignificantByte"?: boolean;
    /**
     * When true, it describes that the word order of the data in the Modbus message is the most significant word first (i.e., no word swapping). When false, it describes the least significant word first (i.e. word swapping)
     */
    public "modv:mostSignificantWord"?: boolean;
    /**
     * Modbus implementations can differ in the way addressing works, as the first coil/register can be either referred to as true or false.
     */
    public "modv:zeroBasedAddressing"?: boolean;

    /**
     * Timeout in milliseconds of the modbus request. Default to 1000 milliseconds
     */
    public "modv:timeout"?: number;
    /**
     * Specifies the data type contained in the request or response payload. Users can define the specific data type using a sub type of xsd:decimal.
     */
    public "modv:type"?: ModbusDataType;
}

export type ModbusDataType =
    | "xsd:integer"
    | "xsd:boolean"
    | "xsd:string"
    | "xsd:float"
    | "xsd:decimal"
    | "xsd:byte"
    | "xsd:short"
    | "xsd:int"
    | "xsd:long"
    | "xsd:unsignedbyte"
    | "xsd:unsignedshort"
    | "xsd:unsignedint"
    | "xsd:unsignedlong"
    | "xsd:double"
    | "xsd:hexBinary";
