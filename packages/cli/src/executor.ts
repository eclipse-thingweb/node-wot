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

import { createLoggers, Helpers } from "@node-wot/core";
const { debug } = createLoggers("cli", "executor");

export interface WoTContext {
    runtime: typeof WoT;
    helpers: Helpers;
}

export class Executor {
    public async exec(file: string, wotContext: WoTContext): Promise<unknown> {
        debug(`Executing WoT script from file: ${file}`);
        const userScriptPathArg = file;
        const isTypeScriptScript =
            userScriptPathArg && (userScriptPathArg.endsWith(".ts") || userScriptPathArg.endsWith(".tsx"));
        global.WoT = wotContext.runtime;

        if (isTypeScriptScript === true) {
            require("ts-node/register");
        }

        try {
            // Execute the user's script
            // Node.js will now handle .ts files automatically if ts-node is registered
            // TODO: For ESM modules a more complex check might be needed.
            if (file.endsWith(".mjs")) {
                return await import(`file:///${file}`);
            } else {
                return require(file);
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error("Error running WoT script:", error);
            process.exit(1);
        }
    }
}
