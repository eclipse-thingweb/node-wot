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
import { SecurityScheme, Servient, createLoggers } from "@node-wot/core";
import { InteractionOptions } from "wot-typescript-definitions";

import { MessageSecurityMode, OPCUAClient, OPCUAServer, SecurityPolicy, UserTokenType } from "node-opcua";
import { UserIdentityInfoUserName } from "node-opcua-client";
import { coercePrivateKeyPem, readCertificate, readCertificatePEM, readPrivateKey } from "node-opcua-crypto";
import {
    OPCUAClientFactory,
    OPCUACUserNameAuthenticationScheme,
    OPCUACertificateAuthenticationScheme,
    OPCUAChannelSecurityScheme,
    OPCUAProtocolClient,
    OPCUACAuthenticationScheme,
    OPCUACredentials,
} from "../src";
import { resolveChannelSecurity, resolvedUserIdentity } from "../src/opcua-security-resolver";

import { startServer } from "./fixture/basic-opcua-server";
import { CertificateManagerSingleton } from "../src/certificate-manager-singleton";
const endpoint = "opc.tcp://localhost:7890";
// credentials are registered against the thing id (see credentialsFor / makeThing)
const thingId = "urn:node-wot:opcua-security-test";

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
    // credentials are registered against the thing id
    id: thingId,

    securityDefinitions: {
        nosec_sc: {
            scheme: "nosec",
        },
        // OPCUAChannelSecurityScheme
        "c:sign-encrypt_basic256Sha256": <OPCUAChannelSecurityScheme>{
            scheme: "uav:channelsec",
            "uav:securityMode": "SignAndEncrypt",
            "uav:securityPolicy": "Basic256Sha256", // deprecated
        },
        // Aes128_Sha256_RsaOaep
        "c:sign-encrypt_aes128Sha256RsaOaep": <OPCUAChannelSecurityScheme>{
            scheme: "uav:channelsec",
            "uav:securityMode": "SignAndEncrypt",
            "uav:securityPolicy": "Aes128_Sha256_RsaOaep",
        },

        "c:sign_basic256Sha256": <OPCUAChannelSecurityScheme>{
            scheme: "uav:channelsec",
            "uav:securityMode": "Sign",
            "uav:securityPolicy": "Basic256Sha256",
        },
        "c:invalid-sign": <OPCUAChannelSecurityScheme>{
            scheme: "uav:channelsec",
            "uav:securityMode": "Sign",
            "uav:securityPolicy": "Basic192Rsa15", // Basic192Rsa15 valid policy but unsupported by server
        },
        "c:no_security": <OPCUAChannelSecurityScheme>{
            scheme: "uav:channelsec",
            "uav:securityMode": "None",
        },
        //
        // Note: the schemes below carry no credentials. OPC 10101 6.3.3 requires those to be
        // supplied out of band; the test harness registers them with servient.addCredentials()
        // and derives which ones from the definition name (see credentialsFor).
        "a:username-password": <OPCUACUserNameAuthenticationScheme>{
            scheme: "uav:authentication",
            "uav:userIdentityToken": "UserName",
        },
        "a:username-invalid-password": <OPCUACUserNameAuthenticationScheme>{
            scheme: "uav:authentication",
            "uav:userIdentityToken": "UserName",
        },
        "a:x509-certificate": <OPCUACertificateAuthenticationScheme>{
            scheme: "uav:authentication",
            "uav:userIdentityToken": "Certificate",
        },
        "a:x509-certificate-no-private-key": <OPCUACertificateAuthenticationScheme>{
            scheme: "uav:authentication",
            "uav:userIdentityToken": "Certificate",
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
        "c:auto_a:anonymous": {
            scheme: "auto",
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
    } else if (security.match(/c:auto/)) {
        // the most secure that the server supports, by client looking-up at the server endpoints
        expected.ChannelSecurityMode = "SignAndEncrypt";
        expected.ChannelSecurityPolicyUri = "http://opcfoundation.org/UA/SecurityPolicy#Aes256_Sha256_RsaPss";
        return expected;
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
            } else if (def.scheme === "uav:channelsec") {
                const channelDef = def as OPCUAChannelSecurityScheme;
                expect(channelDef).to.have.property("uav:securityMode");
                expect(["None", "Sign", "SignAndEncrypt"]).to.include(channelDef["uav:securityMode"]);
                // uav:securityPolicy is optional
            } else if (def.scheme === "uav:authentication") {
                const authDef = def as OPCUACertificateAuthenticationScheme | OPCUACUserNameAuthenticationScheme;
                expect(authDef).to.have.property("uav:userIdentityToken");
                // credentials must NOT appear in the thing description (OPC 10101 6.3.3)
                expect(authDef).to.not.have.property("userName");
                expect(authDef).to.not.have.property("password");
                expect(authDef).to.not.have.property("certificate");
                expect(authDef).to.not.have.property("privateKey");
            }
        }
    });
});

