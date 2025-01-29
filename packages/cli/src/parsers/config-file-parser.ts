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

import { ErrorObject, ValidateFunction } from "ajv";
import { InvalidArgumentError } from "commander";
import { readFileSync } from "fs";

export function parseConfigFile(filename: string, previous: unknown, validator: ValidateFunction<unknown>) {
    try {
        const open = filename;
        const data = readFileSync(open, "utf-8");
        if (!validator(JSON.parse(data))) {
            throw new InvalidArgumentError(
                `Config file contains invalid an JSON: ${(validator.errors ?? [])
                    .map((o: ErrorObject) => o.message)
                    .join("\n")}`
            );
        }
        return filename;
    } catch (err) {
        throw new InvalidArgumentError(`Error reading config file: ${err}`);
    }
}
