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
import {
    OPCUACertificateCredentials,
    OPCUAUserNameCredentials,
    OPCUACAuthenticationScheme,
    OPCUAChannelSecurityScheme,
    OPCUACredentials,
    isCertificateCredentials,
    isUserNameCredentials,
} from "./security-scheme";

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
/**
 * Coerces a uav:securityPolicy value into a node-opcua SecurityPolicy.
 * OPC 10101 uses the short names ("Basic256Sha256"); the full policy URI is accepted
 * as an extension, since it is what OPC UA itself puts on the wire.
 */
function coerceSecurityPolicy(policy: string): SecurityPolicy {
    const byName = SecurityPolicy[policy as keyof typeof SecurityPolicy];
    if (byName !== undefined) {
        return byName;
    }
    const byUri = Object.values(SecurityPolicy).find((uri) => uri === policy);
    if (byUri !== undefined) {
        return byUri as SecurityPolicy;
    }
    throw new Error(`Invalid security policy '${policy}'`);
}

export function resolveChannelSecurity(security: OPCUAChannelSecurityScheme): OPCUAChannelSecuritySettings {
    const mode = security["uav:securityMode"];

    // Any value outside the three the specification defines is refused rather than
    // quietly downgraded, which would connect with less security than was asked for.
    if (mode !== "None" && mode !== "Sign" && mode !== "SignAndEncrypt") {
        throw new Error(
            `Invalid security mode '${mode}': expecting one of "None", "Sign" or "SignAndEncrypt" (OPC 10101 6.3.3)`
        );
    }

    if (security.scheme === "uav:channelsec" && mode !== "None") {
        const policy = security["uav:securityPolicy"];
        const securityPolicy = coerceSecurityPolicy(policy as string);

        if (securityPolicy === SecurityPolicy.None) {
            throw new Error(`Security policy 'None' cannot be used with security mode '${mode}'`);
        }

        const messageSecurityMode = mode === "Sign" ? MessageSecurityMode.Sign : MessageSecurityMode.SignAndEncrypt;

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
 * Picks the credentials matching what the authentication scheme asks for.
 *
 * The servient hands credentials over in two different shapes depending on where the
 * security is declared: form-level security goes through `retrieveCredentials()` and
 * yields an array, thing-level security through the deprecated `getCredentials()` and
 * yields a single object. Both are accepted here.
 */
function selectCredentials(
    credentials: unknown,
    matches: (candidate: OPCUACredentials) => boolean
): OPCUACredentials | undefined {
    const candidates = (Array.isArray(credentials) ? credentials : [credentials]) as OPCUACredentials[];
    return candidates.find((candidate) => candidate != null && matches(candidate));
}

/**
 * Resolves the user identity information from the given authentication scheme.
 *
 * The scheme says which kind of identity to use; the identity itself comes from the
 * servient credential store, as OPC 10101 §6.3.3 requires. Will throw if the token
 * type is invalid or if the credentials it needs are missing.
 *
 * @param security The OPC UA authentication scheme.
 * @param credentials The credentials registered for the thing, if any.
 * @returns The resolved user identity information.
 */
export function resolvedUserIdentity(security: OPCUACAuthenticationScheme, credentials?: unknown) {
    let userIdentity: UserIdentityInfo;
    const tokenType = security["uav:userIdentityToken"];
    switch (tokenType) {
        case "UserName": {
            const selected = selectCredentials(credentials, isUserNameCredentials);
            if (selected === undefined) {
                throw new Error(
                    "No user name credentials for this thing: a 'UserName' authentication scheme requires " +
                        "{ userName, password } to be registered with servient.addCredentials(), keyed by the thing id"
                );
            }
            const { userName, password } = selected as OPCUAUserNameCredentials;
            userIdentity = <UserIdentityInfoUserName>{
                type: UserTokenType.UserName,
                password,
                userName,
            };
            break;
        }
        case "Certificate": {
            const selected = selectCredentials(credentials, isCertificateCredentials);
            if (selected === undefined) {
                throw new Error(
                    "No certificate credentials for this thing: a 'Certificate' authentication scheme requires " +
                        "{ certificate, privateKey } to be registered with servient.addCredentials(), keyed by the thing id"
                );
            }
            const { certificate, privateKey } = selected as OPCUACertificateCredentials;
            userIdentity = <UserIdentityInfoX509>{
                type: UserTokenType.Certificate,
                certificateData: convertPEMtoDER(certificate),
                privateKey,
            };
            break;
        }
        case "Anonymous":
            userIdentity = <UserIdentityInfo>{
                type: UserTokenType.Anonymous,
            };
            break;
        case "IssuedToken":
            // Defined by OPC 10101 6.3.3, but node-opcua has no support for issued
            // tokens. Refusing is the only safe answer: falling back to Anonymous
            // would connect with fewer privileges than the author asked for, silently.
            throw new Error("User identity token 'IssuedToken' (uav:issueToken) is not supported yet by this binding");
        default:
            throw new Error(
                `Invalid user identity token '${tokenType}': expecting one of "Anonymous", ` +
                    `"UserName", "Certificate" or "IssuedToken" (OPC 10101 6.3.3)`
            );
    }

    return userIdentity;
}
