/********************************************************************************
 * Copyright (c) 2025 Contributors to the Eclipse Foundation
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
import { createLoggers } from "@node-wot/core";
import * as logger from "debug";

export type LogLevel = keyof ReturnType<typeof createLoggers>;
export function setLogLevel(level: LogLevel): void {
    logger.disable();
    switch (level) {
        case "debug":
            logger.enable("node-wot:*");
            break;
        case "info":
            logger.enable("node-wot:**:error,node-wot:**:warn,node-wot:**:info");
            break;
        case "warn":
            logger.enable("node-wot:**:error,node-wot:**:warn");
            break;
        case "error":
            logger.enable("node-wot:**:error");
            break;
    }
}
