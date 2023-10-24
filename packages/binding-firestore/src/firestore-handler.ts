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

import { Content, createLoggers } from "@node-wot/core";
import Firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import { Readable } from "stream";
import { BindingFirestoreConfig } from "./firestore";

const { debug, error } = createLoggers("binding-firestore", "firestore-handler");

let firebase: typeof Firebase;

if (Firebase.apps) {
    // for NodeJS
    firebase = Firebase;
} else {
    // for Web browser (We'll deal with it later.)
    firebase = window.firebase as unknown as typeof Firebase;
}

type Firestore = Firebase.firestore.Firestore;

/**
 * initialize firestore.
 */
export const initFirestore = async (fbConfig: BindingFirestoreConfig, fstore?: Firestore): Promise<Firestore> => {
    if (fstore) {
        return fstore;
    }
    if (!firebase.apps.length) {
        // initialize firestore if initialize not yet.
        firebase.initializeApp(fbConfig.firebaseConfig as Object);
    }
    // Sign In
    const currentUser = await new Promise((resolve, reject) => {
        firebase.auth().onAuthStateChanged((user) => {
            resolve(user);
        });
    });
    if (!currentUser) {
        if (!fbConfig || !fbConfig.user || !fbConfig.user.email || !fbConfig.user.password) {
            throw new Error("firebase auth error: cannot find email/password");
        }
        const firestore = await new Promise((resolve, reject) => {
            firebase
                .auth()
                //@ts-ignore
                .signInWithEmailAndPassword(fbConfig.user.email, fbConfig.user.password)
                .then(() => {
                    const firestore = firebase.firestore();
                    resolve(firestore);
                })
                .catch(function (error: Error) {
                    reject(error);
                });
        });
        return firestore as Firestore;
    } else {
        return firebase.firestore();
    }
};

export const writeDataToFirestore = async (
    firestore: Firebase.firestore.Firestore,
    topic: string,
    content: Content | undefined,
    reqId: string | null = null
): Promise<void> => {
    debug(`writeDataToFirestore topic: ${topic}, value: ${content}, reqId: ${reqId}`);
    const ref = firestore.collection("things").doc(encodeURIComponent(topic));
    const data = { updatedTime: Date.now(), reqId, content: "" };
    if (content && content.body) {
        if (content.body instanceof Readable) {
            const body = await content.toBuffer();
            const contentForWrite = { type: content.type, body };
            data.content = JSON.stringify(contentForWrite);
        } else {
            data.content = JSON.stringify(content);
        }
    } else {
        const contentForWrite: { type: string | null; body: { type: string | null; data: [] | null } | string | null } =
            {
                type: null,
                body: null,
            };
        data.content = JSON.stringify(contentForWrite);
    }
    debug(`writeDataToFirestore topic: ${topic}, data: ${data} ${reqId}`);
    try {
        return await ref.set(data);
    } catch (err) {
        debug(`failed to write data to firestore: ${err}, topic: ${topic}, data: ${data}`);
        throw err;
    }
};

export const readDataFromFirestore = async (firestore: Firestore, topic: string): Promise<Content | undefined> => {
    debug(`readDataFromFirestore topic: ${topic}`);
    const ref = firestore.collection("things").doc(encodeURIComponent(topic));
    try {
        const doc = await ref.get();
        if (doc.exists) {
            const data = doc.data();
            let content: Content | undefined;
            debug(`readDataToFirestore got data: ${data}`);
            if (data && data.content) {
                // XXX TODO change the way content is reported
                const obj = JSON.parse(data.content);
                if (!obj) {
                    throw new Error(`invalid ${topic} content:${content}`);
                }
                content = new Content(
                    obj.type,
                    obj && obj.body && obj.body.type === "Buffer" ? Readable.from(obj.body.data) : Readable.from("")
                );
            }
            return content;
        } else {
            debug(`read data from firestore but no contents topic: ${topic}`);
            throw new Error("no contents");
        }
    } catch (err) {
        error(`failed to read data from firestore: ${err}, topic: ${topic}`);
        throw err;
    }
};

