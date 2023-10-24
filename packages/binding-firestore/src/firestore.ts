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

import { Form } from "@node-wot/td-tools";

export { default as FirestoreServer } from "./firestore-server";
export { default as FirestoreClient } from "./firestore-client";
export { default as FirestoreClientFactory } from "./firestore-client-factory";
export { default as FirestoreCodec } from "./codecs/firestore-codec";
export * from "./firestore-server";
export * from "./firestore-client";
export * from "./firestore-client-factory";

export interface BindingFirestoreConfig {
    hostName?: string;
    firebaseConfig?: {
        apiKey?: string;
        authDomain?: string;
        databaseURL?: string;
        projectId?: string;
        storageBucket?: string;
        messagingSenderId?: string;
    };
    user?: { email?: string; password?: string };
}

export class FirestoreForm extends Form {}
