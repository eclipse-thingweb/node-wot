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

import {
    ISessionContext,
    nodesets,
    OPCUAServer,
    StatusCodes,
    UAObject,
    DataType,
    Variant,
    UAVariable,
    VariantLike,
    StatusCode,
    NumericRange,
    QualifiedNameLike,
    DataValue,
    coerceNodeId,
    DataTypeIds,
    coerceQualifiedName,
    VariantArrayType,
    CallbackT,
    CallMethodResultOptions,
} from "node-opcua";
import { KeyValuePair } from "node-opcua-types";
import { createLoggers } from "@node-wot/core";

const { info } = createLoggers("binding-opcua", "basic-opcua-server");

interface UAVariable2 extends UAVariable {
    setValueFromSource(value: VariantLike, statusCode?: StatusCode, sourceTimestamp?: Date): void;
    readValue(
        context?: ISessionContext | null,
        indexRange?: NumericRange,
        dataEncoding?: QualifiedNameLike | null
    ): DataValue;
}

export async function startServer(): Promise<OPCUAServer> {
    const server = new OPCUAServer({
        port: 7890,
        nodeset_filename: [nodesets.standard, nodesets.di],
    });

    await server.initialize();

    const addressSpace = server.engine.addressSpace;
    if (!addressSpace) {
        throw new Error("addressSpace not initialized");
    }

    const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
    if (!nsDI) {
        throw new Error("cannot find DI namespace");
    }

    const deviceType = addressSpace.findObjectType("DeviceType", nsDI);
    if (!deviceType) {
        throw new Error("cannot find DeviceType");
    }

    const namespace = addressSpace.getOwnNamespace();

    const sensorType = namespace.addObjectType({
        subtypeOf: deviceType,
        browseName: "SensorType",
    });

    const mySensor = sensorType.instantiate({
        browseName: "MySensor",
        organizedBy: addressSpace.rootFolder.objects,
        optionals: ["ParameterSet", "MethodSet"],
    });

    const manufacturingDate = namespace.addVariable({
        browseName: "ManufacturingDate",
        nodeId: "s=ManufacturingDate",
        dataType: "DateTime",
        componentOf: mySensor,
    }) as UAVariable2;
    manufacturingDate.setValueFromSource({ dataType: DataType.DateTime, value: new Date("2022-01-31T10:45:00.000Z") });

    const parameterSet = mySensor.getComponentByName("ParameterSet", nsDI);
    if (!parameterSet) {
        throw new Error("cannot find ParameterSet");
    }
    const temperature = namespace.addVariable({
        browseName: "Temperature",
        dataType: "Double",
        componentOf: parameterSet,
    }) as UAVariable2;

    temperature.setValueFromSource({ dataType: DataType.Double, value: 25.0 });

    const temperatureSetPoint = namespace.addVariable({
        browseName: "TemperatureSetPoint",
        dataType: "Double",
        componentOf: parameterSet,
    }) as UAVariable2;
    temperatureSetPoint.setValueFromSource({ dataType: DataType.Double, value: 27.0 });

    const methodSet = mySensor.getComponentByName("MethodSet", nsDI) as UAObject;
    if (!methodSet) {
        throw new Error("cannot find MethodSet");
    }
    const method = namespace.addMethod(methodSet, {
        browseName: "SetTemperatureSetPoint",
        inputArguments: [
            {
                name: "TargetTemperature",
                dataType: DataType.Double,
                description: "the temperature set point to set",
            },
        ],
        outputArguments: [
            {
                dataType: DataType.Double,
                name: "PreviousSetPoint",
            },
        ],
    });

    method.bindMethod(
        (inputArguments: Variant[], context: ISessionContext, callback: CallbackT<CallMethodResultOptions>) => {
            const newTemperatureSetPointVar = inputArguments[0];

            const oldValue = temperatureSetPoint.readValue();
            temperatureSetPoint.setValueFromSource(newTemperatureSetPointVar);

            const callMethodResult = {
                statusCode: StatusCodes.Good,
                outputArguments: [oldValue.value],
            };
            callback(null, callMethodResult);
        }
    );

    const methodWithComplexArguments = namespace.addMethod(methodSet, {
        browseName: "GetSongLyrics",
        inputArguments: [
            {
                name: "SongList",
                dataType: DataType.String,
                valueRank: 1,
                description: "the songs to sing",
            },
            {
                name: "Volume",
                dataType: DataType.Byte,
                description: "the volume to sing at 0-255",
            },
        ],
        outputArguments: [
            {
                dataType: coerceNodeId(DataTypeIds.KeyValuePair),
                name: "SoundAndLyrics",
                valueRank: 1,
                description: "an array of key value pair containing song as key and lyrics as value",
            },
        ],
    });
    methodWithComplexArguments.bindMethod(
        (inputArguments: Variant[], context: ISessionContext, callback: CallbackT<CallMethodResultOptions>) => {
            const songs = inputArguments[0].value as string[];
            const volume = inputArguments[1].value as number;

            const value = songs.map(
                (song) =>
                    new KeyValuePair({
                        key: coerceQualifiedName(song),
                        value: {
                            dataType: DataType.String,
                            value: "Lyrics for '" + song + "' (Volume = " + volume + ")",
                        },
                    })
            );

            const callMethodResult = {
                statusCode: StatusCodes.Good,
                outputArguments: [{ dataType: DataType.ExtensionObject, arrayType: VariantArrayType.Array, value }],
            };
            callback(null, callMethodResult);
        }
    );

    await server.start();
    info(`Server started: ${server.getEndpointUrl()}`);
    return server;
}

if (require.main === module) {
    (async () => {
        const server = await startServer();
        process.once("SIGINT", () => {
            server.shutdown();
        });
    })();
}
