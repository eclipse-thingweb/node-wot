/**
 * WoT Firestore client Factory
 */

import { ProtocolClientFactory, ProtocolClient, ContentSerdes } from "@node-wot/core";
import { FirestoreConfig } from "./firestore";
import FirestoreClient from "./firestore-client";
import FirestoreCodec from "./codecs/firestore-codec";

export default class FirestoreClientFactory implements ProtocolClientFactory {
    public readonly scheme: string = "firestore";
    private config: FirestoreConfig = null;
    public contentSerdes: ContentSerdes = ContentSerdes.get();
    private firestoreClient = null;

    constructor(config: FirestoreConfig = null) {
        this.config = config;
        this.contentSerdes.addCodec(new FirestoreCodec());
    }

    public getClient(): ProtocolClient {
        console.warn(`[warn] firebaseClientFactory creating client`);
        if (this.firestoreClient === null) {
            this.firestoreClient = new FirestoreClient(this.config);
        }
        return this.firestoreClient;
    }

    public init(): boolean {
        return true;
    }

    public destroy(): boolean {
        return true;
    }
}
