/**
 * WoTFirestore client Factory
 */

import {
  ProtocolClientFactory,
  ProtocolClient,
  ContentSerdes
} from '@node-wot/core'
import { WoTFirestoreConfig } from './wotfirestore'
import WoTFirestoreClient from './wotfirestore-client'
import WoTFirestoreCodec from './codecs/wotfirestore-codec'

export default class WoTFirestoreClientFactory
  implements ProtocolClientFactory {
  public readonly scheme: string = 'wotfirestore'
  private config: WoTFirestoreConfig = null
  public contentSerdes: ContentSerdes = ContentSerdes.get()
  private wotFirestoreClient = null

  constructor(config: WoTFirestoreConfig = null) {
    this.config = config
    this.contentSerdes.addCodec(new WoTFirestoreCodec())
  }

  public getClient(): ProtocolClient {
    console.warn(`[warn] firebaseClientFactory creating client`)
    if (this.wotFirestoreClient === null) {
      this.wotFirestoreClient = new WoTFirestoreClient(this.config)
    }
    return this.wotFirestoreClient
  }

  public init(): boolean {
    return true
  }

  public destroy(): boolean {
    return true
  }
}
