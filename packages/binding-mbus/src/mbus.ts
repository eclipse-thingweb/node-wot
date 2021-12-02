/********************************************************************************
 * Copyright (c) 2021 Contributors to the Eclipse Foundation
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
export { default as MBusClientFactory } from "./mbus-client-factory";
export { default as MBusClient } from "./mbus-client";
export * from "./mbus-client";
export * from "./mbus-client-factory";

export class MBusForm extends Form {
    /**
     * Physical address of the unit connected to the bus.
     */
    public "mbus:unitID": number;
    /**
     * Defines the starting address of registers or coils that are
     * meant to be written.
     */
    public "mbus:offset"?: number;
    /**
     * Timeout in milliseconds of the modbus request. Default to 1000 milliseconds
     */
    public "mbus:timeout"?: number;
}
