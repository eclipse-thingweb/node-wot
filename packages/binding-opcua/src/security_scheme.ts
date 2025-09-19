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
    scheme: "uav:channel-security" | "uav:authentication";
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
 *
 */
export interface OPCUASecureSecurityScheme extends OPCUASecuritySchemeBase {
    scheme: "uav:channel-security";
    policy: ValidOPCUASecurityPolicy;
    messageMode: "sign" | "sign_encrypt";
}
export interface OPCUAUnsecureChannelScheme extends OPCUASecuritySchemeBase {
    scheme: "uav:channel-security";
    policy: never;
    messageMode: "none";
}

export type OPCUAChannelSecurityScheme = OPCUASecureSecurityScheme | OPCUAUnsecureChannelScheme;
export interface OPCUACAuthenticationSchemeBase extends OPCUASecuritySchemeBase {
    scheme: "uav:authentication";
    tokenType: "username" | "certificate" | "anonymous";
}

export interface OPCUACUserNameAuthenticationScheme extends OPCUACAuthenticationSchemeBase {
    scheme: "uav:authentication";
    tokenType: "username";
    userName: string;
    password?: string;
}
export interface OPCUACertificateAuthenticationScheme extends OPCUACAuthenticationSchemeBase {
    scheme: "uav:authentication";
    tokenType: "certificate";
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
export interface OPCUAAnonymousAuthenticationScheme extends OPCUACAuthenticationSchemeBase {
    scheme: "uav:authentication";
    tokenType: "anonymous";
}
export type OPCUACAuthenticationScheme =
    | OPCUAAnonymousAuthenticationScheme
    | OPCUACertificateAuthenticationScheme
    | OPCUACUserNameAuthenticationScheme;
