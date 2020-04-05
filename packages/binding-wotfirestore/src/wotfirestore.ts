/********************************************************************************
 * Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
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

import { Form } from '@node-wot/td-tools'

export { default as WoTFirestoreServer } from './wotfirestore-server'
export { default as WoTFirestoreClient } from './wotfirestore-client'
export {
  default as WoTFirestoreClientFactory
} from './wotfirestore-client-factory'
export * from './wotfirestore-server'
export * from './wotfirestore-client'
export * from './wotfirestore-client-factory'

export interface WoTFirestoreConfig {
  hostName?: string
  firebaseConfig?: {
    apiKey?: string
    authDomain?: string
    databaseURL?: string
    projectId?: string
    storageBucket?: string
    messagingSenderId?: string
  }
  user?: { email?: string; password?: string }
}

export class WoTFirestoreForm extends Form {}
