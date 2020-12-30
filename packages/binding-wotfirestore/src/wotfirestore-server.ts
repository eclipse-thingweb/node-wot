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

/**
 * WoT Firestore Server
 */
import * as os from 'os'

import * as TD from '@node-wot/td-tools'
import Servient, {
  ProtocolServer,
  ContentSerdes,
  ExposedThing,
  Helpers,
  Content,
} from '@node-wot/core'
import { WoTFirestoreConfig, WoTFirestoreForm } from './wotfirestore'
import WoTFirestoreCodec from './codecs/wotfirestore-codec'

import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/firestore'
import {
  initFirestore,
  writeDataToFirestore,
  readDataFromFirestore,
  subscribeFromFirestore,
  unsubscribeFromFirestore,
  readMetaDataFromFirestore,
  writeMetaDataToFirestore,
} from './wotfirestore-handler'

export default class WoTFirestoreServer implements ProtocolServer {
  public readonly scheme: 'wotfirestore'
  private readonly things: Map<string, ExposedThing> = new Map<
    string,
    ExposedThing
  >()
  private servient: Servient = null
  private contentSerdes: ContentSerdes = ContentSerdes.get()

  private WOTFIRESTORE_HREF_BASE = 'wotfirestore://'
  private DEFAULT_CONTENT_TYPE = 'application/wotfirestore'

  private firestore = null
  private firestoreObservers = {}

  private static metaData = { hostName: '', things: [] }

  private fbConfig = null

  constructor(config: WoTFirestoreConfig = {}) {
    this.contentSerdes.addCodec(new WoTFirestoreCodec(), true)
    if (typeof config !== 'object') {
      throw new Error(
        `WoTFirestoreServer requires config object (got ${typeof config})`
      )
    }
    this.fbConfig = config
  }

  public async start(servient: Servient): Promise<void> {
    console.info(`WoT Firestore start`)
    const firestore = await initFirestore(this.fbConfig, null)
    console.log('firebase auth success')
    this.firestore = firestore
    // store servient to get credentials
    this.servient = servient
  }

  public async stop(): Promise<void> {
    console.info(`WoT Firestore stop`)
    for (const key in this.firestoreObservers) {
      console.info('unsubscribe: ', key)
      this.firestoreObservers[key]()
    }
  }

  public getHostName(): string {
    return this.fbConfig.hostName || process.env.WoTHostName || os.hostname()
  }

  public getPort(): number {
    return -1
  }

