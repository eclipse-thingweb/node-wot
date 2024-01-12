/********************************************************************************
 * Copyright (c) 2018 Contributors to the Eclipse Foundation
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

import { ProtocolHelpers } from "@node-wot/core";
import { PropertyElement } from "wot-thing-description-types";

const observeOpFilter = ["observeproperty", "unobserveproperty"];
const readWriteOpFilter = ["readproperty", "writeproperty"];

function filterOpValues(opValues: string[], filterValues: string[]) {
    return opValues.filter((opValue) => filterValues.includes(opValue));
}

/**
 * Convenience function to filter out the `op` values "observeproperty" and
 * "unobserveproperty" from a string array.
 *
 * @param opValues The `op` values to be filtered.
 * @returns A filtered array that might be empty.
 */
export function filterPropertyObserveOperations(opValues: string[]) {
    return filterOpValues(opValues, observeOpFilter);
}

/**
 * Convenience function to filter out the `op` values "readproperty" and
 * "writeproperty" from a string array.
 *
 * @param opValues The `op` values to be filtered.
 * @returns A filtered array that might be empty.
 */
function filterPropertyReadWriteOperations(opValues: string[]) {
    return filterOpValues(opValues, readWriteOpFilter);
}

/**
 * Function to (potentially) generate two arrays of `op` values: One with the
 * values "readproperty" and "writeproperty", and one with
 * "observerproperty" and "unobserveproperty".
 *
 * This CoAP-specific distinction is made to be able to generate
 * separate forms for the observe-related operations, where the addition
 * of a `subprotocol` field with a value of `cov:observe` has to be added.
 *
 * @param property The property for which the forms are going to be
 *                 generated.
 * @returns A tuple consisting of two op value arrays (one for read and
 *          write operations, one for observe-related operations).
 */
export function getPropertyOpValues(property: PropertyElement) {
    const opValues = ProtocolHelpers.getPropertyOpValues(property);

    const readWriteOpValues = filterPropertyReadWriteOperations(opValues);
    const observeOpValues = filterPropertyObserveOperations(opValues);

    return [readWriteOpValues, observeOpValues];
}
