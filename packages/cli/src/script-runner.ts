/********************************************************************************
 * Copyright (c) 2026 Contributors to the Eclipse Foundation
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
import inspector from "inspector";
import path from "path";
import { readFile } from "fs/promises";
import { Executor, WoTContext } from "./executor";

const { error, info, warn } = createLoggers("cli", "cli", "script-runner");

export interface DebugParams {
    shouldBreak: boolean;
    host: string;
    port: number;
}
export async function runScripts(context: WoTContext, scripts: string[], debug?: DebugParams) {
    const executor = new Executor();
    const launchScripts = (scripts: Array<string>) => {
        scripts.forEach(async (fname: string) => {
            info(`node-wot reading script ${fname}`);
            try {
                const data = await readFile(fname, "utf-8");
                // limit printout to first line
                info(
                    `node-wot running script '${data.substr(0, data.indexOf("\n")).replace("\r", "")}'... (${
                        data.split(/\r\n|\r|\n/).length
                    } lines)`
                );

                fname = path.resolve(fname);
                await executor.exec(fname, context);
            } catch (err) {
                error(`node-wot experienced error while reading script. %O`, err);
            }
        });
    };

    if (debug && debug.shouldBreak) {
        // Activate inspector only if is not already opened and wait for the debugger to attach
        inspector.url() == null && inspector.open(debug.port, debug.host, true);

        // Set a breakpoint at the first line of of first script
        // the breakpoint gives time to inspector clients to set their breakpoints
        const session = new inspector.Session();
        session.connect();
        session.post("Debugger.enable", (error: Error) => {
            if (error != null) {
                warn("Cannot set breakpoint; reason: cannot enable debugger");
                warn(error.toString());
            }

            session.post(
                "Debugger.setBreakpointByUrl",
                {
                    lineNumber: 0,
                    url: "file:///" + path.resolve(scripts[0]).replace(/\\/g, "/"),
                },
                (err: Error | null) => {
                    if (err != null) {
                        warn("Cannot set breakpoint");
                        warn(error.toString());
                    }
                    launchScripts(scripts);
                }
            );
        });
    } else {
        // Activate inspector only if is not already opened and don't wait
        debug != null && inspector.url() == null && inspector.open(debug.port, debug.host, false);
        launchScripts(scripts);
    }
}
