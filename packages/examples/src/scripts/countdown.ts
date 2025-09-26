/********************************************************************************
 * Copyright (c) 2021 Contributors to the Eclipse Foundation
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
/* eslint  no-console: "off" */

function uuidv4(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

enum Status {
    "pending",
    "running",
    "completed",
    "failed",
}

interface ActionStatus {
    status: Status;
    output?: number; // any
    error?: Error;
    href?: string;
}

let countdowns: Map<string, ActionStatus>;

WoT.produce({
    title: "countdown",
    description: "Countdown example Thing",
    support: "https://github.com/eclipse-thingweb/node-wot/",
    properties: {
        countdowns: {
            type: "array",
            items: {
                type: "string",
            },
            observable: true,
            readOnly: true,
        },
    },
    actions: {
        startCountdown: {
            description: "Start countdown in secs (default 100 secs)",
            input: {
                // optional init value
                /* type: "integer" */
                oneOf: [{ type: "integer" }, {}],
            },
        },
        stopCountdown: {
            // SHOULD BE DELETE for WoT-Profile
            description: "Stops countdown",
            input: {
                type: "string",
            },
        },
        monitorCountdown: {
            // SHOULD BE GET for WoT-Profile
            description: "Reports current countdown status/value",
            input: {
                type: "string",
            },
            output: {
                type: "object",
            },
        },
    },
})
    .then((thing) => {
        console.log("Produced " + thing.getThingDescription().title);

        // init property values and start update loop
        countdowns = new Map<string, ActionStatus>();
        setInterval(() => {
            if (countdowns.size > 0) {
                console.log("Update countdowns");
                const listToDelete: string[] = [];
                for (const id of countdowns.keys()) {
                    const as = countdowns.get(id);
                    if (as?.output !== undefined) {
                        const prev = as.output;
                        as.output--;
                        console.log("\t" + id + ", from " + prev + " to " + as.output);

                        if (as.output > 0) {
                            as.status = Status.running;
                        } else {
                            as.status = Status.completed;
                        }

                        if (as.output < -10) {
                            // remove from list after a while
                            listToDelete.push(id);
                        }
                    }
                }
                listToDelete.forEach((id) => {
                    console.log("Remove countdown for href = " + id);
                    countdowns.delete(id);
                });
            }
        }, 1000);

        // set property handlers (using async-await)
        thing.setPropertyReadHandler("countdowns", async (options): Promise<WoT.InteractionInput> => {
            const cts: string[] = [];
            for (const id of countdowns.keys()) {
                cts.push(id);
            }
            return cts;
        });
        // set action handlers (using async-await)
        thing.setActionHandler(
            "startCountdown",
            async (params: WoT.InteractionOutput, options): Promise<WoT.InteractionInput> => {
                let initValue = 100;
                if (params != null) {
                    const value = await params.value();
                    if (typeof value === "number") {
                        initValue = value as number;
                    }
                }
                const resp: ActionStatus = {
                    href: uuidv4(),
                    output: initValue,
                    status: initValue > 0 ? Status.pending : Status.completed,
                };
                const ii: WoT.InteractionInput = resp;
                console.log("init countdown value = " + JSON.stringify(resp));
                countdowns.set(resp.href ?? "", resp);
                return ii;
            }
        );
        thing.setActionHandler(
            "stopCountdown",
            async (params: WoT.InteractionOutput, options): Promise<WoT.InteractionInput> => {
                if (params != null) {
                    const value = await params.value();
                    if (typeof value === "string" && countdowns.has(value)) {
                        const as = countdowns.get(value);
                        if (as !== undefined) {
                            as.output = 0;
                            as.status = Status.completed;
                            console.log("Countdown stopped for href: " + value);
                            return null;
                        } else {
                            throw Error("Countdown value is undefined for href, " + value);
                        }
                    } else {
                        throw Error("Input provided for stopCountdown is no string or invalid href, " + value);
                    }
                } else {
                    throw Error("No input specified for stopCountdown");
                }
            }
        );
        thing.setActionHandler(
            "monitorCountdown",
            async (params: WoT.InteractionOutput, options): Promise<WoT.InteractionInput> => {
                if (params != null) {
                    const value = await params.value();
                    if (typeof value === "string" && countdowns.has(value)) {
                        const as = countdowns.get(value);
                        return JSON.stringify(as);
                    } else {
                        throw Error("Input provided for monitorCountdown is no string or invalid href, " + value);
                    }
                } else {
                    throw Error("No input specified for monitorCountdown");
                }
            }
        );

        // expose the thing
        thing.expose().then(() => {
            console.info(thing.getThingDescription().title + " ready");
        });
    })
    .catch((e) => {
        console.log(e);
    });
