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
const coffeeMachine = "1:CoffeeMachineA";

export const thingDescription: WoT.ThingDescription = {
    "@context": [
        "https://www.w3.org/2019/wot/td/v1",
        {
            uav: "http://opcfoundation.org/UA/WoT-Binding/",
            "1": "http://example.namespace.com/demo/pump",
            "2": "http://opcfoundation.org/UA/DI/",
            "7": "http://opcfoundation.org/UA/CommercialKitchenEquipment/",
            "17": "http://sterfive.com/UA/CoffeeMachine/",
        },
    ],
    "@type": ["Thing"],
    base: endpointUrl,
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
            observable: true,
            readOnly: true,
            forms: [
                {
                    href: "/",
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": {
                        root: "i=84",
                        path: "/Objects/2:DeviceSet/2:DeviceHealth",
                    },
                },
            ],
        },
        waterTankLevel: {
            observable: true,
            readOnly: true,
            forms: [
                {
                    href: "/",
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": {
                        root: "i=84",
                        path: `/Objects/2:DeviceSet/${coffeeMachine}/7:Parameters/17:WaterTankLevel`,
                    },
                },
            ],
            type: "number",
        },
        coffeeBeanLevel: {
            observable: true,
            readOnly: true,
            forms: [
                {
                    href: "/",
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": {
                        root: "i=84",
                        path: `/Objects/2:DeviceSet/${coffeeMachine}/7:Parameters/17:CoffeeBeanLevel`,
                    },
                },
            ],
            type: "number",
        },
        temperature: {
            observable: true,
            readOnly: true,
            forms: [
                {
                    href: "/",
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": {
                        root: "i=84",
                        path: `/Objects/2:DeviceSet/${coffeeMachine}/7:Parameters/7:BoilerTempWater`,
                    },
                },
            ],
            type: "number",
        },
        currentState: {
            observable: true,
            readOnly: true,
            forms: [
                {
                    href: "/",
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": {
                        root: "i=84",
                        path: `/Objects/2:DeviceSet/${coffeeMachine}/7:Parameters/7:CurrentState`,
                    },
                },
            ],
            type: "number",
        },
        grinderStatus: {
            observable: true,
            readOnly: true,
            forms: [
                {
                    href: "/",
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": {
                        root: "i=84",
                        path: `/Objects/2:DeviceSet/${coffeeMachine}/7:Parameters/17:GrinderStatus`,
                    },
                },
            ],
            type: "number",
        },
        heaterStatus: {
            observable: true,
            readOnly: true,
            forms: [
                {
                    href: "/",
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": {
                        root: "i=84",
                        path: `/Objects/2:DeviceSet/${coffeeMachine}/7:Parameters/17:HeaterStatus`,
                    },
                },
            ],
            type: "number",
        },
        pumpStatus: {
            observable: true,
            readOnly: true,
            forms: [
                {
                    href: "/",
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": {
                        root: "i=84",
                        path: `/Objects/2:DeviceSet/${coffeeMachine}/7:Parameters/17:PumpStatus`,
                    },
                },
            ],
            type: "number",
        },
        valveStatus: {
            observable: true,
            readOnly: true,
            forms: [
                {
                    href: "/",
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": {
                        root: "i=84",
                        path: `/Objects/2:DeviceSet/${coffeeMachine}/7:Parameters/17:ValveStatus`,
                    },
                },
            ],
            type: "number",
        },
        grindingDuration: {
            observable: true,
            readOnly: true,
            forms: [
                {
                    href: "/",
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": {
                        root: "i=84",
                        path: `/Objects/2:DeviceSet/${coffeeMachine}/7:Parameters/17:GrindingDuration`,
                    },
                },
            ],
            type: "number",
        },
    },
    actions: {
        brewCoffee: {
            forms: [
                {
                    type: "object",
                    href: "/",
                    op: ["invokeaction"],
                    "opcua:nodeId": { root: "i=84", path: `/Objects/2:DeviceSet/${coffeeMachine}` },
                    "opcua:method": {
                        root: "i=84",
                        path: `/Objects/2:DeviceSet/${coffeeMachine}/2:MethodSet/17:MakeCoffee`,
                    },
                },
            ],
            input: {
                type: "object",
                properties: {
                    RecipeName: {
                        title: "Americano or Espresso or Mocha (see available Recipes in OPCUA server)",
                        type: "string",
                    },
                },
                required: ["RecipeName"],
            },
        },
        fillTank: {
            forms: [
                {
                    type: "object",
                    href: "/",
                    op: ["invokeaction"],
                    "opcua:nodeId": { root: "i=84", path: `/Objects/2:DeviceSet/${coffeeMachine}` },
                    "opcua:method": {
                        root: "i=84",
                        path: `/Objects/2:DeviceSet/${coffeeMachine}/2:MethodSet/17:FillTank`,
                    },
                },
            ],
        },
    },
};
