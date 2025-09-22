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
import {
    MessageSecurityMode,
    SecurityPolicy,
    UserIdentityInfo,
    UserIdentityInfoUserName,
    UserIdentityInfoX509,
    UserTokenType,
} from "node-opcua-client";
import { convertPEMtoDER } from "node-opcua-crypto";
import { OPCUACAuthenticationScheme, OPCUAChannelSecurityScheme } from "./security_scheme";

export interface OPCUAChannelSecuritySettings {
    securityPolicy: SecurityPolicy;
    messageSecurityMode: MessageSecurityMode;
}

/**
 * Resolves the channel security settings from the given security scheme.
 * Will throw an error if the policy or message mode is invalid.
 * @param security The OPC UA channel security scheme.
 * @returns The resolved channel security settings.
 */
export function resolveChannelSecurity(security: OPCUAChannelSecurityScheme): OPCUAChannelSecuritySettings {
    if (security.scheme === "uav:channel-security" && security.messageMode !== "none") {
        const securityPolicy: SecurityPolicy = SecurityPolicy[security.policy as keyof typeof SecurityPolicy];

        if (securityPolicy === undefined) {
            throw new Error(`Invalid security policy '${security.policy}'`);
        }

        let messageSecurityMode: MessageSecurityMode = MessageSecurityMode.Invalid;
        switch (security.messageMode) {
            case "sign":
                messageSecurityMode = MessageSecurityMode.Sign;
                break;
            case "sign_encrypt":
                messageSecurityMode = MessageSecurityMode.SignAndEncrypt;
                break;
            default:
                messageSecurityMode = MessageSecurityMode.None;
                break;
        }

        return {
            securityPolicy,
            messageSecurityMode,
        };
    } else {
        return {
            securityPolicy: SecurityPolicy.None,
            messageSecurityMode: MessageSecurityMode.None,
        };
    }
}

/**
 * Resolves the user identity information from the given authentication scheme.
 * Will throw an error if the token type is invalid.
 * @param security The OPC UA authentication scheme.
 * @returns The resolved user identity information.
 */
export function resolvedUserIdentity(security: OPCUACAuthenticationScheme) {
    let userIdentity: UserIdentityInfo;
    switch (security.tokenType) {
        case "username":
            userIdentity = <UserIdentityInfoUserName>{
                type: UserTokenType.UserName,
                password: security.password,
                userName: security.userName,
            };
            break;
        case "certificate":
            userIdentity = <UserIdentityInfoX509>{
                type: UserTokenType.Certificate,
                certificateData: convertPEMtoDER(security.certificate),
                privateKey: security.privateKey,
            };
            break;
        case "anonymous":
        default:
            // it is OK to use anonymous as default,
            // as it provides the lowest privileges
            userIdentity = <UserIdentityInfo>{
                type: UserTokenType.Anonymous,
            };
            break;
    }

    return userIdentity;
}
