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
}

/**
 * Different modbus function names as defined in
 * https://en.wikipedia.org/wiki/Modbus.
 */
export type ModbusFunctionName =
    | "readCoil"
    | "readDiscreteInput"
    | "readHoldingRegisters"
    | "writeSingleCoil"
    | "writeSingleHoldingRegister"
    | "writeMultipleCoils"
    | "writeMultipleHoldingRegisters";

export class ModbusForm extends Form {
    /**
     * The modbus function issued in the request.
     */
    public "modbus:function"?: ModbusFunction | ModbusFunctionName;
    /**
     * Describe the entity type of the request. This property can be
     * used instead of 'modbus:fuction' when the form has multiple op. For
     * example if op = ['readProperty','writeProperty'] and 'modbus:function
     * is 'Coil', the low level modbus function will be mapped to 1 when
     * reading and to 5 when writing.
     */
    public "modbus:entity"?: ModbusEntity;
    /**
     * Physical address of the unit connected to the bus.
     */
    public "modbus:unitID": number;
    /**
     * Defines the starting address of registers or coils that are
     * meant to be written.
     */
    public "modbus:address"?: number;
    /**
     * Defines the total amount of registers or coils that
     * should be written, beginning with the register specified
     * with the property 'modbus:address'.
     */
    public "modbus:quantity"?: number;
    /**
     * Timeout in milliseconds of the modbus request. Default to 1000 milliseconds
     */
    public "modbus:timeout"?: number;
    /**
     * Used for subscriptions. The client will issue a reading
     * command every modbus:pollingTime milliseconds. Note that
     * the reading request timeout can be still controlled using
     * modbus:timeout property.
     */
    public "modbus:pollingTime"?: number;
}

export enum ModbusEndianness {
    BIG_ENDIAN = "BIG_ENDIAN",
    LITTLE_ENDIAN = "LITTLE_ENDIAN",
    BIG_ENDIAN_BYTE_SWAP = "BIG_ENDIAN_BYTE_SWAP",
    LITTLE_ENDIAN_BYTE_SWAP = "LITTLE_ENDIAN_BYTE_SWAP",
}