describe("Testing OPCUA Security Combination", () => {
    let opcuaServer: OPCUAServer;
    let endpoint: string;
    // filled in by before(), once the self-signed material has been generated
    let certificatePem: string;
    let privateKeyPem: string;

    /**
     * Credentials are no longer part of the thing description, so the harness derives
     * them from the security definition name, the same way inferExpectedSecurityMode does.
     */
    function credentialsFor(security: string): OPCUACredentials | undefined {
        if (security.match(/username-invalid-password/)) {
            return { userName: "joe", password: "**INVALID**password_for_joe" };
        }
        if (security.match(/username-password/)) {
            return { userName: "joe", password: "password_for_joe" };
        }
        if (security.match(/no-private-key/)) {
            return { certificate: certificatePem, privateKey: undefined };
        }
        if (security.match(/certificate/)) {
            return { certificate: certificatePem, privateKey: privateKeyPem };
        }
        return undefined;
    }
    before(async () => {
        opcuaServer = await startServer();
        endpoint = opcuaServer.getEndpointUrl();
        debug(`endpoint =  ${endpoint}`);

        // adjust TD to endpoint
        thingDescription.base = endpoint;
        (thingDescription.opcua as unknown as { endpoint: string }).endpoint = endpoint;

        // exchnage certificate
        const serverCertificateManager = opcuaServer.serverCertificateManager;
        const clientCertificateManager = await CertificateManagerSingleton.getCertificateManager();

        // Client should trust client certificate
        const serverCertificate = opcuaServer.getCertificate();
        await clientCertificateManager.trustCertificate(serverCertificate);

        // Server should trust application client certificate
        const client = OPCUAClient.create({ clientCertificateManager });
        await client.createDefaultCertificate();
        const clientCertificate = client.getCertificateChain();
        await serverCertificateManager.trustCertificate(clientCertificate);

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
        await userCertificateManager.trustCertificate(joedoeX509Cerficate);

        // adjust thingDescription x509 parameters with generated certficate info
        const joedoeX509CertificatePem = readCertificatePEM(joedoeX509CertificateFilename);

        certificatePem = joedoeX509CertificatePem;
        privateKeyPem = coercePrivateKeyPem(readPrivateKey(clientCertificateManager.privateKey));
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

        const credentials = credentialsFor(security);
        if (credentials !== undefined) {
            servient.addCredentials({ [thingId]: credentials });
        }

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

describe("Testing OPCUA Security Scheme Migration (OPC 10101 v1.00)", () => {
    it("MIG1 - should reject the pre-1.00 'uav:channel-security' scheme rather than ignore it", () => {
        const client = new OPCUAProtocolClient();
        expect(() =>
            client.setSecurity([
                {
                    scheme: "uav:channel-security",
                    messageMode: "sign_encrypt",
                    policy: "Basic256Sha256",
                } as unknown as SecurityScheme,
            ])
        ).to.throw(/Unsupported OPC UA security scheme 'uav:channel-security'/);
    });

    it("MIG1b - should still refuse any other unknown scheme in our namespace", () => {
        const client = new OPCUAProtocolClient();
        expect(() => client.setSecurity([{ scheme: "uav:whatever" } as unknown as SecurityScheme])).to.throw(
            /Unsupported OPC UA security scheme/
        );
    });

    it("MIG2 - should still ignore security schemes that belong to another binding", () => {
        const client = new OPCUAProtocolClient();
        expect(client.setSecurity([{ scheme: "basic" } as SecurityScheme])).to.eql(true);
    });
});

describe("Testing OPCUA Security Scheme conformance (OPC 10101 6.3.3)", () => {
    it("CONF1 - should accept the full policy URI as well as the short name", () => {
        const resolved = resolveChannelSecurity({
            scheme: "uav:channelsec",
            "uav:securityMode": "Sign",
            "uav:securityPolicy": "http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256",
        } as unknown as OPCUAChannelSecurityScheme);
        expect(resolved.securityPolicy).to.eql(SecurityPolicy.Basic256Sha256);
        expect(resolved.messageSecurityMode).to.eql(MessageSecurityMode.Sign);
    });

    it("CONF2 - should accept securityPolicy 'None' together with securityMode 'None'", () => {
        const resolved = resolveChannelSecurity({
            scheme: "uav:channelsec",
            "uav:securityMode": "None",
            "uav:securityPolicy": "None",
        } as unknown as OPCUAChannelSecurityScheme);
        expect(resolved.securityPolicy).to.eql(SecurityPolicy.None);
        expect(resolved.messageSecurityMode).to.eql(MessageSecurityMode.None);
    });

    it("CONF3 - should refuse an unknown securityMode instead of downgrading to None", () => {
        expect(() =>
            resolveChannelSecurity({
                scheme: "uav:channelsec",
                "uav:securityMode": "sign_encrypt",
                "uav:securityPolicy": "Basic256Sha256",
            } as unknown as OPCUAChannelSecurityScheme)
        ).to.throw(/Invalid security mode/);
    });

    it("CONF4 - should refuse securityPolicy 'None' when the mode asks for security", () => {
        expect(() =>
            resolveChannelSecurity({
                scheme: "uav:channelsec",
                "uav:securityMode": "SignAndEncrypt",
                "uav:securityPolicy": "None",
            } as unknown as OPCUAChannelSecurityScheme)
        ).to.throw(/cannot be used with security mode/);
    });

    it("CONF5 - should refuse IssuedToken rather than connect anonymously", () => {
        expect(() =>
            resolvedUserIdentity({
                scheme: "uav:authentication",
                "uav:userIdentityToken": "IssuedToken",
                "uav:issueToken": "oauth2_sc",
            } as unknown as OPCUACAuthenticationScheme)
        ).to.throw(/IssuedToken/);
    });

    it("CONF6 - should refuse an unknown userIdentityToken rather than connect anonymously", () => {
        expect(() =>
            resolvedUserIdentity({
                scheme: "uav:authentication",
                "uav:userIdentityToken": "username",
            } as unknown as OPCUACAuthenticationScheme)
        ).to.throw(/Invalid user identity token/);
    });
});

describe("Testing OPCUA credentials (OPC 10101 6.3.3)", () => {
    const userNameScheme = {
        scheme: "uav:authentication",
        "uav:userIdentityToken": "UserName",
    } as unknown as OPCUACAuthenticationScheme;

    it("CRED1 - should refuse a UserName scheme when no credentials are registered", () => {
        expect(() => resolvedUserIdentity(userNameScheme)).to.throw(/No user name credentials/);
    });

    it("CRED2 - should refuse a Certificate scheme when no credentials are registered", () => {
        expect(() =>
            resolvedUserIdentity({
                scheme: "uav:authentication",
                "uav:userIdentityToken": "Certificate",
            } as unknown as OPCUACAuthenticationScheme)
        ).to.throw(/No certificate credentials/);
    });

    it("CRED3 - should accept credentials given as a single object (thing-level security)", () => {
        const identity = resolvedUserIdentity(userNameScheme, { userName: "joe", password: "secret" });
        expect(identity.type).to.eql(UserTokenType.UserName);
        expect((identity as UserIdentityInfoUserName).userName).to.eql("joe");
    });

    it("CRED4 - should accept credentials given as an array (form-level security)", () => {
        const identity = resolvedUserIdentity(userNameScheme, [{ userName: "joe", password: "secret" }]);
        expect(identity.type).to.eql(UserTokenType.UserName);
        expect((identity as UserIdentityInfoUserName).userName).to.eql("joe");
    });

    it("CRED5 - should pick the entry matching the scheme when several are registered", () => {
        const identity = resolvedUserIdentity(userNameScheme, [
            { certificate: "-----BEGIN CERTIFICATE-----" },
            { userName: "joe", password: "secret" },
        ]);
        expect((identity as UserIdentityInfoUserName).userName).to.eql("joe");
    });

    it("CRED6 - should ignore credentials that do not match the scheme, and refuse", () => {
        expect(() => resolvedUserIdentity(userNameScheme, [{ certificate: "..." }])).to.throw(
            /No user name credentials/
        );
    });
});
