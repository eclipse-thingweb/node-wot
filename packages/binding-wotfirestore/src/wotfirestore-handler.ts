import { Content } from '@node-wot/core'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/firestore'
import { Buffer } from 'buffer'

/**
 * firestoreを初期化する。
 * fstoreがnullの場合のみ初期化処理を実施する。
 */
export const initFirestore = async (fbConfig, fstore): Promise<any> => {
  if (fstore != null) {
    return fstore
  }
  if (!firebase.apps.length) {
    // 初期化されていない場合のみ初期化する
    firebase.initializeApp(fbConfig.firebaseConfig)
  }
  // Sign In
  const currentUser = await new Promise<any>((res, rej) => {
    firebase.auth().onAuthStateChanged((user) => {
      res(user)
    })
  })
  if (!currentUser) {
    if (
      !fbConfig ||
      !fbConfig.user ||
      !fbConfig.user.email ||
      !fbConfig.user.password
    ) {
      throw new Error('firebase auth error: cannot find email/password')
    }
    const firestore = await new Promise((resolve, reject) => {
      firebase
        .auth()
        .signInWithEmailAndPassword(fbConfig.user.email, fbConfig.user.password)
        .then(() => {
          const firestore = firebase.firestore()
          resolve(firestore)
        })
        .catch(function (error) {
          reject(`firebase auth error: ${error}`)
        })
    })
    return firestore
  } else {
    return firebase.firestore()
  }
}

export const writeDataToFirestore = (
  firestore,
  topic: string,
  content: Content,
  reqId = null
): Promise<any> => {
  return new Promise((resolve, reject) => {
    console.debug(
      '[debug] writeDataToFirestore topic:',
      topic,
      ' value:',
      content,
      reqId
    )
    const ref = firestore.collection('things').doc(encodeURIComponent(topic))
    let data = { updatedTime: Date.now(), reqId }
    if (content) {
      data['content'] = JSON.stringify(content)
    }
    ref
      .set(data)
      .then((value) => {
        resolve(value)
      })
      .catch((err) => {
        console.error(
          '[error] failed to write data to firestore: ',
          err,
          ' topic: ',
          topic,
          ' data: ',
          data
        )
        reject(err)
      })
  })
}

export const readDataFromFirestore = (
  firestore,
  topic: string
): Promise<Content> => {
  return new Promise<Content>((resolve, reject) => {
    console.debug('[debug] readDataFromFirestore topic:', topic)
    const ref = firestore.collection('things').doc(encodeURIComponent(topic))
    ref
      .get()
      .then((doc) => {
        if (doc.exists) {
          const data = doc.data()
          let content: Content = null
          console.debug('[debug] readDataToFirestore gotten data:', data)
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
          console.debug(
            '[debug] read data from firestore but no contents topic:',
            topic
          )
        }
      })
      .catch((err) => {
        console.error(
          '[error] failed read data from firestore: ',
          err,
          ' topic: ',
          topic
        )
        reject(err)
      })
  })
}

export const subscribeFromFirestore = async (
  firestore,
  firestoreObservers,
  topic: string,
  callback: (err: string | null, content?: Content, reqId?: string) => void
) => {
  console.debug('[debug] subscribeFromFirestore topic:', topic)
  let firstFlg = true
  const ref = firestore.collection('things').doc(encodeURIComponent(topic))
  let reqId
  const observer = ref.onSnapshot(
    (doc) => {
      const data = doc.data()
      // reqIdが含まれており、TopicにactionResultsが含まれている場合、戻り値であるため最初の取得かどうかによらず値を返す
      let dividedTopic = topic.split('/')
      if (data && data.reqId) {
        reqId = data.reqId
        if (
          dividedTopic &&
          dividedTopic.length > 2 &&
          dividedTopic[2] === 'actionResults'
        ) {
          firstFlg = false
        }
      }
      if (firstFlg) {
        firstFlg = false
        console.debug('[debug] ignore because first calling: ' + topic)
        return
      }

      let content: Content = null
      if (data && data.content) {
        let obj: any = JSON.parse(data.content)
        if (!obj) {
          callback(`invalid ${topic} content: ${content}`, null, reqId)
          return
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
    (err) => {
      console.error(
        '[error] failed to subscribe data from firestore: ',
        err,
        ' topic: ',
        topic
      )
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
      '[debug] writeMetaDataToFirestore hostName: ',
      hostName,
      ' value: ',
      content
    )
    const ref = firestore.collection('hostsMetaData').doc(hostName)
    let data = { updatedTime: Date.now() }
    if (content) {
      data['content'] = JSON.stringify(content)
    }
    ref
      .set(data)
      .then((value) => {
        resolve(value)
      })
      .catch((err) => {
        console.error(
          '[error] failed to write meta data: ',
          err,
          ' data: ',
          data,
          ' hostName: ',
          hostName
        )
        reject(err)
      })
  })
}

export const readMetaDataFromFirestore = (
  firestore,
  hostName: string
): Promise<Object> => {
  return new Promise<Object>((resolve, reject) => {
    console.debug('[debug] readMetaDataFromFirestore hostName:', hostName)
    const ref = firestore.collection('hostsMetaData').doc(hostName)
    ref
      .get()
      .then((doc) => {
        if (doc.exists) {
          const data = doc.data()
          const content: Object = JSON.parse(data)
          resolve(content['body'])
        } else {
          console.debug('[debug] read meta data from firestore but no contents')
          reject('no contents')
        }
      })
      .catch((err) => {
        console.error(
          '[error] failed to read meta data: ',
          err,
          ' hostName: ',
          hostName
        )
        reject(err)
      })
  })
}

// Firestoreからホスト名に対応するMetaDataを削除する。
// 現状は誰も利用していない。
export const removeMetaDataFromFirestore = (
  firestore,
  hostName: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    console.debug('[debug] removeMetaDataFromFirestore hostName: ', hostName)
    const ref = firestore.collection('hostsMetaData').doc(hostName)
    ref
      .delete()
      .then(() => {
        console.log('removed hostName: ', hostName)
        resolve()
      })
      .catch((err) => {
        console.error('error removing hostName: ', hostName, 'error: ', err)
        reject(err)
      })
  })
}
