/**
 * Firestore client
 */
import { ProtocolClient, Content } from "@node-wot/core";
import { FirestoreForm, FirestoreConfig } from "./firestore";
import { v4 as uuidv4 } from "uuid";

import "firebase/auth";
import "firebase/firestore";
import {
    initFirestore,
    writeDataToFirestore,
    readDataFromFirestore,
    subscribeToFirestore,
    unsubscribeToFirestore,
} from "./firestore-handler";
import * as TD from "@node-wot/td-tools";

export default class FirestoreClient implements ProtocolClient {
    private firestore = null;
    private firestoreObservers = {};
    private fbConfig = null;

    constructor(config: FirestoreConfig = null) {
        if (typeof config !== "object") {
            throw new Error(`Firestore requires config object (got ${typeof config})`);
        }
        this.fbConfig = config;
    }

    public toString(): string {
        return `[FirestoreClient]`;
    }

    private makePointerInfo(form: FirestoreForm): {
        hostName: string;
        name: string;
        topic: string;
        type: string;
        resource: string;
    } {
        const splittedHref = form.href.split("://");
        const paths = splittedHref[1].split("/");
        const hostName = paths[0];
        const name = paths[1];
        let type = paths[2];
        if (type === undefined) {
            type = "td";
        }
        const resource = paths[3];
        const topic = splittedHref[1];
        const ret = {
            hostName: hostName,
            name: name,
            topic: topic,
            type: type,
            resource: resource,
        };
        return ret;
    }

    public async readResource(form: FirestoreForm): Promise<Content> {
        const firestore = await initFirestore(this.fbConfig, this.firestore);
        this.firestore = firestore;
        const pointerInfo = this.makePointerInfo(form);
        //TODO: thingに問い合わせるように修正
        const content = await readDataFromFirestore(this.firestore, pointerInfo.topic);
        return content;
    }

    public async writeResource(form: FirestoreForm, content: Content): Promise<any> {
        const pointerInfo = this.makePointerInfo(form);
        const firestore = await initFirestore(this.fbConfig, this.firestore);
        this.firestore = firestore;
        let splittedTopic = pointerInfo.topic.split("/");
        if (splittedTopic && splittedTopic[2] === "properties") {
            splittedTopic[2] = "propertyWriteReq";
            pointerInfo.topic = splittedTopic.join("/");
        }
        const value = await writeDataToFirestore(this.firestore, pointerInfo.topic, content);
        return value;
    }

    public async invokeResource(form: FirestoreForm, content?: Content): Promise<Content> {
        const firestore = await initFirestore(this.fbConfig, this.firestore);
        this.firestore = firestore;
        // Input the content of the Action in the corresponding section of Firestore.
        const pointerInfo = this.makePointerInfo(form);
        // subscrbe for results
        const actionResultTopic =
            pointerInfo.hostName +
            "/" +
            encodeURIComponent(pointerInfo.name) +
            "/actionResults/" +
            encodeURIComponent(pointerInfo.resource);
        const reqId = uuidv4();
        let timeoutId;
        const retContent: Content = await new Promise((resolve, reject) => {
            subscribeToFirestore(this.firestore, this.firestoreObservers, actionResultTopic, (err, content, resId) => {
                console.debug("[debug] return action and unsubscribe");
                console.debug(`[debug] reqId ${reqId}, resId ${resId}`);
                if (reqId !== resId) {
                    // Ignored because reqId and resId do not match
                    return;
                }
                unsubscribeToFirestore(this.firestoreObservers, actionResultTopic);
                clearTimeout(timeoutId);
                if (err) {
                    console.error("[error] failed to get action result:", err);
                    reject(err);
                } else {
                    resolve(content);
                }
            });
            timeoutId = setTimeout(() => {
                unsubscribeToFirestore(this.firestoreObservers, actionResultTopic);
                reject(new Error(`timeout error topic: ${pointerInfo.topic}`));
            }, 10 * 1000); // timeout judgment
            // if not input was provided, set up an own body otherwise take input as body
            if (content !== undefined) {
                // Execute the action (the result will be returned to the above Callback)
                writeDataToFirestore(this.firestore, pointerInfo.topic, content, reqId);
            } else {
                // Execute the action (the result will be returned to the above Callback)
                writeDataToFirestore(
                    this.firestore,
                    pointerInfo.topic,
                    {
                        body: undefined,
                        type: "",
                    },
                    reqId
                );
            }
        });
        return retContent;
    }

    public async unlinkResource(form: FirestoreForm): Promise<any> {
        const firestore = await initFirestore(this.fbConfig, this.firestore);
        this.firestore = firestore;
        const pointerInfo = this.makePointerInfo(form);
        unsubscribeToFirestore(this.firestoreObservers, pointerInfo.topic);
    }

    public subscribeResource(
        form: FirestoreForm,
        next: (value: any) => void,
        error?: (error: any) => void,
        complete?: () => void
    ): any {
        const pointerInfo = this.makePointerInfo(form);
        // subscrbe for results
        initFirestore(this.fbConfig, this.firestore)
            .then((firestore) => {
                this.firestore = firestore;
                subscribeToFirestore(this.firestore, this.firestoreObservers, pointerInfo.topic, (err, content) => {
                    if (err) {
                        console.error("[error] failed to subscribe resource: ", err);
                        error(err);
                    } else {
                        next(content);
                    }
                });
            })
            .catch((err) => {
                console.error("[error] failed to init firestore: ", err);
                error(err);
            });
    }

    public async start(): Promise<void> {}

    public async stop(): Promise<void> {}

    public setSecurity(metadata: Array<TD.SecurityScheme>, credentials?: any): boolean {
        // Firestore provides security for the communication channel
        // Should we be able to set security on a per-Thing basis in the future?
        return true;
    }
}
