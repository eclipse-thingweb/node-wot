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

import "wot-typescript-definitions";

WoT.consume({
    id: "urn:dev:ops:waterCounter",
    title: "ACW Itron BM +m Cold water",
    "@context": ["https://www.w3.org/2019/wot/td/v1"],
    securityDefinitions: {
        nosec_sc: {
            scheme: "nosec",
        },
    },
    security: ["nosec_sc"],
    properties: {
        SlaveInformation: {
            title: "SlaveInformation",
            description: "Contains information about the M-Bus Thing",
            type: "object",
            readOnly: true,
            observable: false,
            forms: [
                {
                    href: "mbus+tcp://127.0.0.1:8181",
                    op: ["readproperty"],
                    "mbus:unitID": 1,
                    "mbus:offset": -1,
                    "mbus:timeout": 2000,
                    contentType: "application/json",
                },
            ],
            writeOnly: false,
        },
        FabricationNumber: {
            title: "Fabrication number",
            type: "object",
            readOnly: true,
            observable: false,
            properties: {
                Value: {
                    standardObject: "FabricationNumber",
                    title: "Fabrication number",
                    type: "integer",
                    readOnly: true,
                    observable: false,
                    writeOnly: false,
                },
            },
            forms: [
                {
                    href: "mbus+tcp://127.0.0.1:8181",
                    op: ["readproperty"],
                    "mbus:unitID": 1,
                    "mbus:offset": 0,
                    "mbus:timeout": 2000,
                    contentType: "application/json",
                },
            ],
            writeOnly: false,
        },
        Volume0: {
            title: "Instantaneous Volume",
            type: "object",
            unit: "m m^3",
            readOnly: true,
            observable: false,
            forms: [
                {
                    href: "mbus+tcp://127.0.0.1:8181",
                    op: ["readproperty"],
                    "mbus:unitID": 1,
                    "mbus:offset": 1,
                    "mbus:timeout": 2000,
                    contentType: "application/json",
                },
            ],
            writeOnly: false,
        },
        Date: {
            title: "Time Point (date)",
            type: "object",
            unit: "date",
            readOnly: true,
            observable: false,
            forms: [
                {
                    href: "mbus+tcp://127.0.0.1:8181",
                    op: ["readproperty"],
                    "mbus:unitID": 1,
                    "mbus:offset": 2,
                    "mbus:timeout": 2000,
                    contentType: "application/json",
                },
            ],
            writeOnly: false,
        },
        Volume1: {
            title: "Instantaneous Volume",
            type: "object",
            unit: "m m^3",
            readOnly: true,
            observable: false,
            forms: [
                {
                    href: "mbus+tcp://127.0.0.1:8181",
                    op: ["readproperty"],
                    "mbus:unitID": 1,
                    "mbus:offset": 3,
                    "mbus:timeout": 2000,
                    contentType: "application/json",
                },
            ],
            writeOnly: false,
        },
        TimeAndDate: {
            title: "Time Point (time & date)",
            type: "object",
            unit: "time and date",
            readOnly: true,
            observable: false,
            forms: [
                {
                    href: "mbus+tcp://127.0.0.1:8181",
                    op: ["readproperty"],
                    "mbus:unitID": 1,
                    "mbus:offset": 4,
                    "mbus:timeout": 2000,
                    contentType: "application/json",
                },
            ],
            writeOnly: false,
        },
        OperatingDays: {
            title: "Operating time (days)",
            type: "object",
            unit: "days",
            readOnly: true,
            observable: false,
            forms: [
                {
                    href: "mbus+tcp://127.0.0.1:8181",
                    op: ["readproperty"],
                    "mbus:unitID": 1,
                    "mbus:offset": 5,
                    "mbus:timeout": 2000,
                    contentType: "application/json",
                },
            ],
            writeOnly: false,
        },
        FirmwareVersion: {
            title: "Firmware version",
            type: "object",
            readOnly: true,
            observable: false,
            forms: [
                {
                    href: "mbus+tcp://127.0.0.1:8181",
                    op: ["readproperty"],
                    "mbus:unitID": 1,
                    "mbus:offset": 6,
                    "mbus:timeout": 2000,
                    contentType: "application/json",
                },
            ],
            writeOnly: false,
        },
        SoftwareVersion: {
            title: "Software version",
            type: "object",
            readOnly: true,
            observable: false,
            forms: [
                {
                    href: "mbus+tcp://127.0.0.1:8181",
                    op: ["readproperty"],
                    "mbus:unitID": 1,
                    "mbus:offset": 7,
                    "mbus:timeout": 2000,
                    contentType: "application/json",
                },
            ],
            writeOnly: false,
        },
        ManufacturerSpecific: {
            title: "Manufacturer specific",
            type: "object",
            readOnly: true,
            observable: false,
            forms: [
                {
                    href: "mbus+tcp://127.0.0.1:8181",
                    op: ["readproperty"],
                    "mbus:unitID": 1,
                    "mbus:offset": 8,
                    "mbus:timeout": 2000,
                    contentType: "application/json",
                },
            ],
            writeOnly: false,
        },
    },
}).then(async (mbusThing) => {
    try {
        let res: any;
        res = await mbusThing.readProperty("SlaveInformation");
        console.log("Slave Informations:", res);
        res = await mbusThing.readProperty("Volume0");
        console.log("Volume 0:", res.Value);
        res = await mbusThing.readProperty("TimeAndDate");
        console.log("Time and Date:", res.Value);
    } catch (err) {
        console.error("Application error:", err.message);
        console.error(err);
    }
});
