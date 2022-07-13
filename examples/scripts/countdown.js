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

function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
var Status;
(function (Status) {
    Status[(Status["pending"] = 0)] = "pending";
    Status[(Status["running"] = 1)] = "running";
    Status[(Status["completed"] = 2)] = "completed";
    Status[(Status["failed"] = 3)] = "failed";
})(Status || (Status = {}));
let countdowns;
WoT.produce({
    title: "countdown",
    description: "Countdown example Thing",
    support: "https://github.com/eclipse/thingweb.node-wot/",
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
        countdowns = new Map();
        setInterval(() => {
            if (countdowns.size > 0) {
                console.log("Update countdowns");
                const listToDelete = [];
                for (const id of countdowns.keys()) {
                    const as = countdowns.get(id);
                    if (as.output !== undefined) {
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
        thing.setPropertyReadHandler("countdowns", async (options) => {
            const cts = [];
            for (const id of countdowns.keys()) {
                cts.push(id);
            }
            return cts;
        });
        // set action handlers (using async-await)
        thing.setActionHandler("startCountdown", async (params, options) => {
            let initValue = 100;
            if (params) {
                const value = await params.value();
                if (typeof value === "number") {
                    initValue = value;
                }
            }
            const resp = {
                href: uuidv4(),
                output: initValue,
                status: initValue > 0 ? Status.pending : Status.completed,
            };
            const ii = resp;
            console.log("init countdown value = " + JSON.stringify(resp));
            countdowns.set(resp.href, resp);
            return ii;
        });
        thing.setActionHandler("stopCountdown", async (params, options) => {
            if (params) {
                const value = await params.value();
                if (typeof value === "string" && countdowns.has(value)) {
                    const as = countdowns.get(value);
                    as.output = 0;
                    as.status = Status.completed;
                    console.log("Countdown stopped for href: " + value);
                    return undefined;
                } else {
                    throw Error("Input provided for stopCountdown is no string or invalid href, " + value);
                }
            } else {
                throw Error("No input specified for stopCountdown");
            }
        });
        thing.setActionHandler("monitorCountdown", async (params, options) => {
            if (params) {
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
        });
        // expose the thing
        thing.expose().then(() => {
            console.info(thing.getThingDescription().title + " ready");
        });
    })
    .catch((e) => {
        console.log(e);
    });
