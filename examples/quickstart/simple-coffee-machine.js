/********************************************************************************
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
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

// @ts-check

"use strict";

// This is an example Thing script which is a simple coffee machine.
// You can order coffee and see the status of the resources

const { Servient, Helpers } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");

// create Servient add HTTP binding with port configuration
const servient = new Servient();

// const staticAddress = "plugfest.thingweb.io";
const staticAddress = "localhost"; // use this for testing locally
const port = 8081;

servient.addServer(
    new HttpServer({
        port,
    })
);

Helpers.setStaticAddress(staticAddress);

let waterAmount = 1000;
let beansAmount = 1000;
let milkAmount = 1000;

/**
 * Function to promisify timeout since it does not return a promise
 *
 * @param {number} ms
 */
function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
servient.start().then((WoT) => {
    WoT.produce({
        title: "Coffee Machine",
        description: "A simple coffee machine that can be interacted over the Internet",
        support: "https://github.com/eclipse-thingweb/node-wot/",
        "@context": "https://www.w3.org/2022/wot/td/v1.1",
        properties: {
            resources: {
                readOnly: true,
                observable: true,
                type: "object",
                properties: {
                    water: {
                        type: "integer",
                        minimum: 0,
                        maximum: 1000,
                    },
                    beans: {
                        type: "integer",
                        minimum: 0,
                        maximum: 1000,
                    },
                    milk: {
                        type: "integer",
                        minimum: 0,
                        maximum: 1000,
                    },
                },
            },
        },
        actions: {
            brew: {
                synchronous: true,
                input: {
                    type: "string",
                    enum: ["espresso", "cappuccino", "americano"],
                },
            },
            refill: {
                synchronous: true,
                input: {
                    type: "array",
                    items: {
                        type: "string",
                        enum: ["water", "beans", "milk"],
                    },
                },
            },
        },
        events: {
            resourceEmpty: {
                data: {
                    type: "array",
                    items: {
                        type: "string",
                        enum: ["water", "beans", "milk"],
                    },
                },
            },
        },
    })
        .then((thing) => {
            console.log("Produced " + thing.getThingDescription().title);
            thing.setPropertyReadHandler("resources", async () => {
                return {
                    water: waterAmount,
                    beans: beansAmount,
                    milk: milkAmount,
                };
            });
            thing.setActionHandler("brew", async (params, options) => {
                const coffeeType = await params.value();
                console.info("received coffee order of ", coffeeType);
                if (coffeeType === "espresso") {
                    if (waterAmount <= 10 || beansAmount <= 10) {
                        throw new Error("Not enough water or beans");
                    } else {
                        await timeout(1000);
                        waterAmount = waterAmount - 10;
                        beansAmount = beansAmount - 10;
                        thing.emitPropertyChange("resources");
                        const resourceEvent = [];
                        if (waterAmount <= 10) {
                            resourceEvent.push("water");
                        }
                        if (beansAmount <= 10) {
                            resourceEvent.push("beans");
                        }
                        if (resourceEvent.length > 0) {
                            thing.emitEvent("resourceEmpty", resourceEvent);
                        }
                        return undefined;
                    }
                } else if (coffeeType === "cappuccino") {
                    if (waterAmount <= 20 || beansAmount <= 25 || milkAmount <= 15) {
                        throw new Error("Not enough water or beans");
                    } else {
                        await timeout(2000);
                        waterAmount = waterAmount - 15;
                        beansAmount = beansAmount - 20;
                        milkAmount = milkAmount - 10;
                        thing.emitPropertyChange("resources");
                        const resourceEvent = [];
                        if (waterAmount <= 10) {
                            resourceEvent.push("water");
                        }
                        if (beansAmount <= 10) {
                            resourceEvent.push("beans");
                        }
                        if (milkAmount <= 10) {
                            resourceEvent.push("milk");
                        }
                        if (resourceEvent.length > 0) {
                            thing.emitEvent("resourceEmpty", resourceEvent);
                        }
                        return undefined;
                    }
                } else if (coffeeType === "americano") {
                    if (waterAmount <= 35 || beansAmount <= 10) {
                        throw new Error("Not enough water or beans");
                    } else {
                        await timeout(2000);
                        waterAmount = waterAmount - 30;
                        beansAmount = beansAmount - 10;
                        thing.emitPropertyChange("resources");
                        const resourceEvent = [];
                        if (waterAmount <= 10) {
                            resourceEvent.push("water");
                        }
                        if (beansAmount <= 10) {
                            resourceEvent.push("beans");
                        }
                        if (resourceEvent.length > 0) {
                            thing.emitEvent("resourceEmpty", resourceEvent);
                        }
                        return undefined;
                    }
                } else {
                    throw new Error("Wrong coffee input");
                }
            });
            thing.setActionHandler("refill", async (params, options) => {
                const selectedResource = await params.value();
                console.info("received refill order of ", selectedResource);
                if (selectedResource.indexOf("water") !== -1) {
                    waterAmount = 1000;
                }
                if (selectedResource.indexOf("beans") !== -1) {
                    beansAmount = 1000;
                }
                if (selectedResource.indexOf("milk") !== -1) {
                    milkAmount = 1000;
                }
                thing.emitPropertyChange("resources");
                return undefined;
            });
            // expose the thing
            thing.expose().then(() => {
                console.info(thing.getThingDescription().title + " ready");
                console.info("TD available at http://" + staticAddress + ":" + port);
            });
        })
        .catch((e) => {
            console.log(e);
        });
});