export const subscribeToFirestore = async (
    firestore: Firestore,
    firestoreObservers: { [key: string]: () => void },
    topic: string,
    callback: (err: Error | string | null, content?: Content | undefined, reqId?: string) => void
): Promise<void> => {
    debug(`subscribeToFirestore topic: ${topic}`);
    let firstFlg = true;
    const ref = firestore.collection("things").doc(encodeURIComponent(topic));
    let reqId: string;
    const observer = ref.onSnapshot(
        async (doc) => {
            const data = await doc.data();
            // If reqId is included and Topic contains actionResults,
            // return the value regardless of whether it is the first acquisition because it is a return value.
            const dividedTopic = topic.split("/");
            if (data?.reqId) {
                reqId = data.reqId;
                if (
                    dividedTopic &&
                    dividedTopic.length > 2 &&
                    (dividedTopic[2] === "actionResults" || dividedTopic[2] === "propertyReadResults")
                ) {
                    firstFlg = false;
                }
            }
            if (firstFlg) {
                firstFlg = false;
                debug(`ignore because first calling: ${topic}`);
                return;
            }

            let content: Content | undefined;
            if (data?.content) {
                const obj = JSON.parse(data.content);
                if (!obj) {
                    callback(Error(`invalid ${topic} content: ${content}`), undefined, reqId);
                    return;
                }
                const buf = Buffer.from(obj?.body?.data || []);
                content = new Content(obj.type, obj?.body?.type === "Buffer" ? Readable.from(buf) : Readable.from(""));
            }
            callback(null, content, reqId);
        },
        (err: Error) => {
            error(`failed to subscribe data from firestore: ${err}. topic: ${topic}`);
            callback(err, undefined, reqId);
        }
    );
    firestoreObservers[topic] = observer;
};

export const unsubscribeToFirestore = (firestoreObservers: { [key: string]: () => void }, topic: string): void => {
    debug(`unsubscribeToFirestore topic: ${topic}`);
    const observer = firestoreObservers[topic];
    if (observer) {
        observer();
    }
};

export const removeDataFromFirestore = async (firestore: Firestore, topic: string): Promise<void> => {
    debug(`removeDataFromFirestore topic: ${topic}`);
    const ref = firestore.collection("things").doc(encodeURIComponent(topic));
    try {
        await ref.delete();
    } catch (err) {
        error(`error removing topic: ${topic}, error: ${err}`);
        throw err;
    }
};

export const writeMetaDataToFirestore = async (
    firestore: Firestore,
    hostName: string,
    content: unknown
): Promise<void> => {
    debug(`writeMetaDataToFirestore hostName: ${hostName}, value: ${content}`);
    const data = { updatedTime: Date.now(), content: "" };
    try {
        const ref = firestore.collection("hostsMetaData").doc(hostName);
        if (content) {
            data.content = JSON.stringify(content);
        }
        const value = await ref.set(data);
        return value;
    } catch (err) {
        error(`failed to write meta data: ${err}, hostName: ${hostName}`);
        throw err;
    }
};

export const readMetaDataFromFirestore = async (
    firestore: Firestore,
    hostName: string
): Promise<{ hostName: string; things: string[] } | undefined> => {
    debug(`readMetaDataFromFirestore, hostName: ${hostName}`);

    try {
        const ref = firestore.collection("hostsMetaData").doc(hostName);
        const doc = await ref.get();
        if (doc.exists) {
            const data = doc.data();
            if (data?.content) {
                const content = JSON.parse(data.content);
                return content.body;
            } else {
                return undefined;
            }
        } else {
            debug("read meta data from firestore but no contents");
            throw new Error("no contents");
        }
    } catch (err) {
        error(`failed to read meta data: ${hostName}, error: ${err}`);
        throw err;
    }
};

// Remove the MetaData corresponding to the hostname from Firestore.
export const removeMetaDataFromFirestore = async (firestore: Firestore, hostName: string): Promise<void> => {
    debug(`removeMetaDataFromFirestore hostName: ${hostName}`);
    try {
        const ref = firestore.collection("hostsMetaData").doc(hostName);
        await ref.delete();
        debug(`removed hostName: ${hostName}`);
        return;
    } catch (err) {
        error(`error removing hostName: ${hostName}, error: ${err}`);
        throw err;
    }
};
