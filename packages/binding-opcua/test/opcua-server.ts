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
import {
    OPCUAServer,
    Variant,
    DataType,
    StatusCodes,
    SessionContext,
    CallMethodResultOptions,
    CallbackT,
} from "node-opcua";

export class OpcuaServer {
    server: OPCUAServer;
    private testingVariable: number;
    constructor() {
        this.server = new OPCUAServer({
            port: 5050, // the port of the listening socket of the server
            resourcePath: "/opcua/server", // this path will be added to the endpoint resource name
            allowAnonymous: true,
        });
        this.testingVariable = 1;
    }

    forceValueChange(): void {
        this.testingVariable++;
    }

    async start(): Promise<void> {
        // Let's create an instance of OPCUAServer
        try {
            await this.server.initialize();
            this.constructMyAddressSpace(this.server);
            await this.server.start();
            const endpointUrl = this.server.getEndpointUrl();
            console.log("OPCUA server started at", endpointUrl);
        } catch (err) {
            throw new Error(err);
        }
    }

    async stop(): Promise<void> {
        await this.server.shutdown(1000);
    }

    constructMyAddressSpace(server: OPCUAServer): void {
        const addressSpace = server.engine.addressSpace;
        const namespace = addressSpace.getOwnNamespace();

        // OBJECTS
        const device = namespace.addObject({
            nodeId: "ns=1;s=device",
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "WotDevice",
        });

        // VARIABLES

        namespace.addVariable({
            componentOf: device,
            nodeId: "ns=1;s=9998FFAA", // some opaque NodeId in namespace 4
            browseName: "Increment",
            dataType: "Double",
            value: {
                get: () => {
                    return new Variant({ dataType: DataType.Double, value: this.testingVariable });
                },
            },
        });

        let str = "";

        namespace.addVariable({
            componentOf: device,
            nodeId: "ns=1;s=Case_Lamp_Variable", // some opaque NodeId in namespace 4
            browseName: "TestString",
            dataType: "String",
            value: {
                get: function () {
                    return new Variant({ dataType: DataType.String, value: str });
                },
                set: function (variant: Variant) {
                    // write property
                    str = variant.value;
                    return StatusCodes.Good;
                },
            },
        });

        namespace.addVariable({
            componentOf: device,
            nodeId: 'ns=1;s="Case_Lamp_Variable"', // some opaque NodeId in namespace 4
            browseName: "TestString",
            dataType: "String",
            value: {
                get: function () {
                    return new Variant({ dataType: DataType.String, value: str });
                },
                set: function (variant: Variant) {
                    // write property
                    str = variant.value;
                    return StatusCodes.Good;
                },
            },
        });

        let testVariable = Math.random();
        const v = namespace.addVariable({
            browseName: "RandomValue",
            nodeId: "ns=1;s=9998FF00", // some opaque NodeId in namespace 4
            dataType: "Double",
            value: {
                get: function () {
                    return new Variant({ dataType: DataType.Double, value: testVariable });
                },
                set: function (variant: Variant) {
                    // write property
                    testVariable = variant.value;
                    return StatusCodes.Good;
                },
            },
        });
        v.setValueFromSource({ dataType: DataType.Double, value: testVariable });

        const method = namespace.addMethod(device, {
            // invoke action
            nodeId: "ns=1;s=method",
            browseName: "DivideFunction",
            inputArguments: [
                {
                    name: "a",
                    description: { text: "specifies the first number" },
                    dataType: DataType.Double,
                },
                {
                    name: "b",
                    description: { text: "specifies the second number" },
                    dataType: DataType.Double,
                },
            ],

            outputArguments: [
                {
                    name: "division",
                    description: { text: "the generated barks" },
                    dataType: DataType.Double,
                    valueRank: 1,
                },
            ],
        });

        method.bindMethod(
            (inputArguments: Variant[], context: SessionContext, callback: CallbackT<CallMethodResultOptions>) => {
                const a = inputArguments[0].value;
                const b = inputArguments[1].value;

                const res = a / b;
                const callMethodResult = {
                    statusCode: StatusCodes.Good,
                    outputArguments: [
                        {
                            dataType: DataType.Double,
                            value: res,
                        },
                    ],
                };
                callback(null, callMethodResult);
            }
        );
    }
}
