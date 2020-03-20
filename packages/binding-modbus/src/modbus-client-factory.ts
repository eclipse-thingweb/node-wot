/********************************************************************************
 * Copyright (c) 2018 Siemens AG
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

import { ProtocolClientFactory, ProtocolClient } from "@node-wot/core";
import ModbusClient from './modbus-client';

export default class ModbusClientFactory implements ProtocolClientFactory {
  public readonly scheme: string = "modbus+tcp";

  public getClient(): ProtocolClient {
    console.log(`ModbusClientFactory creating client for '${this.scheme}'`);
    return new ModbusClient();
  }
  public init = () => true;
  public destroy = () => true;
}
