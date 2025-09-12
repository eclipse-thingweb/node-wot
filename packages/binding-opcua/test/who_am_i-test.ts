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
import { expect } from "chai";
import debug from "debug";
import { OPCUAServer } from "node-opcua";

import {
    IBasicSessionCallAsync,
    MessageSecurityMode,
    ObjectIds,
    OPCUAClient,
    SecurityPolicy,
    UserIdentityInfo,
    UserTokenType,
} from "node-opcua-client";
import { startServer } from "./fixture/basic-opcua-server";

interface WhoAmIResult {
    userName?: string;
    userIdentityTokenType?: string;
    securityMode?: string;
    securityPolicy?: string;
    err?: Error;
}
async function _whoAmI(session: IBasicSessionCallAsync): Promise<WhoAmIResult> {
    const result = await session.call({
        objectId: ObjectIds.Server,
        methodId: "ns=1;s=WhoAmI",
    });
    debug(result.toString());
    const userName = result?.outputArguments?.[0].value as string;
    const userIdentityTokenType = result?.outputArguments?.[1].value as string;
    const securityMode = result?.outputArguments?.[2].value as string;
    const securityPolicy = result?.outputArguments?.[3].value as string;
    const retVal = { userName, userIdentityTokenType, securityMode, securityPolicy };
    return retVal;
}

async function whoAmI(
    endpoint: string,
    securityMode: MessageSecurityMode,
    securityPolicy: SecurityPolicy,
    userIdentity: UserIdentityInfo
): Promise<WhoAmIResult> {
    const client = OPCUAClient.create({
        endpointMustExist: false,
        securityMode,
        securityPolicy,
    });
    try {
        await client.connect(endpoint);
        const session = await client.createSession(userIdentity);
        try {
            const result = await _whoAmI(session);
            return result;
        } finally {
            await session.close();
        }
    } catch (err) {
        return { err: err as Error };
    } finally {
        await client.disconnect();
    }
}

describe("WhoAmI Method", function () {
    this.timeout(20000);

    let opcuaServer: OPCUAServer;
    let endpoint: string;
    before(async () => {
        opcuaServer = await startServer();
        endpoint = opcuaServer.getEndpointUrl();
        debug(`endpoint = ${endpoint}`);
    });
    after(async () => {
        await opcuaServer.shutdown();
    });

    it("should return correct info for anonymous session", async () => {
        const result = await whoAmI(endpoint, MessageSecurityMode.None, SecurityPolicy.None, {
            type: UserTokenType.Anonymous,
        });

        expect(result.err).eql(undefined);
        expect(result.userName).to.eql(null);
        expect(result.userIdentityTokenType).to.eql("AnonymousIdentityToken");
        expect(result.securityMode).to.eql("None");
        expect(result.securityPolicy).to.eql("http://opcfoundation.org/UA/SecurityPolicy#None");
    });

    it("should return correct info for user/password session", async () => {
        const result = await whoAmI(endpoint, MessageSecurityMode.None, SecurityPolicy.None, {
            type: UserTokenType.UserName,
            userName: "joe",
            password: "password_for_joe",
        });

        expect(result.err).to.eql(undefined);
        expect(result.userName).to.eql("joe");
        expect(result.userIdentityTokenType).to.eql("UserNameIdentityToken");
        expect(result.securityMode).to.eql("None");
        expect(result.securityPolicy).to.eql("http://opcfoundation.org/UA/SecurityPolicy#None");
    });
    it("should return correct info for user/password session with Sign security", async () => {
        const result = await whoAmI(endpoint, MessageSecurityMode.Sign, SecurityPolicy.Basic256Sha256, {
            type: UserTokenType.UserName,
            userName: "admin",
            password: "password_for_admin",
        });

        expect(result.err).to.eql(undefined);
        expect(result.userName).to.eql("admin");
        expect(result.userIdentityTokenType).to.eql("UserNameIdentityToken");
        expect(result.securityMode).to.eql("Sign");
        expect(result.securityPolicy).to.eql("http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256");
    });
});
