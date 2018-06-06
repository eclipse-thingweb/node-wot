/********************************************************************************
 * Copyright (c) 2018 Contributors to the Eclipse Foundation
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

/**
 * Resource that provides an asset
 */

import BasicResourceListener from "./basic-resource-listener";
import { Content, ResourceListener } from "./protocol-interfaces";

export default class AssetResourceListener extends BasicResourceListener implements ResourceListener {

    private asset : Buffer;
    private mediaType : string;

    constructor(asset : string, mediaType : string = "text/plain") {
        super();
        this.mediaType = mediaType;
        this.asset = new Buffer(asset);
    }

    public getType(): string {
        return "Asset";
    }

    public onRead() : Promise<Content> {
        console.log(`Reading asset`);
        return new Promise<Content>(
            (resolve,reject) => resolve({ mediaType: this.mediaType, body: new Buffer(this.asset) })
        );
    }

    public onWrite(content : Content) : Promise<void> {
        console.log(`Writing '${content.body.toString()}' to asset`);
        this.mediaType = content.mediaType;
        this.asset = content.body;
        return new Promise<void>((resolve,reject) => resolve())
    }

    public onInvoke(content : Content) : Promise<Content> {
        console.log(`Invoking '${content.body.toString()}' on asset`);
        return new Promise<Content>(
            (resolve,reject) => resolve({ mediaType: this.mediaType, body: new Buffer("TODO") })
        );
    }
}