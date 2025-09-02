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

// node-wot implementation of W3C WoT Servient

import { expect } from "chai";
import path from "path";
import {
    OPCUACUserNameAuthenticationScheme,
    OPCUACertificateAuthenticationScheme,
    OPCUAChannelSecurityScheme,
    Servient,
    createLoggers,
} from "@node-wot/core";
import { InteractionOptions } from "wot-typescript-definitions";

import { OPCUAClient, OPCUAServer } from "node-opcua";
import { coercePrivateKeyPem, readCertificate, readCertificatePEM, readPrivateKey } from "node-opcua-crypto";
import { OPCUAClientFactory, OPCUAProtocolClient } from "../src";
import { startServer } from "./fixture/basic-opcua-server";
const endpoint = "opc.tcp://localhost:7890";

const { debug } = createLoggers("binding-opcua", "full-opcua-thing-test");

const thingDescription: WoT.ThingDescription = {
    "@context": "https://www.w3.org/2019/wot/td/v1",
    "@type": ["Thing"],

    securityDefinitions: {
        nosec_sc: {
            scheme: "nosec",
        },
        // OPCUAChannelSecurityScheme
        "c:sign-encrypt_basic256Sha256": <OPCUAChannelSecurityScheme>{
            scheme: "opcua-channel-security",
            messageMode: "sign_encrypt",
            policy: "Basic256Sha256", // deprecated
        },

        "c:sign": <OPCUAChannelSecurityScheme>{
            scheme: "opcua-channel-security",
            messageMode: "sign",
            policy: "Basic256Sha256",
        },
        "c:invalid-sign": <OPCUAChannelSecurityScheme>{
            scheme: "opcua-channel-security",
            messageMode: "sign",
            policy: "Basic192Rsa15", // Basic192Rsa15 valid policy but unsupported by server
        },
        "c:no_security": <OPCUAChannelSecurityScheme>{
            scheme: "opcua-channel-security",
            messageMode: "none",
        },
        //
        "a:username-password": <OPCUACUserNameAuthenticationScheme>{
            scheme: "opcua-authentication",
            tokenType: "username",
            userName: "joe",
            password: "password_for_joe",
        },
        "a:username-invalid-password": <OPCUACUserNameAuthenticationScheme>{
            scheme: "opcua-authentication",
            tokenType: "username",
            userName: "joe",
            password: "**INVALID**password_for_joe",
        },
        "a:x509-certificate": <OPCUACertificateAuthenticationScheme>{
            scheme: "opcua-authentication",
            tokenType: "certificate",
            certificate: "....",
            privateKey: "....",
        },
        "a:x509-certificate-no-private-key": <OPCUACertificateAuthenticationScheme>{
            scheme: "opcua-authentication",
            tokenType: "certificate",
            certificate: "....",
            privateKey: undefined,
        },
        // compbo
        "c:sign-a:username-password": {
            scheme: "combo",
            allOf: ["c:sign", "a:username-password"],
        },
        "c:sign-a:username-invalid-password": {
            scheme: "combo",
            allOf: ["c:sign", "a:username-invalid-password"],
        },
        "c:sign-encrypt_basic256Sha256-a:username-password": {
            scheme: "combo",
            allOf: ["c:sign-encrypt_basic256Sha256", "a:username-password"],
        },
        "c:sign-encrypt_basic256Sha256-a:certificate": {
            scheme: "combo",
            allOf: ["c:sign-encrypt_basic256Sha256", "a:x509-certificate"],
        },
        "c:sign-encrypt_basic256Sha256-a:certificate-no-private-key": {
            scheme: "combo",
            allOf: ["c:sign-encrypt_basic256Sha256", "a:x509-certificate"],
        },
        "c:sign-encrypt_basic256Sha256-a:anonymous": {
            scheme: "combo",
            allOf: ["c:sign-encrypt_basic256Sha256"],
        },
    },

    security: "no_security", // by default,

    title: "servient",
    description: "node-wot CLI Servient",

    opcua: {
        namespace: ["http://opcfoundation.org/UA", "own", "http://opcfoundation.org/UA/DI/"],
        endpoint,
    },
    base: endpoint,
    properties: {
        // bare value like needed by WoT
        temperature: {
            description: "the temperature in the room",
            observable: true,
            readOnly: true,
            unit: "°C",
            type: "number",
            "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor/2:ParameterSet/1:Temperature" },
            // Don't specify type here as it could be multi form: type: [ "object", "number" ],
            forms: [
                // 0 -> standard Node WoT form => Raw value
                {
                    href: "/", // endpoint,
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor/2:ParameterSet/1:Temperature" },
                    contentType: "application/json",
                },
            ],
        },
    },
};

