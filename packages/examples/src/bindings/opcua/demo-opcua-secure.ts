/********************************************************************************
 * Copyright (c) 2026 Contributors to the Eclipse Foundation
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
/* eslint  no-console: "off" */
/* eslint  n/no-process-exit: "off" */

//
// Connecting to a secured OPC UA server, as described by OPC 10101 §6.3.3:
// an encrypted and signed channel, with a named user.
//
// Start the demo server first:
//     ts-node packages/binding-opcua/test/fixture/basic-opcua-server.ts
//
import { OPCUAClientFactory } from "@node-wot/binding-opcua";
import { Servient } from "@node-wot/core";

const endpoint = "opc.tcp://localhost:7890";

// The thing id is what credentials are keyed by, so it must be present.
const thingId = "urn:node-wot:examples:secure-sensor";

const thingDescription: WoT.ThingDescription = {
    "@context": ["https://www.w3.org/2022/wot/td/v1.1", { uav: "http://opcfoundation.org/UA/WoT-Binding/" }],
    "@type": ["Thing"],
    id: thingId,
    title: "secure-sensor",
    base: endpoint,

    securityDefinitions: {
        // Layer 1 — the connection: signed and encrypted.
        opcua_channel_sc: {
            scheme: "uav:channelsec",
            "uav:securityMode": "SignAndEncrypt",
            "uav:securityPolicy": "Basic256Sha256",
        },
        // Layer 2 — who is connecting. Note that no user name or password
        // appears here: OPC 10101 requires credentials to be supplied
        // separately, and this binding reads them from the servient.
        opcua_authentication_sc: {
            scheme: "uav:authentication",
            "uav:userIdentityToken": "UserName",
        },
        // The two layers are independent, so they are combined with allOf.
        opcua_sc: {
            scheme: "combo",
            allOf: ["opcua_channel_sc", "opcua_authentication_sc"],
        },
    },
    security: "opcua_sc",

    properties: {
        temperature: {
            description: "the temperature in the room",
            type: "number",
            unit: "°C",
            observable: true,
            readOnly: true,
            forms: [
                {
                    href: "/",
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor/2:ParameterSet/1:Temperature" },
                    contentType: "application/json",
                },
            ],
        },
    },
};

(async () => {
    const servient = new Servient();
    servient.addClientFactory(new OPCUAClientFactory());

    // The credentials live here, not in the thing description, keyed by thing id.
    // In a real application they would come from a vault or an operator prompt.
    servient.addCredentials({
        [thingId]: {
            userName: "joe",
            password: "password_for_joe",
        },
    });
    // For a "Certificate" scheme you would supply PEM material instead:
    //   servient.addCredentials({ [thingId]: { certificate: certPem, privateKey: keyPem } });

    const wot = await servient.start();
    const thing = await wot.consume(thingDescription);

    const temperatureProperty = await thing.readProperty("temperature");
    const temperature = await temperatureProperty.value();

    console.log("------------------------------");
    console.log("temperature is :", temperature, "°C");
    console.log("------------------------------");

    await servient.shutdown();
})().catch((err) => {
    // A missing or wrong credential is refused here rather than silently
    // downgraded to an anonymous, unencrypted session.
    console.error("failed:", (err as Error).message);
    process.exit(1);
});
