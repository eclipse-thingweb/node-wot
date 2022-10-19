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

import { ContentSerdes } from "./content-serdes";
import ProtocolHelpers from "./protocol-helpers";

export class Content {
    type: string;
    body: NodeJS.ReadableStream;

    constructor(type: string, body: NodeJS.ReadableStream) {
        this.type = type;
        this.body = body;
    }

    toBuffer(): Promise<Buffer> {
        return ProtocolHelpers.readStreamFully(this.body);
    }
}

/**
 * Content object with the default content type (`application/json`).
 */
export class DefaultContent extends Content {
    constructor(body: NodeJS.ReadableStream) {
        super(ContentSerdes.DEFAULT, body);
    }
}
