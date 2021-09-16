import { Form } from "@node-wot/td-tools";

export { default as FirestoreServer } from "./firestore-server";
export { default as FirestoreClient } from "./firestore-client";
export { default as FirestoreClientFactory } from "./firestore-client-factory";
export { default as FirestoreCodec } from "./codecs/firestore-codec";
export * from "./firestore-server";
export * from "./firestore-client";
export * from "./firestore-client-factory";

export interface FirestoreConfig {
    hostName?: string;
    firebaseConfig?: {
        apiKey?: string;
        authDomain?: string;
        databaseURL?: string;
        projectId?: string;
        storageBucket?: string;
        messagingSenderId?: string;
    };
    user?: { email?: string; password?: string };
}

export class FirestoreForm extends Form {}
