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

// global W3C WoT Scripting API definitions
import * as TDT from "wot-thing-description-types";
import { SecurityScheme } from "@node-wot/core";
export interface OPCUASecuritySchemeBase extends SecurityScheme, TDT.AdditionalSecurityScheme {
    scheme: "uav:channelsec" | "uav:authentication";
}

export type ValidOPCUASecurityPolicy =
    | "Basic128"
    | "http://opcfoundation.org/UA/SecurityPolicy#Basic128"
    | "Basic192"
    | "http://opcfoundation.org/UA/SecurityPolicy#Basic192"
    | "Basic192Rsa15"
    | "http://opcfoundation.org/UA/SecurityPolicy#Basic192Rsa15"
    | "Basic256Rsa15"
    | "http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15"
    | "Basic256Sha256"
    | "http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256"
    | "Aes128_Sha256_RsaOaep"
    | "http://opcfoundation.org/UASecurityPolicy#Aes128_Sha256_RsaOaep"
    | "Aes256_Sha256_RsaPss"
    | "http://opcfoundation.org/UA/SecurityPolicy#Aes256_Sha256_RsaPss"
    | "PubSub_Aes128_CTR"
    | "http://opcfoundation.org/UA/SecurityPolicy#PubSub_Aes128_CTR"
    | "PubSub_Aes256_CTR"
    | "http://opcfoundation.org/UA/SecurityPolicy#PubSub_Aes256_CTR";
// deprecated  | "Basic128Rsa15" | "http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15"
// deprecated |  "Basic256" | "http://opcfoundation.org/UA/SecurityPolicy#Basic256"

/**
 * A channel security scheme, as defined in OPC 10101 "OPC UA for WoT Binding" §6.3.3.
 */
export interface OPCUASecureSecurityScheme extends OPCUASecuritySchemeBase {
    scheme: "uav:channelsec";
    "uav:securityPolicy": ValidOPCUASecurityPolicy;
    "uav:securityMode": "Sign" | "SignAndEncrypt";
}
export interface OPCUAUnsecureChannelScheme extends OPCUASecuritySchemeBase {
    scheme: "uav:channelsec";
    // OPC 10101 lists uav:securityPolicy as required and allows the value "None",
    // so it is accepted here, but it carries no information when the mode is "None".
    "uav:securityPolicy"?: "None";
    "uav:securityMode": "None";
}

export type OPCUAChannelSecurityScheme = OPCUASecureSecurityScheme | OPCUAUnsecureChannelScheme;

/**
 * An authentication scheme, as defined in OPC 10101 "OPC UA for WoT Binding" §6.3.3.
 *
 * The scheme states *which kind* of identity to use. It never carries the identity
 * itself: §6.3.2 and §6.3.3 both require that credentials be supplied out of band.
 * See {@link OPCUACredentials}.
 *
 * Note: "IssuedToken" (uav:issueToken) is not implemented, as node-opcua does not
 * support issued tokens yet.
 */
export interface OPCUACAuthenticationSchemeBase extends OPCUASecuritySchemeBase {
    scheme: "uav:authentication";
    "uav:userIdentityToken": "UserName" | "Certificate" | "Anonymous" | "IssuedToken";
}

export interface OPCUACUserNameAuthenticationScheme extends OPCUACAuthenticationSchemeBase {
    scheme: "uav:authentication";
    "uav:userIdentityToken": "UserName";
}
export interface OPCUACertificateAuthenticationScheme extends OPCUACAuthenticationSchemeBase {
    scheme: "uav:authentication";
    "uav:userIdentityToken": "Certificate";
}
export interface OPCUAAnonymousAuthenticationScheme extends OPCUACAuthenticationSchemeBase {
    scheme: "uav:authentication";
    "uav:userIdentityToken": "Anonymous";
}
/**
 * Declared for completeness with OPC 10101 6.3.3. Recognised but not usable:
 * node-opcua has no support for issued tokens, so resolving one raises an error
 * rather than falling back to a weaker identity.
 */
export interface OPCUAIssuedTokenAuthenticationScheme extends OPCUACAuthenticationSchemeBase {
    scheme: "uav:authentication";
    "uav:userIdentityToken": "IssuedToken";
    // name of another security scheme in the same thing description, e.g. an oauth2 one
    "uav:issueToken"?: string;
}
export type OPCUACAuthenticationScheme =
    | OPCUAAnonymousAuthenticationScheme
    | OPCUAIssuedTokenAuthenticationScheme
    | OPCUACertificateAuthenticationScheme
    | OPCUACUserNameAuthenticationScheme;

/**
 * Credentials for a "UserName" authentication scheme.
 */
export interface OPCUAUserNameCredentials {
    userName: string;
    password?: string;
}

/**
 * Credentials for a "Certificate" authentication scheme.
 */
export interface OPCUACertificateCredentials {
    // the certificate in PEM format
    //  -----BEGIN CERTIFICATE----
    //  ...
    //  -----END CERTIFICATE-----
    certificate: string;
    // the private key in PEM format that is associated with the certificate
    // For instance
    //  -----BEGIN PRIVATE KEY-----
    //  ...
    //  -----END PRIVATE KEY-----
    privateKey?: string;
}

/**
 * Credentials for an OPC UA thing.
 *
 * OPC 10101 §6.3.2 and §6.3.3 state that "login credentials such as user name and
 * passwords or certificates are not shared in WoT Thing Descriptions and must be
 * provided separately". They are therefore supplied through the servient, keyed by
 * the thing id:
 *
 * ```js
 * servient.addCredentials({ "urn:my-thing": { userName: "joe", password: "secret" } });
 * ```
 */
export type OPCUACredentials = OPCUAUserNameCredentials | OPCUACertificateCredentials;

export function isUserNameCredentials(credentials: OPCUACredentials): credentials is OPCUAUserNameCredentials {
    return (credentials as OPCUAUserNameCredentials).userName !== undefined;
}

export function isCertificateCredentials(credentials: OPCUACredentials): credentials is OPCUACertificateCredentials {
    return (credentials as OPCUACertificateCredentials).certificate !== undefined;
}
