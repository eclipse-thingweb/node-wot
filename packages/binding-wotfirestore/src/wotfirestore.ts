import { Form } from '@node-wot/td-tools'

export { default as WoTFirestoreServer } from './wotfirestore-server'
export { default as WoTFirestoreClient } from './wotfirestore-client'
export { default as WoTFirestoreClientFactory } from './wotfirestore-client-factory'
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
