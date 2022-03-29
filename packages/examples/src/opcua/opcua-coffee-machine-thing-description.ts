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

const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";
export const thingDescription: WoT.ThingDescription = {
    "@context": "https://www.w3.org/2019/wot/td/v1",
    "@type": ["Thing"],
    securityDefinitions: {
        nosec_sc: {
            scheme: "nosec",
        },
    },
    security: "nosec_sc",
    title: "servient",
    description: "node-wot CLI Servient",
    properties: {
        deviceHealth: {
            // type: "number",
            observable: true,
            readOnly: true,
            forms: [
                {
                    href: endpointUrl,
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": {
                        root: "i=84",
                        path: "/Objects/2:DeviceSet/2:DeviceHealth",
                    },
                },
            ],
        },
        waterTankLevel: {
            // type: "number",
            observable: true,
            readOnly: true,
            forms: [
                {
                    href: endpointUrl,
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": {
                        root: "i=84",
                        path: "/Objects/2:DeviceSet/1:CoffeeMachine/2:ParameterSet/9:WaterTankLevel",
                    },
                },
            ],
        },
        coffeeBeanLevel: {
            // type: "number",
            observable: true,
            readOnly: true,
            forms: [
                {
                    href: endpointUrl,
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": {
                        root: "i=84",
                        path: "/Objects/2:DeviceSet/1:CoffeeMachine/2:ParameterSet/9:CoffeeBeanLevel",
                    },
                },
            ],
        },
    },
    actions: {
        brewCoffee: {
            forms: [
                {
                    type: "object",
                    href: endpointUrl,
                    op: ["invokeaction"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/2:DeviceSet/1:CoffeeMachine" },
                    "opcua:method": { root: "i=84", path: "/Objects/2:DeviceSet/1:CoffeeMachine/2:MethodSet/9:Start" },
                },
            ],
            input: {
                type: "object",
                properties: {
                    CoffeeType: {
                        title: "1 for Americano, 2 for Expressp",
                        type: "number",
                    },
                },
                required: ["CoffeeType"],
            },
        },
        fillTank: {
            forms: [
                {
                    type: "object",
                    href: endpointUrl,
                    op: ["invokeaction"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/2:DeviceSet/1:CoffeeMachine" },
                    "opcua:method": {
                        root: "i=84",
                        path: "/Objects/2:DeviceSet/1:CoffeeMachine/2:MethodSet/9:FillTank",
                    },
                },
            ],
        },
    },
};
