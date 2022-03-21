/********************************************************************************
 * Copyright (c) 2021 Contributors to the Eclipse Foundation
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

import { Content } from "@node-wot/core";
import firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import { Readable } from "stream";

/**
 * initialize firestore.
 */
export const initFirestore = async (fbConfig: any, fstore: any): Promise<any> => {
    if (fstore != null) {
        return fstore;
    }
    if (!firebase.apps.length) {
        // initialize firestore if initialize not yet.
        firebase.initializeApp(fbConfig.firebaseConfig);
    }
    // Sign In
    const currentUser = await new Promise((resolve, reject) => {
        firebase.auth().onAuthStateChanged((user: any) => {
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
                .signInWithEmailAndPassword(fbConfig.user.email, fbConfig.user.password)
                .then(() => {
                    const firestore = firebase.firestore();
                    resolve(firestore);
                })
                .catch(function (error: Error) {
                    reject(error);
                });
        });
        return firestore;
    } else {
        return firebase.firestore();
    }
};

export const writeDataToFirestore = (
    firestore: any,
    topic: string,
    content: Content,
    reqId: string = null
): Promise<void> => {
    return new Promise((resolve, reject) => {
        console.debug("[debug] writeDataToFirestore topic:", topic, " value:", content, reqId);
        const ref = firestore.collection("things").doc(encodeURIComponent(topic));
        const data: any = { updatedTime: Date.now(), reqId };
        if (content) {
            data.content = JSON.stringify(content);
        }
        ref.set(data)
            .then((value: unknown) => {
                resolve();
            })
            .catch((err: Error) => {
                console.error("[error] failed to write data to firestore: ", err, " topic: ", topic, " data: ", data);
                reject(err);
            });
    });
};

export const readDataFromFirestore = (firestore: any, topic: string): Promise<Content> => {
    return new Promise<Content>((resolve, reject) => {
        console.debug("[debug] readDataFromFirestore topic:", topic);
        const ref = firestore.collection("things").doc(encodeURIComponent(topic));
        ref.get()
            .then((doc: any) => {
                if (doc.exists) {
                    const data = doc.data();
                    let content: Content = null;
                    // console.debug('[debug] readDataToFirestore gotten data:', data)
                    if (data && data.content) {
                        // XXX TODO change the way content is reported
                        const obj = JSON.parse(data.content);
                        if (!obj) {
                            reject(new Error(`invalid ${topic} content:${content}`));
                        }
                        content = {
                            type: obj.type,
                            body:
                                obj && obj.body && obj.body.type === "Buffer"
                                    ? Readable.from(obj.body.data)
                                    : Readable.from(""),
                        };
                    }
                    resolve(content);
                } else {
                    reject(Error("no contents"));
                    console.debug("[debug] read data from firestore but no contents topic:", topic);
                }
            })
            .catch((err: Error) => {
                console.error("[error] failed read data from firestore: ", err, " topic: ", topic);
                reject(err);
            });
    });
};

export const subscribeToFirestore = async (
    firestore: any,
    firestoreObservers: any,
    topic: string,
    callback: (err: Error | string | null, content?: Content, reqId?: string) => void
): Promise<void> => {
    console.debug("[debug] subscribeToFirestore topic:", topic);
    let firstFlg = true;
    const ref = firestore.collection("things").doc(encodeURIComponent(topic));
    let reqId: string;
    const observer = ref.onSnapshot(
        (doc: any) => {
            const data = doc.data();
            // If reqId is included and Topic contains actionResults,
            // return the value regardless of whether it is the first acquisition because it is a return value.
            const dividedTopic = topic.split("/");
            if (data && data.reqId) {
                reqId = data.reqId;
                if (dividedTopic && dividedTopic.length > 2 && dividedTopic[2] === "actionResults") {
                    firstFlg = false;
                }
            }
            if (firstFlg) {
                firstFlg = false;
                console.debug("[debug] ignore because first calling: " + topic);
                return;
            }

            let content: Content = null;
            if (data && data.content) {
                const obj = JSON.parse(data.content);
                if (!obj) {
                    callback(Error(`invalid ${topic} content: ${content}`), null, reqId);
                    return;
                }
                content = {
                    type: null, // If you set the data type to td, it won't work, so set it to null.
                    body:
                        obj && obj.body && obj.body.type === "Buffer"
                            ? Readable.from(obj.body.data)
                            : Readable.from(""),
                };
                content = obj;
            }
            callback(null, content, reqId);
        },
        (err: Error) => {
            console.error("[error] failed to subscribe data from firestore: ", err, " topic: ", topic);
            callback(err, null, reqId);
        }
    );
    firestoreObservers[topic] = observer;
};

export const unsubscribeToFirestore = (firestoreObservers: any, topic: string) => {
    console.debug("    unsubscribeToFirestore topic:", topic);
    const observer = firestoreObservers[topic];
    if (observer) {
        observer();
    }
};

export const removeDataFromFirestore = (firestore: any, topic: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        console.debug("[debug] removeDataFromFirestore topic: ", topic);
        const ref = firestore.collection("things").doc(encodeURIComponent(topic));
        ref.delete()
            .then(() => {
                console.log("removed topic: ", topic);
                resolve();
            })
            .catch((err: Error) => {
                console.error("error removing topic: ", topic, "error: ", err);
                reject(err);
            });
    });
};

export const writeMetaDataToFirestore = (firestore: any, hostName: string, content: unknown): Promise<any> => {
    return new Promise((resolve, reject) => {
        console.debug("[debug] writeMetaDataToFirestore hostName: ", hostName, " value: ", content);
        const ref = firestore.collection("hostsMetaData").doc(hostName);
        const data: any = { updatedTime: Date.now() };
        if (content) {
            data.content = JSON.stringify(content);
        }
        ref.set(data)
            .then((value: any) => {
                resolve(value);
            })
            .catch((err: Error) => {
                console.error("[error] failed to write meta data: ", err, " data: ", data, " hostName: ", hostName);
                reject(err);
            });
    });
};

export const readMetaDataFromFirestore = (firestore: any, hostName: string): Promise<any> => {
    return new Promise<any>((resolve, reject) => {
        console.debug("[debug] readMetaDataFromFirestore hostName:", hostName);
        const ref = firestore.collection("hostsMetaData").doc(hostName);
        ref.get()
            .then((doc: any) => {
                if (doc.exists) {
                    const data = doc.data();
                    const content = JSON.parse(data);
                    resolve(content.body);
                } else {
                    console.debug("[debug] read meta data from firestore but no contents");
                    reject(Error("no contents"));
                }
            })
            .catch((err: Error) => {
                console.error("[error] failed to read meta data: ", err, " hostName: ", hostName);
                reject(err);
            });
    });
};

// Remove the MetaData corresponding to the hostname from Firestore.
export const removeMetaDataFromFirestore = (firestore: any, hostName: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        console.debug("[debug] removeMetaDataFromFirestore hostName: ", hostName);
        const ref = firestore.collection("hostsMetaData").doc(hostName);
        ref.delete()
            .then(() => {
                console.log("removed hostName: ", hostName);
                resolve();
            })
            .catch((err: Error) => {
                console.error("error removing hostName: ", hostName, "error: ", err);
                reject(err);
            });
    });
};
