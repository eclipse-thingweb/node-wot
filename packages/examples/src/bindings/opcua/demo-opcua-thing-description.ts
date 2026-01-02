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
    base: endpointUrl,
    properties: {
        pumpSpeed: {
            description: "the pump speed",
            observable: true,
            readOnly: true,
            unit: "m/s",
            type: "number",
            forms: [
                {
                    href: "?id=ns=1;s=PumpSpeed",
                    op: ["readproperty", "observeproperty"],
                },
            ],
        },
        temperature: {
            description: "the temperature",
            observable: true,
            readOnly: true,
            unit: "m/s",
            type: "number",
            forms: [
                {
                    href: "?id=ns=1;s=Temperature",
                    op: ["readproperty", "observeproperty"],
                },
            ],
        },
    },
};
