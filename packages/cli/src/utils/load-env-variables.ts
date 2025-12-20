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
import * as dotenv from "dotenv";
import ErrnoException = NodeJS.ErrnoException;

export function loadEnvVariables(prefix: string = "WOT_SERVIENT_"): { [key: string]: string } {
    const env: dotenv.DotenvConfigOutput = dotenv.config();
    const errornoException: ErrnoException | undefined = env.error;
    // ignore file not found but throw otherwise
    if (errornoException != null && errornoException.code !== "ENOENT") {
        throw env.error;
    }

    // Filter out not node-wot related variables
    return Object.keys(process.env)
        .filter((key) => key.startsWith(prefix))
        .reduce((obj: { [key: string]: string }, key: string) => {
            const shortKey = key.substring(prefix.length);
            obj[shortKey] = process.env[key] as string;
            return obj;
        }, {});
}
