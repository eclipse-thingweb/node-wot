/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
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

/**
 * Generic TD helper functions used across the code
 * These Helpers are used like this:
 * ```
 * import * as TDHelpers from './td-helpers';
 * ```
 */

import ThingDescription from "./thing-description";

// need two tests
export function findProtocol(td: ThingDescription): string {
    const base: string = td.base;
    const columnLoc: number = base.indexOf(":");
    return base.substring(0, columnLoc);
}

export function findPort(td: ThingDescription): number {
    const base: string = td.base;
    const columnLoc: number = base.indexOf(":", 6);
    const divLoc: number = base.indexOf("/", columnLoc);
    const returnString: string = base.substring(columnLoc + 1, divLoc);
    return parseInt(returnString);
}
