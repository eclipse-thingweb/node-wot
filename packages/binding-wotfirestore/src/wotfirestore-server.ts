/**
 * WoT Firestore Server
 */
import * as os from 'os'

import * as TD from '@node-wot/td-tools'
//import Wot from '@node-wot/browser-bundle'
import { WoTFirestoreConfig, WoTFirestoreForm } from './wotfirestore'
import WoTFirestoreCodec from './codecs/wotfirestore-codec'
import {
  ProtocolServer,
  ExposedThing,
  ContentSerdes,
  Servient,
  Content
} from '@node-wot/core'

import 'firebase/auth'
import 'firebase/firestore'
import {
  initFirestore,
  writeDataToFirestore,
  readDataFromFirestore,
  subscribeToFirestore,
  unsubscribeToFirestore,
  readMetaDataFromFirestore,
  writeMetaDataToFirestore
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
    console.info(`[info] WoT Firestore start`)
    const firestore = await initFirestore(this.fbConfig, null)
    console.info('[info] firebase auth success')
    this.firestore = firestore
    // store servient to get credentials
    this.servient = servient
  }

  public async stop(): Promise<void> {
    console.info(`[info] WoT Firestore stop`)
    for (const key in this.firestoreObservers) {
      console.debug('[debug] unsubscribe: ', key)
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
      `[info] WoTFirestoreServer exposes '${thing.title}' as unique '/${name}/*'`
    )
    this.things.set(name, thing)

    try {
      WoTFirestoreServer.metaData.hostName = this.getHostName()
      if (!WoTFirestoreServer.metaData.things.includes(name)) {
        WoTFirestoreServer.metaData.things.push(name)
        console.debug('[debug] write metaData:', WoTFirestoreServer.metaData)
      }
    } finally {
      await writeMetaDataToFirestore(
        this.firestore,
        this.getHostName(),
        WoTFirestoreServer.metaData
      )
    }

    console.info('[info] setup properties')
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

      thing.setPropertyWriteHandler(propertyName, async (data) => {
        console.debug(
          `[debug] property ${propertyName} changed in server:`,
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
            `[warn] WoTFirestoreServer cannot process data for Property '${propertyName}': ${err.message}`
          )
          // stop to handle writing property
          thing.setPropertyWriteHandler(propertyName, async (data) => {})
          return
        }
        console.debug(`[debug] write property ${propertyName}:`, content)

        if (content && content.body) {
          await writeDataToFirestore(this.firestore, topic, content).catch(
            (err) => {
              console.error(
                `[error] failed to write property (${propertyName}): `,
                err
              )
            }
          )
        }
      })

      thing.setPropertyReadHandler(propertyName, async () => {
        const content = await readDataFromFirestore(this.firestore, topic)
        console.debug(`[debug] read property ${propertyName}:`, content)
        const propertyValue = ContentSerdes.get().contentToValue(
          content,
          <any>thing.properties[propertyName]
        )
        return propertyValue
      })

      if (!name) {
        name = 'no_name'
      }

      let href = this.WOTFIRESTORE_HREF_BASE + topic
      let form = new TD.Form(href, this.DEFAULT_CONTENT_TYPE)
      if (thing.properties[propertyName].readOnly) {
        form.op = ['readproperty']
      } else if (thing.properties[propertyName].writeOnly) {
        form.op = ['writeproperty']
      } else {
        form.op = ['readproperty', 'writeproperty']
      }
      thing.properties[propertyName].forms.push(form)
      console.debug(
        `[debug] WoTFirestoreServer at ${this.WOTFIRESTORE_HREF_BASE} assigns '${href}' to property '${propertyName}'`
      )

      if (thing.properties[propertyName].observable) {
        let href = this.WOTFIRESTORE_HREF_BASE + topic
        let form = new TD.Form(href, this.DEFAULT_CONTENT_TYPE)
        form.op = ['observeproperty', 'unobserveproperty']
        thing.properties[propertyName].forms.push(form)
        console.debug(
          '[binding-http]',
          `HttpServer on port ${this.getPort()} assigns '${href}' to observable Property '${propertyName}'`
        )
      }
      if (thing.properties[propertyName].readOnly === false) {
        subscribeToFirestore(
          this.firestore,
          this.firestoreObservers,
          propertyReceiveTopic,
          (err, content: Content) => {
            if (err) {
              console.error(
                `[error] failed to receive property (${propertyName}): `,
                err
              )
              return
            }
            console.debug(
              `[debug] WoTFirestoreServer at ${this.getHostName()} received message for '${topic}'`
            )

            content.type = this.DEFAULT_CONTENT_TYPE
            let propertyData = ContentSerdes.get().contentToValue(
              content,
              <any>thing.properties[propertyName]
            )
            console.debug(
              `[debug] getting property(${propertyName}) data: `,
              propertyData,
              typeof propertyData
            )
            thing.writeProperty(propertyName, propertyData)
          }
        )
      }
    }

    console.info('[info] setup actions')
    for (let actionName in thing.actions) {
      let topic =
        this.getHostName() +
        '/' +
        encodeURIComponent(name) +
        '/actions/' +
        encodeURIComponent(actionName)
      // Create a topic for writing results.
      let actionResultTopic =
        this.getHostName() +
        '/' +
        encodeURIComponent(name) +
        '/actionResults/' +
        encodeURIComponent(actionName)

      subscribeToFirestore(
        this.firestore,
        this.firestoreObservers,
        topic,
        async (err, content: Content, reqId: string) => {
          if (err) {
            console.error(
              `[error] failed to receive action(${actionName}): `,
              err
            )
            return
          }
          console.debug(
            `[debug] WoTFirestoreServer at ${this.getHostName()} received message for '${topic}'`
          )
          if (thing) {
            let action = thing.actions[actionName]
            let body = content.body
            let params = undefined
            if (body) {
              params = ContentSerdes.get().contentToValue(content, action.input)
            }
            if (action) {
              let output = await thing
                .invokeAction(actionName, params)
                .catch((err) => {
                  console.error(
                    `[error] WoTFirestoreServer at ${this.getHostName()} got error on invoking '${actionName}': ${
                      err.message
                    }`
                  )
                })
              // Firestore cannot return results
              console.warn(
                `[warn] WoTFirestoreServer at ${this.getHostName()} cannot return output '${actionName}'`
              )
              // TODO: How do we find the type of output that is the result of Action?
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
            `[warn] WoTFirestoreServer at ${this.getHostName()} received message for invalid topic '${topic}'`
          )
        }
      )

      let href = this.WOTFIRESTORE_HREF_BASE + topic
      let form = new TD.Form(href, this.DEFAULT_CONTENT_TYPE)
      form.op = ['invokeaction']
      thing.actions[actionName].forms.push(form)
      console.debug(
        `[debug] WoTFirestoreServer at ${this.WOTFIRESTORE_HREF_BASE} assigns '${href}' to Action '${actionName}'`
      )
    }

    console.info('[info] setup events')
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
          let content: Content
          try {
            content = ContentSerdes.get().valueToContent(
              data,
              event.data,
              this.DEFAULT_CONTENT_TYPE
            )
          } catch (err) {
            console.warn(
              `[warn] WoTFirestoreServer on ${this.getHostName()} cannot process data for Event '${eventName}: ${
                err.message
              }'`
            )
            thing.unsubscribeEvent(eventName)
            return
          }
          // send event data
          console.debug(
            `[debug] WoTFirestoreServer at ${this.getHostName()} publishing to Event topic '${eventName}' `
          )
          const value = await writeDataToFirestore(
            this.firestore,
            topic,
            content
          ).catch((err) => {
            console.error(`[error] failed to write event(${eventName})`, err)
          })
        }
      )

      let href = this.WOTFIRESTORE_HREF_BASE + topic
      let form = new TD.Form(href, ContentSerdes.DEFAULT)
      form.op = ['subscribeevent', 'unsubscribeevent']
      event.forms.push(form)
      console.debug(
        `[debug] WoTFirestoreServer at ${this.getHostName()} assigns '${href}' to Event '${eventName}'`
      )
    }

    // Registration of TD
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
    console.log(`**************************************`)
    console.log(`***** exposed thing descriptioon *****`)
    console.log(JSON.stringify(thing.getThingDescription(), null, '  '))
    console.log(`**************************************`)
    console.log(`**************************************`)
  }
}
