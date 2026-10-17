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

//
// End-to-end tour of OPC UA security in node-wot, against a real OPC UA server.
//
// It is meant to be read top to bottom: each test builds one Thing Description,
// connects with it, and then asks the server "who am I, and how did I connect?"
// through the WhoAmI method. That answer comes from the *server*, so it reports
// what actually happened on the wire, not what the Thing Description asked for.
// That distinction is the point: a security bug in a binding looks exactly like
// a working connection until you ask the other side what it saw.
//
// Reference: OPC 10101 "OPC UA for WoT Binding" v1.00, section 6.3.
// opcua-security-test.ts covers the same ground exhaustively and table-driven;
// this file is the narrative version.
//
import { expect } from "chai";
import { Servient } from "@node-wot/core";
import { OPCUAClient, OPCUAServer, SecurityPolicy } from "node-opcua";

import { OPCUAClientFactory, OPCUACredentials } from "../src";
import { startServer } from "./fixture/basic-opcua-server";
import { CertificateManagerSingleton } from "../src/certificate-manager-singleton";

// What the server reports back about the session it granted.
interface WhoAmI {
    UserName: string | null;
    UserIdentityTokenType: string | null;
    ChannelSecurityMode: string | null;
    ChannelSecurityPolicyUri: string | null;
}

// Credentials are stored per Thing, so the Thing Description needs an id.
const thingId = "urn:node-wot:opcua-security-e2e";

