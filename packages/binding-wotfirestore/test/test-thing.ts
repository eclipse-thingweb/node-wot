// test-thing.ts
import Servient from '@node-wot/core'
import WoTFirestoreServer from '../src/wotfirestore-server'
import WoTFirestoreCodec from '../src/codecs/wotfirestore-codec'
import firebase from 'firebase'

const wotfirestoreConfig = require('./wotfirestore-config.json')

export const launchTestThing = async () => {
  // setup for emulator
  try {
    //process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8088'
    firebase.initializeApp(wotfirestoreConfig.firebaseConfig)
    const isEmulating = true
    if (isEmulating) {
      firebase.auth().useEmulator('http://localhost:9099')
      //firebase.firestore().useEmulator('localhost', 8088)
      firebase.firestore().settings({
        host: 'localhost:8088',
        ssl: false
      })
      try {
        // add test user
        await firebase
          .auth()
          .createUserWithEmailAndPassword(
            wotfirestoreConfig.user.email,
            wotfirestoreConfig.user.password
          )
      } catch (e) {
        // is not error
        console.log('user ia already created err: ', e)
      }
    }
    // create server
    const server = new WoTFirestoreServer(wotfirestoreConfig)

    // create Servient add Firebase binding
    let servient = new Servient()
    servient.addServer(server)

    const codec = new WoTFirestoreCodec()
    servient.addMediaType(codec)

    const WoT = await servient.start()

    // init property values
    let objectProperty = { testNum: 0, testStr: 'abc' };
    let stringProperty = '';
    let integerProperty = 0;

    const thing = await WoT.produce({
      title: 'test-thing',
      description: 'thing for test',
      '@context': [
        'https://www.w3.org/2019/wot/td/v1',
        { iot: 'http://example.org/iot' }
      ],
      properties: {
        objectProperty: {
          type: 'object',
          description: 'object property',
          observable: true,
          readOnly: false
        },
        stringProperty: {
          type: 'string',
          description: 'string property',
          observable: true,
          readOnly: false
        },
        integerProperty: {
          type: 'integer',
          description: 'integer property',
          observable: true,
          readOnly: false
        }
      },
      actions: {
        actionWithoutArgsResponse: {
          input: {},
          output: {},
          description: 'action without args and without response'
        },
        actionNum: {
          input: {
            type: 'number'
          },
          output: {
            type: 'number'
          },
          description: 'action about number'
        },
        actionString: {
          input: {
            type: 'string'
          },
          output: {
            type: 'string'
          },
          description: 'action about string'
        },
        actionObject: {
          input: {
            type: 'object'
          },
          output: {
            type: 'object'
          },
          description: 'action about object'
        },
        actionStringToObj: {
          input: {
            type: 'string'
          },
          output: {
            type: 'object'
          },
          description: 'action string to object'
        },
        actionObjToNum: {
          input: {
            type: 'object'
          },
          output: {
            type: 'number'
          },
          description: 'action object to number'
        },
        actionEventInteger: {
          input: {
            type: 'integer'
          },
          output: {},
          description: 'action event integer'
        },
        actionEventString: {
          input: { type: 'string' },
          output: {},
          description: 'action event integer'
        },
        actionEventObject: {
          input: { type: 'object' },
          output: {},
          description: 'action event integer'
        }
      },
      events: {
        eventInteger: {
          data: {
            type: 'integer'
          },
          description: 'event with integer'
        },
        eventString: {
          data: {
            type: 'string'
          },
          description: 'event with string'
        },
        eventObject: {
          data: {
            type: 'object'
          },
          description: 'event with object'
        }
      }
    })
    // expose the thing
    await thing.expose()

    //@ts-ignore
    console.log('Produced ' + thing.getThingDescription().title)

		// set property handlers (using async-await)
		thing.setPropertyReadHandler("objectProperty", async () => objectProperty);
		thing.setPropertyReadHandler("stringProperty", async () => stringProperty);
    thing.setPropertyReadHandler("integerProperty", async () => integerProperty);

    // set action handlers
    thing.setActionHandler(
      'actionWithoutArgsResponse',
      function (params, options) {
        return new Promise(function (resolve, reject) {
          console.log('actionWithoutArgsResponse', params, options)
          resolve(thing)
        })
      }
    )
    thing.setActionHandler('actionNum', function (params, options) {
      return new Promise(function (resolve, reject) {
        console.log('actionNum', params, options)
        resolve(params)
      })
    })
    thing.setActionHandler('actionString', function (params, options) {
      return new Promise(function (resolve, reject) {
        console.log('actionString', params, options)
        resolve(params)
      })
    })
    thing.setActionHandler('actionObject', function (params, options) {
      return new Promise(function (resolve, reject) {
        console.log('actionObject', params, options)
        resolve(params)
      })
    })
    thing.setActionHandler('actionStringToObj', function (params, options) {
      return new Promise(function (resolve, reject) {
        console.log('actionStringToObj', params, options)
        resolve({ test: params })
      })
    })
    thing.setActionHandler('actionObjToNum', function (params, options) {
      return new Promise(function (resolve, reject) {
        console.log('actionObjToNum', params, options)
        resolve(1)
      })
    })
    // actions for event
    thing.setActionHandler('actionObject', function (params, options) {
      return new Promise(function (resolve, reject) {
        console.log('actionObject', params, options)
        resolve(params)
      })
    })
    thing.setActionHandler('actionStringToObj', function (params, options) {
      return new Promise(function (resolve, reject) {
        console.log('actionStringToObj', params, options)
        resolve({ test: params })
      })
    })
    thing.setActionHandler('actionObjToNum', function (params, options) {
      return new Promise(function (resolve, reject) {
        console.log('actionObjToNum', params, options)
        resolve(1)
      })
    })
    thing.setActionHandler('actionEventInteger', function (params, options) {
      return new Promise(function (resolve, reject) {
        console.log('actionEventInteger', params, options)
        thing.emitEvent('eventInteger', params)
        resolve(thing)
      })
    })
    thing.setActionHandler('actionEventString', function (params, options) {
      return new Promise(function (resolve, reject) {
        console.log('actionEventString', params, options)
        thing.emitEvent('eventString', params)
        resolve(thing)
      })
    })
    thing.setActionHandler('actionEventObject', function (params, options) {
      return new Promise(function (resolve, reject) {
        console.log('actionEventObject', params, options)
        thing.emitEvent('eventObject', params)
        resolve(thing)
      })
    })

    console.info(thing.getThingDescription().title + ' ready')
    return thing
  } catch (err) {
    console.log(err)
  }
}
