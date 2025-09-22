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
import path from "node:path";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import envPath from "env-paths";
import { createLoggers } from "@node-wot/core";

const { debug } = createLoggers("binding-opcua", "opcua-protocol-client");

const env = envPath("binding-opcua", { suffix: "node-wot" });

/**
 * Certificate Manager Singleton for OPCUA Binding in the WoT context.
 *
 */
export class CertificateManagerSingleton {
    private static _certificateManager: OPCUACertificateManager | null = null;

    public static async getCertificateManager(): Promise<OPCUACertificateManager> {
        if (CertificateManagerSingleton._certificateManager) {
            return CertificateManagerSingleton._certificateManager;
        }
        const rootFolder = path.join(env.config, "PKI");
        debug("OPCUA PKI folder", rootFolder);
        const certificateManager = new OPCUACertificateManager({
            rootFolder,
        });
        await certificateManager.initialize();
        certificateManager.referenceCounter++;
        CertificateManagerSingleton._certificateManager = certificateManager;
        return certificateManager;
    }

    public static releaseCertificateManager(): void {
        if (CertificateManagerSingleton._certificateManager) {
            CertificateManagerSingleton._certificateManager.referenceCounter--;
            // dispose is degined to free resources if referenceCounter==0;
            CertificateManagerSingleton._certificateManager.dispose();
            CertificateManagerSingleton._certificateManager = null;
        }
    }
}