describe("OPCUA security, end to end", function () {
    let opcuaServer: OPCUAServer;
    let endpoint: string;

    before(async () => {
        opcuaServer = await startServer();
        endpoint = opcuaServer.getEndpointUrl();

        // Each side must trust the other's certificate before an encrypted
        // channel can be opened. A real deployment arranges this out of band;
        // here the fixture does it.
        const clientCertificateManager = await CertificateManagerSingleton.getCertificateManager();
        await clientCertificateManager.trustCertificate(opcuaServer.getCertificate());

        const client = OPCUAClient.create({ clientCertificateManager });
        await client.createDefaultCertificate();
        await opcuaServer.serverCertificateManager.trustCertificate(client.getCertificateChain());
    });

    after(async () => {
        await opcuaServer.shutdown();
    });

    /**
     * Wraps the given security definitions in a Thing Description, so that each
     * test below shows only the part that is its actual subject.
     */
    function makeThingDescription(
        securityDefinitions: Record<string, unknown>,
        security: string
    ): WoT.ThingDescription {
        return {
            "@context": ["https://www.w3.org/2022/wot/td/v1.1", { uav: "http://opcfoundation.org/UA/WoT-Binding/" }],
            "@type": ["Thing"],
            id: thingId,
            title: "sensor",
            base: endpoint,
            securityDefinitions,
            security,
            properties: {
                temperature: {
                    type: "number",
                    readOnly: true,
                    forms: [
                        {
                            href: "/",
                            op: ["readproperty"],
                            "opcua:nodeId": {
                                root: "i=84",
                                path: "/Objects/1:MySensor/2:ParameterSet/1:Temperature",
                            },
                            contentType: "application/json",
                        },
                    ],
                },
            },
            actions: {
                // The server answers this one with a description of the session
                // it actually granted, which is what every test below asserts on.
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
                    input: { type: "object", properties: {}, required: [] },
                    output: {
                        type: "object",
                        properties: {
                            UserName: { type: "string" },
                            UserIdentityTokenType: { type: "string" },
                            ChannelSecurityMode: { type: "string" },
                            ChannelSecurityPolicyUri: { type: "string" },
                        },
                        required: [
                            "UserName",
                            "UserIdentityTokenType",
                            "ChannelSecurityMode",
                            "ChannelSecurityPolicyUri",
                        ],
                    },
                },
            },
        } as unknown as WoT.ThingDescription;
    }

    /**
     * Consumes the Thing, reads the temperature, then asks the server what kind
     * of session it granted. Credentials, when supplied, go to the servient and
     * never into the Thing Description (OPC 10101 6.3.3).
     */
    async function connectAndAsk(
        securityDefinitions: Record<string, unknown>,
        security: string,
        credentials?: OPCUACredentials
    ): Promise<{ temperature: number; whoAmI: WhoAmI }> {
        const servient = new Servient();
        servient.addClientFactory(new OPCUAClientFactory());
        if (credentials !== undefined) {
            servient.addCredentials({ [thingId]: credentials });
        }
        try {
            const wot = await servient.start();
            const thing = await wot.consume(makeThingDescription(securityDefinitions, security));

            const temperature = (await (await thing.readProperty("temperature")).value()) as number;
            const whoAmI = (await (await thing.invokeAction("whoAmI", {}))?.value()) as WhoAmI;
            return { temperature, whoAmI };
        } finally {
            await servient.shutdown();
        }
    }

    async function expectRefusal(promise: Promise<unknown>, message: RegExp): Promise<void> {
        try {
            await promise;
        } catch (err) {
            expect((err as Error).message).to.match(message);
            return;
        }
        expect.fail(`expected the connection to be refused with ${message}`);
    }

    // ------------------------------------------------------------------
    // 1. No security at all - OPC 10101 6.3.1
    // ------------------------------------------------------------------
    it("E2E-1 - nosec connects in plain text as an anonymous user", async () => {
        const { temperature, whoAmI } = await connectAndAsk({ nosec_sc: { scheme: "nosec" } }, "nosec_sc");

        expect(temperature).to.eql(25);
        expect(whoAmI.ChannelSecurityMode).to.eql("None");
        expect(whoAmI.UserIdentityTokenType).to.eql("AnonymousIdentityToken");
    });

    // ------------------------------------------------------------------
    // 2. Channel security alone - the connection is protected, nobody is named
    // ------------------------------------------------------------------
    it("E2E-2 - uav:channelsec encrypts the channel, and the user stays anonymous", async () => {
        const { whoAmI } = await connectAndAsk(
            {
                channel_sc: {
                    scheme: "uav:channelsec",
                    "uav:securityMode": "SignAndEncrypt",
                    "uav:securityPolicy": "Basic256Sha256",
                },
            },
            "channel_sc"
        );

        // The channel is protected...
        expect(whoAmI.ChannelSecurityMode).to.eql("SignAndEncrypt");
        expect(whoAmI.ChannelSecurityPolicyUri).to.eql(SecurityPolicy.Basic256Sha256);
        // ...but nothing was said about *who* connects, so: anonymous.
        expect(whoAmI.UserIdentityTokenType).to.eql("AnonymousIdentityToken");
    });

    // ------------------------------------------------------------------
    // 3. Authentication alone - the user is named, the wire is readable
    // ------------------------------------------------------------------
    it("E2E-3 - uav:authentication names the user, over an unprotected channel", async () => {
        const { whoAmI } = await connectAndAsk(
            { user_sc: { scheme: "uav:authentication", "uav:userIdentityToken": "UserName" } },
            "user_sc",
            // Note where the password lives: in the servient, not in the TD.
            { userName: "joe", password: "password_for_joe" }
        );

        expect(whoAmI.UserName).to.eql("joe");
        expect(whoAmI.UserIdentityTokenType).to.eql("UserNameIdentityToken");
        // The two layers really are independent: naming a user secures nothing
        // about the connection carrying that name.
        expect(whoAmI.ChannelSecurityMode).to.eql("None");
    });

    // ------------------------------------------------------------------
    // 4. Both layers - what a production Thing Description looks like
    // ------------------------------------------------------------------
    it("E2E-4 - combo/allOf applies both layers at once", async () => {
        const { whoAmI } = await connectAndAsk(
            {
                channel_sc: {
                    scheme: "uav:channelsec",
                    "uav:securityMode": "SignAndEncrypt",
                    "uav:securityPolicy": "Basic256Sha256",
                },
                user_sc: { scheme: "uav:authentication", "uav:userIdentityToken": "UserName" },
                secure_sc: { scheme: "combo", allOf: ["channel_sc", "user_sc"] },
            },
            "secure_sc",
            { userName: "joe", password: "password_for_joe" }
        );

        expect(whoAmI.ChannelSecurityMode).to.eql("SignAndEncrypt");
        expect(whoAmI.UserName).to.eql("joe");
        expect(whoAmI.UserIdentityTokenType).to.eql("UserNameIdentityToken");
    });

    // ------------------------------------------------------------------
    // 5. Letting the client choose - OPC 10101 6.3.2
    // ------------------------------------------------------------------
    it("E2E-5 - auto picks the strongest channel the server advertises", async () => {
        const { whoAmI } = await connectAndAsk({ auto_sc: { scheme: "auto" } }, "auto_sc");

        // No mode was named; the client asked the server and took the best one.
        expect(whoAmI.ChannelSecurityMode).to.eql("SignAndEncrypt");
        expect(whoAmI.ChannelSecurityPolicyUri).to.not.eql(SecurityPolicy.None);
    });

    // ------------------------------------------------------------------
    // 6. The failure modes. Every one of these used to connect anyway.
    //
    // A binding that ignores what it does not understand connects with its own
    // defaults - no encryption, no user - and reports success. So each case
    // here must raise rather than degrade.
    // ------------------------------------------------------------------
    it("E2E-6 - refuses a UserName scheme when no credentials were registered", async () => {
        await expectRefusal(
            connectAndAsk(
                { user_sc: { scheme: "uav:authentication", "uav:userIdentityToken": "UserName" } },
                "user_sc"
            ),
            /No user name credentials/
        );
    });

    it("E2E-7 - refuses the pre-1.00 scheme name, and says what to write instead", async () => {
        await expectRefusal(
            connectAndAsk(
                {
                    old_sc: {
                        scheme: "uav:channel-security", // the spelling used before OPC 10101 v1.00
                        messageMode: "sign_encrypt",
                        policy: "Basic256Sha256",
                    },
                },
                "old_sc"
            ),
            /uav:channelsec/
        );
    });

    it("E2E-8 - refuses IssuedToken, which the spec defines but node-opcua cannot do", async () => {
        await expectRefusal(
            connectAndAsk(
                { issued_sc: { scheme: "uav:authentication", "uav:userIdentityToken": "IssuedToken" } },
                "issued_sc"
            ),
            /IssuedToken/
        );
    });

    it("E2E-9 - refuses an unknown security mode rather than downgrading it", async () => {
        await expectRefusal(
            connectAndAsk(
                {
                    typo_sc: {
                        scheme: "uav:channelsec",
                        "uav:securityMode": "SignAndEncrypted", // typo
                        "uav:securityPolicy": "Basic256Sha256",
                    },
                },
                "typo_sc"
            ),
            /Invalid security mode/
        );
    });
});
