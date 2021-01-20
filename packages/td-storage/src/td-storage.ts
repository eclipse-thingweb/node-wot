/********************************************************************************
 * Copyright (c) 2018 - 2020 Contributors to the Eclipse Foundation
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

import {Thing} from "@node-wot/td-tools";
import {MongoClient} from "mongodb";

// Interface which needs to be implemented to provide different TD storages
export interface TDStorage {
    // URI to the storage
    readonly uri: string;

    // Register Things within the storage
    register(things: Thing[]): boolean;

    // Generic query search for a Thing within the storage
    search(query: string): Promise<any[]>;
}

// Class implementing TD storage using MongoDB
export class MongoDB implements TDStorage {
    public readonly uri: string;
    private client: MongoClient;
    private readonly db: string;
    private readonly collection: string;

    constructor(uri: string, db: string, collection: string) {
        this.uri = uri;

        this.db = db;
        this.collection = collection;

        MongoClient.connect(this.uri, {useUnifiedTopology: true}, (err, client: MongoClient) => {
            if (err) {
                console.debug(err);
            } else {
                this.client = client;
            }
        });
    }

    register(things: Thing[]): boolean {
        if (!this.client) {
            console.error("Register failed: Unable to find MongoDB client");
            return false;
        }

        this.client.db(this.db).collection(this.collection).insertMany(things).then((res) => {
            return res.result.ok === 1;
        });
    }

    search(query: string): Promise<any[]> {
        if (!this.client) {
            console.error("Search failed: Unable to find MongoDB client");
            return new Promise<any[]>((resolve, reject) => reject({message: "Unable to search"}));
        }

        const json_query: any = JSON.parse(query);
        return this.client.db(this.db).collection(this.collection).find(json_query).toArray();
    }
}
