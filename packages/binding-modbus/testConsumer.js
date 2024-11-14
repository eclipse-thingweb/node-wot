/********************************************************************************
 * Copyright (c) 2024 Contributors to the Eclipse Foundation
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
const fs = require("fs"); // to read JSON file in AID format
// Protocols and Servient
Servient = require("@node-wot/core").Servient;
ModbusClientFactory = require("@node-wot/binding-modbus").ModbusClientFactory;

// create Servient and add Modbus binding
let servient = new Servient();
servient.addClientFactory(new ModbusClientFactory());

async function main() {
    let td = {
        "@context": [
            "https://www.w3.org/2019/wot/td/v1",
            "https://www.w3.org/2022/wot/td/v1.1",
            {
                "@language": "en",
            },
        ],
        "@type": "Thing",
        title: "modbus-elevator",
        description: "Elevator Thing",
        securityDefinitions: {
            nosec_sc: {
                scheme: "nosec",
            },
        },
        security: ["nosec_sc"],
        base: "modbus+tcp://0.0.0.0:3179/1/",
        properties: {
            lightSwitch: {
                type: "boolean",
                readOnly: false,
                writeOnly: false,
                observable: false,
                forms: [
                    {
                        href: "1?quantity=1",
                        op: "readproperty",
                        "modv:entity": "Coil",
                        "modv:function": "readCoil",
                        contentType: "application/octet-stream",
                    },
                    {
                        href: "1?quantity=1",
                        op: "writeproperty",
                        "modv:entity": "Coil",
                        "modv:function": "writeSingleCoil",
                        contentType: "application/octet-stream",
                    },
                ],
            },
            onTheMove: {
                type: "boolean",
                readOnly: true,
                writeOnly: false,
                observable: true,
                forms: [
                    {
                        href: "1&quantity=1",
                        op: ["readproperty", "observeproperty"],
                        "modv:entity": "DiscreteInput",
                        "modv:function": "readDiscreteInput",
                        "modv:pollingTime": 1000,
                        contentType: "application/octet-stream",
                    },
                ],
            },
            floorNumber: {
                type: "integer",
                minimum: 0,
                maximum: 15,
                readOnly: false,
                writeOnly: false,
                observable: false,
                forms: [
                    {
                        href: "1?quantity=1",
                        op: "readproperty",
                        "modv:entity": "HoldingRegister",
                        "modv:function": "readHoldingRegisters",
                        contentType: "application/octet-stream;length=2;byteSeq=BIG_ENDIAN",
                    },
                    {
                        href: "1?quantity=1",
                        op: "writeproperty",
                        "modv:entity": "HoldingRegister",
                        "modv:function": "writeSingleHoldingRegister",
                        contentType: "application/octet-stream",
                    },
                ],
            },
        },
    };

    const WoT = await servient.start();
    const thing = await WoT.consume(td);

    // console.log(JSON.stringify(thing.getThingDescription()))

    const readData1 = await thing.readProperty("lightSwitch"); //coil
    const readData2 = await thing.readProperty("floorNumber"); //register

    const readValue1 = await readData1.value();
    console.log(readValue1);

    const readValue2 = await readData2.value();
    console.log(readValue2);
}

main();