const possibleSecurityMode = Object.keys(thingDescription.securityDefinitions).filter((s) => !s.match(/invalid/));
const possibleInvalidSecurityMode = Object.keys(thingDescription.securityDefinitions).filter((s) => s.match(/invalid/));

describe("Testing OPCUA Security Combination", () => {
    let opcuaServer: OPCUAServer;
    let endpoint: string;
    before(async () => {
        opcuaServer = await startServer();
        endpoint = opcuaServer.getEndpointUrl();
        debug(`endpoint =  ${endpoint}`);

        // adjust TD to endpoint
        thingDescription.base = endpoint;
        (thingDescription.opcua as unknown as { endpoint: string }).endpoint = endpoint;

        // exchnage certificate
        const serverCertificateManager = opcuaServer.serverCertificateManager;
        const clientCertificateManager = await OPCUAProtocolClient.getCertificateManager();

        // Client should trust client certificate
        const serverCertificate = opcuaServer.getCertificate();
        clientCertificateManager.trustCertificate(serverCertificate);

        // Server should trust application client certificate
        const client = OPCUAClient.create({ clientCertificateManager });
        await client.createDefaultCertificate();
        const clientCertificate = client.getCertificateChain();
        serverCertificateManager.trustCertificate(clientCertificate);

        // let's create the x509 Certificate for User JoeDoe
        const joedoeX509CertificateFilename = path.join(
            clientCertificateManager.rootDir,
            "joeDoe_x509_certificate.pem"
        );

        await clientCertificateManager.createSelfSignedCertificate({
            subject: "CN=joedoe",
            startDate: new Date(),
            validity: 100, // 100 days
            outputFile: joedoeX509CertificateFilename,
            dns: [],
            applicationUri: " ",
        });
        const joedoeX509Cerficate = readCertificate(joedoeX509CertificateFilename);

        // server should trust x509 User certificate
        const userCertificateManager = opcuaServer.userCertificateManager;
        userCertificateManager.trustCertificate(joedoeX509Cerficate);

        // adjust thingDescription x509 parameters with generated certficate info
        const joedoeX509CertificatePem = readCertificatePEM(joedoeX509CertificateFilename);

        const x509 = thingDescription.securityDefinitions["a:x509-certificate"];
        x509.certificate = joedoeX509CertificatePem;
        const privateKeyPem = coercePrivateKeyPem(readPrivateKey(clientCertificateManager.privateKey));
        x509.privateKey = privateKeyPem;

        const x509NoPrivateKey = thingDescription.securityDefinitions["a:x509-certificate-no-private-key"];
        x509NoPrivateKey.certificate = joedoeX509CertificatePem;
        x509NoPrivateKey.privateKey = undefined;
    });
    after(async () => {
        await opcuaServer.shutdown();
    });

    async function makeThing(security: string) {
        if (thingDescription.securityDefinitions[security] === undefined) {
            throw new Error("security definition does not exist : " + security);
        }

        // TEAWK thingDescription with expected security mode
        thingDescription.security = security;

        const servient = new Servient();

        const opcuaClientFactory = new OPCUAClientFactory();

        servient.addClientFactory(opcuaClientFactory);

        const wot = await servient.start();

        const thing: WoT.ConsumedThing = await wot.consume(thingDescription);

        debug(`${thing.getThingDescription().properties}`);

        return { thing, servient };
    }

    async function doTest(
        thing: WoT.ConsumedThing,
        propertyName: string,
        localOptions: InteractionOptions
    ): Promise<{ value?: number; err?: Error }> {
        debug("------------------------------------------------------");
        try {
            const content = await thing.readProperty(propertyName, localOptions);

            const value = (await content.value()) as number;
            return { value };
        } catch (e) {
            debug(`${e}`);
            return { err: e as Error };
        }
    }

    possibleSecurityMode.forEach((security, index) => {
        it(`SEC${index} - test ${security.replace(/-|_/g, " ")}`, async () => {
            const localOptions = {};
            const { thing, servient } = await makeThing(security);
            try {
                const propertyName = "temperature";
                const { value, err } = await doTest(thing, propertyName, localOptions);
                expect(err).to.eql(undefined);
                expect(value).to.eql(25);
            } finally {
                await servient.shutdown();
            }
        });
    });

    possibleInvalidSecurityMode.forEach((security, index) => {
        it(`INVALID-SEC${index} - test ${security.replace(/-|_/g, " ")}`, async () => {
            const localOptions = {};
            const { thing, servient } = await makeThing(security);
            try {
                const propertyName = "temperature";
                const { err } = await doTest(thing, propertyName, localOptions);
                expect(err).to.not.eql(undefined);
            } finally {
                await servient.shutdown();
            }
        });
    });
});
