/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
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

/**
 * WoT Firestore client Factory
 */

import { ProtocolClientFactory, ProtocolClient, ContentSerdes, createLoggers } from "@node-wot/core";
import { BindingFirestoreConfig } from "./firestore";
import FirestoreClient from "./firestore-client";
import FirestoreCodec from "./codecs/firestore-codec";

const { warn } = createLoggers("binding-firestore", "firestore-client-factory");

export default class FirestoreClientFactory implements ProtocolClientFactory {
    public readonly scheme: string = "firestore";
    private config: BindingFirestoreConfig | null = null;
    public contentSerdes: ContentSerdes = ContentSerdes.get();
    private firestoreClient: FirestoreClient | null = null;

    constructor(config: BindingFirestoreConfig | null = null) {
        this.config = config;
        this.contentSerdes.addCodec(new FirestoreCodec());
    }

    public getClient(): ProtocolClient {
        warn(`Creating client`);
        if (this.firestoreClient === null) {
            this.firestoreClient = new FirestoreClient(this.config as BindingFirestoreConfig);
        }
        return this.firestoreClient;
    }

    public init(): boolean {
        return true;
    }

    public destroy(): boolean {
        return true;
    }
}
