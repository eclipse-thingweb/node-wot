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

// This is an example Thing script which is a simple coffee machine.
// You can order coffee and see the status of the resources

import { Servient } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";

// create Servient add HTTP binding with port configuration
const servient = new Servient();
servient.addServer(
    new HttpServer({
        port: 8081,
    })
);

let waterAmount = 100
let beansAmount = 100;
let milkAmount = 100;

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
                        minimum: 10,
                        maximum: 100,
                        unit: "%",
                    },
                    beans: {
                        type: "integer",
                        minimum: 0,
                        maximum: 100,
                        unit: "%",
                    },
                    milk: {
                        type: "integer",
                        minimum: 0,
                        maximum: 100,
                        unit: "%",
                    },
                },
            },
        },
        actions: {
            brew: {
                input:{
                    type:"string",
                    enum: ["espresso","cappuccino","americano"]
                }
            },
        },
    })
        .then((thing) => {
            console.log("Produced " + thing.getThingDescription().title);

            thing.setPropertyReadHandler("resources", async () => {
                return{
                    water: waterAmount,
                    beans: beansAmount,
                    milk: milkAmount,
                };
            });

            // thing.setActionHandler("brew", async (params,options) =>{
            //     const coffeeType = await params.value();
            //     console.info("received coffee order of ", coffeeType)
            //     if(coffeeType==="espresso"){
            //         if (waterAmount <= 10 || beansAmount <= 10) {
            //             // Promise.reject("Not enough water");
            //         } else {
            //             setTimeout(() => {
            //                 waterAmount = waterAmount-10;
            //                 beansAmount = beansAmount-10;
            //                 Promise.resolve();
            //             },1000)
            //         }
            //     } else if(coffeeType==="cappuccino"){
            //         if (waterAmount <= 20 || beansAmount <= 25 || milkAmount <= 15) {
            //             // Promise.reject("Not enough water");
            //         } else {
            //             setTimeout(() => {
            //                 waterAmount = waterAmount - 15;
            //                 beansAmount = beansAmount - 20;
            //                 milkAmount = milkAmount - 10;
            //             }, 2000);
            //             Promise.resolve();
            //         }
            //     } else if(coffeeType==="americano"){
            //         if (waterAmount <= 35 || beansAmount <= 10) {
            //             // Promise.reject("Not enough water");
            //         } else {
            //             setTimeout(() => {
            //                 waterAmount = waterAmount - 30;
            //                 beansAmount = beansAmount - 10;
            //             }, 2000);
            //             Promise.resolve();
            //             // return 0;
            //         }
            //     } else {
            //         // Promise.reject("Wrong coffee");
            //     }
            // })

            // expose the thing
            thing.expose().then(() => {
                console.info(thing.getThingDescription().title + " ready");
            });
        })
        .catch((e) => {
            console.log(e);
        });
});