  public async expose(thing: ExposedThing): Promise<void> {
    if (this.firestore === undefined) {
      return
    }

    let name = thing.title

    if (this.things.has(name)) {
      let suffix = name.match(/.+_([0-9]+)$/)
      if (suffix !== null) {
        name = name.slice(0, -suffix[1].length) + (1 + parseInt(suffix[1]))
      } else {
        name = name + '_2'
      }
    }

    console.info(
      `WoTFirestoreServer exposes '${thing.title}' as unique '/${name}/*'`
    )
    // console.log('************** thing:', thing)
      // TODO clean-up on destroy and stop
      this.things.set(name, thing)

      try {
        WoTFirestoreServer.metaData.hostName = this.getHostName()
        if (!WoTFirestoreServer.metaData.things.includes(name)) {
          WoTFirestoreServer.metaData.things.push(name)
          console.log(
            '+++++++++++++++ pushed metaData:',
            WoTFirestoreServer.metaData
          )
        }
      } finally {
        await writeMetaDataToFirestore(
          this.firestore,
          this.getHostName(),
          WoTFirestoreServer.metaData
        )
        console.log(
          '+++++++++++++++ write metaData:',
          WoTFirestoreServer.metaData
        )
      }

      console.info('setup properties')
      for (let propertyName in thing.properties) {
        let topic =
          this.getHostName() +
          '/' +
          encodeURIComponent(name) +
          '/properties/' +
          encodeURIComponent(propertyName)
        let propertyReceiveTopic =
          this.getHostName() +
          '/' +
          encodeURIComponent(name) +
          '/propertyReceives/' +
          encodeURIComponent(propertyName)
        let property = thing.properties[propertyName]
        console.info('  properties topic:', topic)

        thing.observeProperty(
          propertyName,
          //let subscription = property.subscribe(
          async (data) => {
            console.debug(
              `***** property ${propertyName} changed in server:`,
              data
            )
            let content: Content
            try {
              content = ContentSerdes.get().valueToContent(
                data,
                <any>property,
                this.DEFAULT_CONTENT_TYPE
              )
            } catch (err) {
              console.warn(
                `WoTFirestoreServer cannot process data for Property '${propertyName}': ${err.message}`
              )
              thing.unobserveProperty(propertyName)
              return
            }
            console.debug(`***** write property ${propertyName}:`, content)

            if (content && content.body) {
              console.debug('write:', content)
              await writeDataToFirestore(this.firestore, topic, content)
              .catch((err) => {
                console.error('write err:', err)
              })
            }
          }
        )
        if (!name) {
          name = 'no_name'
        }
        const data = await thing.readProperty(propertyName)
        console.debug(`***** write initial property ${propertyName}:`, data)
        let content: Content = {
          type: this.DEFAULT_CONTENT_TYPE,
          body: undefined,
        }
        if (data !== null || data !== undefined) {
          content = ContentSerdes.get().valueToContent(
            data,
            <any>property,
            this.DEFAULT_CONTENT_TYPE
          )
        }
        await writeDataToFirestore(this.firestore, topic, content)

        let href = this.WOTFIRESTORE_HREF_BASE + topic
        let form = new TD.Form(href, this.DEFAULT_CONTENT_TYPE)
        form.op = ['observeproperty', 'unobserveproperty']

        thing.properties[propertyName].forms.push(form)
        console.log(
          `WoTFirestoreServer at ${this.WOTFIRESTORE_HREF_BASE} assigns '${href}' to property '${propertyName}'`
        )
        // TODO: Clientで値が変えられた場合に対応する
        if (thing.properties[propertyName].readOnly === false) {
          subscribeFromFirestore(
            this.firestore,
            this.firestoreObservers,
            propertyReceiveTopic,
            (err, content: Content) => {
              if (err) {
                console.error('[error] receive property :', err)
                return
              }
              console.log(
                `WoTFirestoreServer at ${this.getHostName()} received message for '${topic}'`
              )

              content.type = this.DEFAULT_CONTENT_TYPE
              let propertyData = ContentSerdes.get().contentToValue(
                content,
                <any>thing.properties[propertyName]
              )
              console.log(
                '********************* contentToValue',
                propertyData,
                typeof propertyData
              )
              thing.writeProperty(propertyName, propertyData)
            }
          )
        }
      }

      console.info('setup actions')
      for (let actionName in thing.actions) {
        let topic =
          this.getHostName() +
          '/' +
          encodeURIComponent(name) +
          '/actions/' +
          encodeURIComponent(actionName)
        // 結果書き込み用のトピックを作る
        let actionResultTopic =
          this.getHostName() +
          '/' +
          encodeURIComponent(name) +
          '/actionResults/' +
          encodeURIComponent(actionName)

        subscribeFromFirestore(
          this.firestore,
          this.firestoreObservers,
          topic,
          async (err, content: Content, reqId: string) => {
            if (err) {
              console.error('[error] receive action :', err)
              return
            }
            console.log(
              `WoTFirestoreServer at ${this.getHostName()} received message for '${topic}'`
            )
            if (thing) {
              let action = thing.actions[actionName]
              let body = content.body
              let params = undefined
              if (body) {
                params = ContentSerdes.get().contentToValue(
                  content,
                  action.input
                )
              }
              if (action) {
                console.debug('invoke:', action)
                let output = await thing
                  .invokeAction(actionName, params)
                  .catch((err) => {
                    console.error(
                      `WoTFirestoreServer at ${this.getHostName()} got error on invoking '${actionName}': ${
                        err.message
                      }`
                    )
                    // TODO: Actionの結果であるerror outputの型をどのように求めるか？
                    /*                    writeDataToFirestore(
                      this.firestore,
                      actionResultTopic,
                      err.message
                    )
                      .then(value => {})
                      .catch(err => {})*/
                  })

                console.debug('invoke then:', output)
                // Firestore cannot return results
                console.warn(
                  `WoTFirestoreServer at ${this.getHostName()} cannot return output '${actionName}'`
                )
                // TODO: Actionの結果であるoutputの型をどのように求めるか？
                if (!output) {
                  output = ''
                }
                let outContent: Content = ContentSerdes.get().valueToContent(
                  output,
                  action.output,
                  this.DEFAULT_CONTENT_TYPE
                )

                await writeDataToFirestore(
                  this.firestore,
                  actionResultTopic,
                  outContent,
                  reqId
                ).catch((err) => {})
                // topic found and message processed
                return
              }
            } // Thing exists?
            console.warn(
              `WoTFirestoreServer at ${this.getHostName()} received message for invalid topic '${topic}'`
            )
          }
        )

        let href = this.WOTFIRESTORE_HREF_BASE + topic
        let form = new TD.Form(href, this.DEFAULT_CONTENT_TYPE)
        form.op = ['invokeaction']
        thing.actions[actionName].forms.push(form)
        console.log(
          `WoTFirestoreServer at ${this.WOTFIRESTORE_HREF_BASE} assigns '${href}' to Action '${actionName}'`
        )
      }

      console.info('setup events')
      for (let eventName in thing.events) {
        let topic =
          this.getHostName() +
          '/' +
          encodeURIComponent(name) +
          '/events/' +
          encodeURIComponent(eventName)
        let event = thing.events[eventName]
        // FIXME store subscription and clean up on stop
        thing.subscribeEvent(
          eventName,
          //let subscription = event.subscribe(
          async (data) => {
            console.log('*** event.subscribe:', data)
            console.log('*** eventName:', eventName)
            let content: Content
            try {
              content = ContentSerdes.get().valueToContent(
                data,
                event.data,
                this.DEFAULT_CONTENT_TYPE
              )
            } catch (err) {
              console.warn(
                `WoTFirestoreServer on ${this.getHostName()} cannot process data for Event '${eventName}: ${
                  err.message
                }'`
              )
              thing.unsubscribeEvent(eventName)
              return
            }
            // send event data
            console.log(
              `WoTFirestoreServer at ${this.getHostName()} publishing to Event topic '${eventName}' `
            )
            const value = await writeDataToFirestore(this.firestore, topic, content)
              .catch((err) => {
                console.error('error:', err)
              })
          }
        )

        let href = this.WOTFIRESTORE_HREF_BASE + topic
        let form = new TD.Form(href, ContentSerdes.DEFAULT)
        form.op = ['subscribeevent', 'unsubscribeevent']
        event.forms.push(form)
        console.log(
          `WoTFirestoreServer at ${this.getHostName()} assigns '${href}' to Event '${eventName}'`
        )
      }

      // TDの登録
      let tdContent: Content = ContentSerdes.get().valueToContent(
        JSON.stringify(thing.getThingDescription()),
        null,
        'application/td+json'
      )
      await writeDataToFirestore(
        this.firestore,
        `${this.getHostName()}/${name}`,
        tdContent
      )
  }
}
