/**
 * Firestore client
 */
import { ProtocolClient, Content } from '@node-wot/core'
import { WoTFirestoreForm, WoTFirestoreConfig } from './wotfirestore'
import { v4 as uuidv4 } from 'uuid'

import 'firebase/auth'
import 'firebase/firestore'
import {
  initFirestore,
  writeDataToFirestore,
  readDataFromFirestore,
  subscribeFromFirestore,
  unsubscribeFromFirestore
} from './wotfirestore-handler'
import * as TD from '@node-wot/td-tools'

export default class WoTFirestoreClient implements ProtocolClient {
  private firestore = null
  private firestoreObservers = {}
  private fbConfig = null

  constructor(config: WoTFirestoreConfig = null) {
    if (typeof config !== 'object') {
      throw new Error(
        `WoTFirestore requires config object (got ${typeof config})`
      )
    }
    this.fbConfig = config
  }

  public toString(): string {
    return `[WoTFirestoreClient]`
  }

  private makePointerInfo(
    form: WoTFirestoreForm
  ): {
    hostName: string
    name: string
    topic: string
    type: string
    resource: string
  } {
    const splittedHref = form.href.split('://')
    const paths = splittedHref[1].split('/')
    const hostName = paths[0]
    const name = paths[1]
    let type = paths[2]
    if (type === undefined) {
      type = 'td'
    }
    const resource = paths[3]
    const topic = splittedHref[1]
    const ret = {
      hostName: hostName,
      name: name,
      topic: topic,
      type: type,
      resource: resource
    }
    return ret
  }

  public async readResource(form: WoTFirestoreForm): Promise<Content> {
    const firestore = await initFirestore(this.fbConfig, this.firestore)
    this.firestore = firestore
    const pointerInfo = this.makePointerInfo(form)
    const content = await readDataFromFirestore(
      this.firestore,
      pointerInfo.topic
    )
    return content
  }

  public async writeResource(
    form: WoTFirestoreForm,
    content: Content
  ): Promise<any> {
    const pointerInfo = this.makePointerInfo(form)
    const firestore = await initFirestore(this.fbConfig, this.firestore)
    this.firestore = firestore
    let splittedTopic = pointerInfo.topic.split('/')
    if (splittedTopic && splittedTopic[2] === 'properties') {
      splittedTopic[2] = 'propertyReceives'
      pointerInfo.topic = splittedTopic.join('/')
    }
    const value = await writeDataToFirestore(
      this.firestore,
      pointerInfo.topic,
      content
    )
    return value
  }

  public async invokeResource(
    form: WoTFirestoreForm,
    content?: Content
  ): Promise<Content> {
    const firestore = await initFirestore(this.fbConfig, this.firestore)
    this.firestore = firestore
    // Firestoreの該当箇所にActionの内容を記述する
    const pointerInfo = this.makePointerInfo(form)
    // subscrbe for results
    const actionResultTopic =
      pointerInfo.hostName +
      '/' +
      encodeURIComponent(pointerInfo.name) +
      '/actionResults/' +
      encodeURIComponent(pointerInfo.resource)
    const reqId = uuidv4()
    let timeoutId
    const retContent: Content = await new Promise((resolve, reject) => {
      subscribeFromFirestore(
        this.firestore,
        this.firestoreObservers,
        actionResultTopic,
        (err, content, resId) => {
          console.debug('[debug] return action and unsubscribe')
          console.debug(`[debug] reqId ${reqId}, resId ${resId}`)
          if (reqId !== resId) {
            // reqIdが一致しないため無視
            return
          }
          unsubscribeFromFirestore(this.firestoreObservers, actionResultTopic)
          clearTimeout(timeoutId)
          if (err) {
            console.error('[error] failed to get action result:', err)
            reject(err)
          } else {
            resolve(content)
          }
        }
      )
      timeoutId = setTimeout(() => {
        unsubscribeFromFirestore(this.firestoreObservers, actionResultTopic)
        reject(new Error(`timeout error topic: ${pointerInfo.topic}`))
      }, 10 * 1000) // timeout判定
      // if not input was provided, set up an own body otherwise take input as body
      if (content !== undefined) {
        // アクション実行(結果は上記のCallbackに返る)
        writeDataToFirestore(this.firestore, pointerInfo.topic, content, reqId)
      } else {
        // アクション実行(結果は上記のCallbackに返る)
        writeDataToFirestore(
          this.firestore,
          pointerInfo.topic,
          {
            body: undefined,
            type: ''
          },
          reqId
        )
      }
    })
    return retContent
  }

  public async unlinkResource(form: WoTFirestoreForm): Promise<any> {
    const firestore = await initFirestore(this.fbConfig, this.firestore)
    this.firestore = firestore
    const pointerInfo = this.makePointerInfo(form)
    unsubscribeFromFirestore(this.firestoreObservers, pointerInfo.topic)
  }

  public subscribeResource(
    form: WoTFirestoreForm,
    next: (value: any) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): any {
    const pointerInfo = this.makePointerInfo(form)
    // subscrbe for results
    initFirestore(this.fbConfig, this.firestore)
      .then((firestore) => {
        this.firestore = firestore
        subscribeFromFirestore(
          this.firestore,
          this.firestoreObservers,
          pointerInfo.topic,
          (err, content) => {
            if (err) {
              console.error('[error] failed to subscribe resource: ', err)
              error(err)
            } else {
              next(content)
            }
          }
        )
      })
      .catch((err) => {
        console.error('[error] failed to init firestore: ', err)
        error(err)
      })
  }

  public start(): boolean {
    return true
  }

  public stop(): boolean {
    return true
  }

  public setSecurity(
    metadata: Array<TD.SecurityScheme>,
    credentials?: any
  ): boolean {
    // Firestoreにより通信路のセキュリティは確保
    // 今後Thing毎にセキュリティ設定できるように対応予定
    return true
  }
}
