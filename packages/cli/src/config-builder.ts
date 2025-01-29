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
import * as fs from "fs";
import _ from "lodash";
import { DotenvParseOutput } from "dotenv";

export async function buildConfig(
    options: Record<string, unknown>,
    defaultFile: string,
    dotEnvConfigParameters: DotenvParseOutput
): Promise<Record<string, unknown>> {
    let fileToOpen = defaultFile;

    if (typeof options.configFile === "string") {
        fileToOpen = options.configFile;
    }

    let configFileData = JSON.parse(await fs.promises.readFile(fileToOpen, "utf-8"));

    for (const [key, value] of Object.entries(dotEnvConfigParameters)) {
        const obj = _.set({}, key, value);
        configFileData = _.merge(configFileData, obj);
    }

    if (options?.configParams != null) {
        configFileData = _.merge(configFileData, options.configParams);
    }

    return configFileData;
}
