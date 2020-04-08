import { Content } from '@node-wot/core'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/firestore'
import { Buffer } from 'buffer'

/**
 * firestoreを初期化する。
 * fstoreがnullの場合でのみ初期化処理を実施する。
 */
export const initFirestore = async (fbConfig, fstore): Promise<any> => {
  return new Promise<any>((resolve, reject) => {
    if (fstore != null) {
      resolve(fstore)
      return
    }
    if (!firebase.apps.length) {
      // 初期化されていない場合のみ初期化する
      firebase.initializeApp(fbConfig.firebaseConfig)
    }
    // Sign In
    firebase
      .auth()
      .signInWithEmailAndPassword(fbConfig.user.email, fbConfig.user.password)
      .then(() => {
        const firestore = firebase.firestore()
        resolve(firestore)
      })
      .catch(function(error) {
        reject(`firebase auth error: ${error}`)
      })
  })
}

/**
 *
 * @param type td | properties | actions | events
 * @param thingName
 * @param topic
 * @param content
 * @param contentType
 */
export const writeDataToFirestore = (
  firestore,
  topic: string,
  content: Content,
  reqId = null
): Promise<any> => {
  return new Promise((resolve, reject) => {
    console.debug('    writeDataToFirestore topic:', topic, ' value:', content)
    const ref = firestore.collection('things').doc(encodeURIComponent(topic))
    let data = { updatedTime: Date.now(), reqId }
    if (content) {
      data['content'] = JSON.stringify(content)
    }
    ref
      .set(data)
      .then(value => {
        resolve(value)
      })
      .catch(err => {
        console.error('*********** write error:', err)
        console.error('*********** data:', data)
        console.error('*** topic:', topic)
        reject(err)
      })
  })
}

export const readDataFromFirestore = (
  firestore,
  topic: string
): Promise<Content> => {
  return new Promise<Content>((resolve, reject) => {
    console.debug('    readDataToFirestore topic:', topic)
    const ref = firestore.collection('things').doc(encodeURIComponent(topic))
    ref
      .get()
      .then(doc => {
        if (doc.exists) {
          const data = doc.data()
          let content: Content = null
          console.debug('    readDataToFirestore gotten data:', data)
          if (data && data.content) {
            let obj: any = JSON.parse(data.content)
            if (!obj) {
              reject(new Error(`invalid ${topic} content:${content}`))
            }
            content = {
              type: obj.type,
              body:
                obj && obj.body && obj.body.type === 'Buffer'
                  ? Buffer.from(obj.body.data)
                  : Buffer.from('')
            }
          }
          resolve(content)
        } else {
          reject('no contents')
          console.log('no contents')
        }
      })
      .catch(err => {
        console.log('error:', err)
        reject(err)
      })
  })
}

//let firstFlgForSubscribe = {}

export const subscribeFromFirestore = async (
  firestore,
  firestoreObservers,
  topic: string,
  callback: (err: string | null, content?: Content, reqId?: string) => void
) => {
  console.debug('    subscribeFromFirestore topic:', topic)
  let firstFlg = true
  const ref = firestore.collection('things').doc(encodeURIComponent(topic))
  //  const doc = await ref.get()
  //  if (!doc.exists) firstFlg = false
  let reqId
  const observer = ref.onSnapshot(
    doc => {
      //console.log(`Received doc snapshot: `, doc)
      const data = doc.data()
      // reqIdが含まれる場合は戻り値である可能性があるため最初の取得かどうかによらず値を返す
      if (data && data.reqId) {
        firstFlg = false
        reqId = data.reqId
      }
      if (firstFlg) {
        firstFlg = false
        console.log('ignore because first calling: ' + topic)
        return
      }

      let content: Content = null
      if (data && data.content) {
        let obj: any = JSON.parse(data.content)
        if (!obj) {
          throw new Error(`invalid ${topic} content:${content}`)
        }
        content = {
          type: null, // tdのデータタイプをセットすると動作しないためnullにする
          body:
            obj && obj.body && obj.body.type === 'Buffer'
              ? Buffer.from(obj.body.data)
              : Buffer.from('')
        }
        content = obj
      }
      callback(null, content, reqId)
    },
    err => {
      console.log(`Encountered error: ${err}`)
      callback(err, null, reqId)
    }
  )
  firestoreObservers[topic] = observer
  //  firstFlgForSubscribe[topic] = true
}

export const unsubscribeFromFirestore = (firestoreObservers, topic: string) => {
  console.debug('    unsubscribeFromFirestore topic:', topic)
  const observer = firestoreObservers[topic]
  if (observer) {
    observer()
  }
}

export const writeMetaDataToFirestore = (
  firestore,
  hostName: string,
  content: Object
): Promise<any> => {
  return new Promise((resolve, reject) => {
    console.debug(
      '    writeMetaDataToFirestore hostName:',
      hostName,
      ' value:',
      content
    )
    const ref = firestore.collection('hostsMetaData').doc(hostName)
    let data = { updatedTime: Date.now() }
    if (content) {
      data['content'] = JSON.stringify(content)
    }
    ref
      .set(data)
      .then(value => {
        resolve(value)
      })
      .catch(err => {
        console.error('*********** write error:', err)
        console.error('*********** data:', data)
        console.error('***', hostName, data['content'], data['contentType'])
        reject(err)
      })
  })
}

export const readMetaDataFromFirestore = (
  firestore,
  hostName: string
): Promise<Object> => {
  return new Promise<Object>((resolve, reject) => {
    console.debug('    readDataToFirestore hostName:', hostName)
    const ref = firestore.collection('hostsMetaData').doc(hostName)
    ref
      .get()
      .then(doc => {
        if (doc.exists) {
          const data = doc.data()
          const content: Object = JSON.parse(data)
          resolve(content['body'])
        } else {
          reject('no contents')
          console.log('no contents')
        }
      })
      .catch(err => {
        console.log('error:', err)
        reject(err)
      })
  })
}
