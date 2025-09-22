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

import { coerceSecurityPolicy, MessageSecurityMode, OPCUAClient, s, SecurityPolicy } from "node-opcua-client";

function getPriority(securityPolicy: string | null, securityMode: MessageSecurityMode): number {
    const encryptWeight = securityMode === MessageSecurityMode.SignAndEncrypt ? 100 : 0;

    switch (securityPolicy) {
        case null:
        case "":
        case "http://opcfoundation.org/UA/SecurityPolicy#None":
            return 0;
        case "http://opcfoundation.org/UA/SecurityPolicy#Basic128":
            return 1 + encryptWeight;
        case "http://opcfoundation.org/UA/SecurityPolicy#Basic192":
            return 2 + encryptWeight;
        case "http://opcfoundation.org/UA/SecurityPolicy#Basic192Rsa15":
            return 3 + encryptWeight;
        case "http://opcfoundation.org/UA/SecurityPolicy#Basic256":
            return 4 + encryptWeight;
        case "http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15":
            return 5 + encryptWeight;
        case "http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256":
            return 6 + encryptWeight;
        case "http://opcfoundation.org/UA/SecurityPolicy#Aes128_Sha256_RsaOaep":
            return 7 + encryptWeight;
        case "http://opcfoundation.org/UA/SecurityPolicy#Aes256_Sha256_RsaPss":
            return 8 + encryptWeight;
        default:
            return -100;
    }
}

function coerceSecurityPolicyUri(securityPolicyUri: string | null): SecurityPolicy {
    switch (securityPolicyUri) {
        case null:
        case "":
        case "http://opcfoundation.org/UA/SecurityPolicy#None":
            return SecurityPolicy.None;
        case "http://opcfoundation.org/UA/SecurityPolicy#Basic128":
            return SecurityPolicy.Basic128;
        case "http://opcfoundation.org/UA/SecurityPolicy#Basic192":
            return SecurityPolicy.Basic192;
        case "http://opcfoundation.org/UA/SecurityPolicy#Basic192Rsa15":
            return SecurityPolicy.Basic192Rsa15;
        case "http://opcfoundation.org/UA/SecurityPolicy#Basic256":
            return SecurityPolicy.Basic256;
        case "http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15":
            return SecurityPolicy.Basic256Rsa15;
        case "http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256":
            return SecurityPolicy.Basic256Sha256;
        case "http://opcfoundation.org/UA/SecurityPolicy#Aes128_Sha256_RsaOaep":
            return SecurityPolicy.Aes128_Sha256_RsaOaep;
        case "http://opcfoundation.org/UA/SecurityPolicy#Aes256_Sha256_RsaPss":
            return SecurityPolicy.Aes256_Sha256_RsaPss;
        default:
            return SecurityPolicy.Invalid;
    }
}

interface EndpointDescriptionMini {
    endpointUrl: string | null;
    securityMode: MessageSecurityMode;
    securityPolicyUri: string | null;
}

async function findMostSecureChannelInternal(client: OPCUAClient): Promise<EndpointDescriptionMini> {
    let endpoints = await client.getEndpoints();

    // sort in descending order of security level
    endpoints = endpoints.sort((a, b) => {
        const securityLevelA = getPriority(a.securityPolicyUri, a.securityMode);
        const securityLevelB = getPriority(b.securityPolicyUri, b.securityMode);
        if (securityLevelA !== securityLevelB) {
            return securityLevelB - securityLevelA;
        }
        // keep original order
        return 0;
    });
    return (
        endpoints[0]! || {
            endpointUrl: null,
            securityMode: MessageSecurityMode.None,
            securityPolicyUri: SecurityPolicy.None,
        }
    );
}

export async function findMostSecureChannel(
    endpointUrl: string
): Promise<{ messageSecurityMode: MessageSecurityMode; securityPolicy: SecurityPolicy }> {
    const client = OPCUAClient.create({
        endpointMustExist: false,
        securityMode: MessageSecurityMode.None,
        securityPolicy: SecurityPolicy.None,
    });
    try {
        await client.connect(endpointUrl);
        const endpoint = await findMostSecureChannelInternal(client);
        const messageSecurityMode = endpoint.securityMode;
        const securityPolicy = coerceSecurityPolicyUri(endpoint.securityPolicyUri);
        return { messageSecurityMode, securityPolicy };
    } finally {
        await client.disconnect();
    }
}
