/********************************************************************************
 * Copyright (c) 2025 Contributors to the Eclipse Foundation
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
import { Servient, createLoggers } from "@node-wot/core";
import { InteractionOptions } from "wot-typescript-definitions";

import { MessageSecurityMode, OPCUAClient, OPCUAServer, SecurityPolicy } from "node-opcua";
import { coercePrivateKeyPem, readCertificate, readCertificatePEM, readPrivateKey } from "node-opcua-crypto";
import {
    OPCUAClientFactory,
    OPCUAProtocolClient,
    OPCUACUserNameAuthenticationScheme,
    OPCUACertificateAuthenticationScheme,
    OPCUAChannelSecurityScheme,
} from "../src";

import { startServer } from "./fixture/basic-opcua-server";
const endpoint = "opc.tcp://localhost:7890";

const { debug } = createLoggers("binding-opcua", "full-opcua-thing-test");

interface WhoAmI {
    UserName: string | null;
    UserIdentityTokenType: string | null;
    ChannelSecurityMode: string | null;
    ChannelSecurityPolicyUri: string | null;
}
const thingDescription: WoT.ThingDescription = {
    "@context": "https://www.w3.org/2019/wot/td/v1",
    "@type": ["Thing"],

    securityDefinitions: {
        nosec_sc: {
            scheme: "nosec",
        },
        // OPCUAChannelSecurityScheme
        "c:sign-encrypt_basic256Sha256": <OPCUAChannelSecurityScheme>{
            scheme: "uav:channel-security",
            messageMode: "sign_encrypt",
            policy: "Basic256Sha256", // deprecated
        },
        // Aes128_Sha256_RsaOaep
        "c:sign-encrypt_aes128Sha256RsaOaep": <OPCUAChannelSecurityScheme>{
            scheme: "uav:channel-security",
            messageMode: "sign_encrypt",
            policy: "Aes128_Sha256_RsaOaep",
        },

        "c:sign_basic256Sha256": <OPCUAChannelSecurityScheme>{
            scheme: "uav:channel-security",
            messageMode: "sign",
            policy: "Basic256Sha256",
        },
        "c:invalid-sign": <OPCUAChannelSecurityScheme>{
            scheme: "uav:channel-security",
            messageMode: "sign",
            policy: "Basic192Rsa15", // Basic192Rsa15 valid policy but unsupported by server
        },
        "c:no_security": <OPCUAChannelSecurityScheme>{
            scheme: "uav:channel-security",
            messageMode: "none",
        },
        //
        "a:username-password": <OPCUACUserNameAuthenticationScheme>{
            scheme: "uav:authentication",
            tokenType: "username",
            userName: "joe",
            password: "password_for_joe",
        },
        "a:username-invalid-password": <OPCUACUserNameAuthenticationScheme>{
            scheme: "uav:authentication",
            tokenType: "username",
            userName: "joe",
            password: "**INVALID**password_for_joe",
        },
        "a:x509-certificate": <OPCUACertificateAuthenticationScheme>{
            scheme: "uav:authentication",
            tokenType: "certificate",
            certificate: "....",
            privateKey: "....",
        },
        "a:x509-certificate-no-private-key": <OPCUACertificateAuthenticationScheme>{
            scheme: "uav:authentication",
            tokenType: "certificate",
            certificate: "....",
            privateKey: undefined,
        },
        // compbo
        "c:sign_basic256Sha256-a:username-password": {
            scheme: "combo",
            allOf: ["c:sign_basic256Sha256", "a:username-password"],
        },
        "c:sign_basic256Sha256-a:username-invalid-password": {
            scheme: "combo",
            allOf: ["c:sign_basic256Sha256", "a:username-invalid-password"],
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
    actions: {
        whoAmI: {
            forms: [
                {
                    type: "object",
                    href: "/",
                    op: ["invokeaction"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/Server" },
                    "opcua:method": { root: "i=84", path: "/Objects/Server/1:WhoAmI" },
                },
            ],
            description: "query information about the log in user and current channel security mode",
            // see https://www.w3.org/TR/wot-thing-description11/#action-serialization-sample
            input: {
                type: "object",
                properties: {},
                required: [],
            },
            output: {
                type: "object",
                properties: {
                    UserName: {
                        type: "string",
                        title: "the current user name",
                    },
                    UserIdentityTokenType: {
                        type: "string",
                        title: "the current user identity token type",
                    },
                    ChannelSecurityMode: {
                        type: "string",
                        title: "the current security mode",
                    },
                    ChannelSecurityPolicyUri: {
                        type: "string",
                        title: "the current security policy",
                    },
                },
                required: ["UserName", "UserIdentityTokenType", "ChannelSecurityMode", "ChannelSecurityPolicyUri"],
            },
        },
    },
};

function inferExpectedSecurityMode(security: string): WhoAmI {
    const expected: WhoAmI = {
        UserName: null,
        UserIdentityTokenType: "AnonymousIdentityToken",
        ChannelSecurityMode: MessageSecurityMode[MessageSecurityMode.None],
        ChannelSecurityPolicyUri: SecurityPolicy.None,
    };

    if (security.match(/a:username-password/)) {
        expected.UserName = "joe";
        expected.UserIdentityTokenType = "UserNameIdentityToken";
    } else if (security.match(/certificate/)) {
        expected.UserName = null;
        expected.UserIdentityTokenType = "X509IdentityToken";
    } else {
        expected.UserName = null;
        expected.UserIdentityTokenType = "AnonymousIdentityToken";
    }

    //
    if (security.match(/c:sign-encrypt/)) {
        expected.ChannelSecurityMode = "SignAndEncrypt";
    } else if (security.match(/c:sign/)) {
        expected.ChannelSecurityMode = "Sign";
    } else if (security.match(/c:no_security/)) {
        expected.ChannelSecurityMode = "None";
        expected.ChannelSecurityPolicyUri = "http://opcfoundation.org/UA/SecurityPolicy#None";
    }

    if (security.match(/basic256Sha256/)) {
        expected.ChannelSecurityPolicyUri = "http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256";
    } else if (security.match(/aes128Sha256RsaOaep/)) {
        expected.ChannelSecurityPolicyUri = "http://opcfoundation.org/UA/SecurityPolicy#Aes128_Sha256_RsaOaep";
    }
    return expected;
}

describe("Testing OPCUA Expected Value inference", () => {
    it("should infer expected values from security string", () => {
        let expected = inferExpectedSecurityMode("c:sign-encrypt_basic256Sha256-a:username-password");
        expect(expected.UserName).to.eql("joe");
        expect(expected.UserIdentityTokenType).to.eql("UserNameIdentityToken");
        expect(expected.ChannelSecurityMode).to.eql("SignAndEncrypt");
        expect(expected.ChannelSecurityPolicyUri).to.eql("http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256");

        expected = inferExpectedSecurityMode("c:sign_basic256Sha256-a:username-password");
        expect(expected.UserName).to.eql("joe");
        expect(expected.UserIdentityTokenType).to.eql("UserNameIdentityToken");
        expect(expected.ChannelSecurityMode).to.eql("Sign");
        expect(expected.ChannelSecurityPolicyUri).to.eql("http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256");

        expected = inferExpectedSecurityMode("c:no_security");
        expect(expected.UserName).to.eql(null);
        expect(expected.UserIdentityTokenType).to.eql("AnonymousIdentityToken");
        expect(expected.ChannelSecurityMode).to.eql("None");
        expect(expected.ChannelSecurityPolicyUri).to.eql("http://opcfoundation.org/UA/SecurityPolicy#None");

        expected = inferExpectedSecurityMode("c:sign-encrypt_aes128Sha256RsaOaep-a:x509-certificate");
        expect(expected.UserName).to.eql(null);
        expect(expected.UserIdentityTokenType).to.eql("X509IdentityToken");
        expect(expected.ChannelSecurityMode).to.eql("SignAndEncrypt");
        expect(expected.ChannelSecurityPolicyUri).to.eql(
            "http://opcfoundation.org/UA/SecurityPolicy#Aes128_Sha256_RsaOaep"
        );
    });
});

const possibleSecurityMode = Object.keys(thingDescription.securityDefinitions).filter((s) => !s.match(/invalid/));
const possibleInvalidSecurityMode = Object.keys(thingDescription.securityDefinitions).filter((s) => s.match(/invalid/));
describe("verify test securityDefinitions", () => {
    it("should have a coherent security definitions", () => {
        expect(thingDescription).to.be.an("object");
        const definitions = thingDescription.securityDefinitions;
        expect(definitions).to.be.an("object");
        expect(Object.keys(definitions).length).to.be.greaterThan(0);
        for (const key of Object.keys(definitions)) {
            const def = definitions[key];
            expect(def).to.have.property("scheme");
            if (def.scheme === "nosec") {
                continue;
            }
            if (def.scheme === "combo") {
                const comboDef = def as { scheme: string; allOf: string[] };
                expect(comboDef.allOf).to.be.an("array");
                expect(comboDef.allOf.length).to.be.greaterThan(0);
                for (const subKey of comboDef.allOf) {
                    expect(definitions).to.have.property(subKey);
                }
            } else if (def.scheme === "uav:channel-security") {
                const channelDef = def as OPCUAChannelSecurityScheme;
                expect(channelDef).to.have.property("messageMode");
                expect(["none", "sign", "sign_encrypt"]).to.include(channelDef.messageMode);
                // policy is optional
            } else if (def.scheme === "uav:authentication") {
                const authDef = def as OPCUACertificateAuthenticationScheme | OPCUACUserNameAuthenticationScheme;
                expect(authDef).to.have.property("tokenType");
                if (authDef.tokenType === "username") {
                    expect(authDef).to.have.property("userName");
                    expect(authDef).to.have.property("password");
                } else if (authDef.tokenType === "certificate") {
                    expect(authDef).to.have.property("certificate");
                    expect(authDef).to.have.property("privateKey");
                }
            }
        }
    });
});

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
        localOptions: InteractionOptions
    ): Promise<{ value?: number; whoAmI?: WhoAmI; err?: Error }> {
        debug("------------------------------------------------------");
        try {
            const propertyName = "temperature";

            const content = await thing.readProperty(propertyName, localOptions);
            const value = (await content.value()) as number;

            const result = await thing.invokeAction("whoAmI", {}, localOptions);
            const whoAmI = (await result?.value()) as WhoAmI;

            debug(`whoAmI = ${JSON.stringify(whoAmI)}`);
            return { value, whoAmI };
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
                const { value, whoAmI, err } = await doTest(thing, localOptions);
                expect(err).to.eql(undefined);
                expect(value).to.eql(25);

                const expected = inferExpectedSecurityMode(security);
                expect(whoAmI).to.eql(expected);
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
                const { err } = await doTest(thing, localOptions);
                expect(err).to.not.eql(undefined);
            } finally {
                await servient.shutdown();
            }
        });
    });
});
