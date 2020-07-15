/********************************************************************************
 * Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
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

// global W3C WoT Scripting API definitions
import * as WoT from "wot-typescript-definitions";
// node-wot implementation of W3C WoT Servient 
import { Servient, Helpers, ExposedThing } from "@node-wot/core";

import { ModbusClientFactory } from "../src/modbus";

export default class DefaultServient extends Servient {

    public constructor() {
        super();
        this.addClientFactory(new ModbusClientFactory());
    }

    /**
     * start
     */
    public start(): Promise<WoT.WoT> {
        return new Promise<WoT.WoT>((resolve, reject) => {
            return super.start()
        });
    }
}
