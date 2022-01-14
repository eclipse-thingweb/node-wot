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

import { DataSchemaValue } from "wot-typescript-definitions";

export class NotReadableError extends Error {
    constructor(message: string) {
        super(message);

        // Set the prototype explicitly.
        // TS limitation see https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
        Object.setPrototypeOf(this, NotReadableError.prototype);
    }
}

export class NotSupportedError extends Error {
    constructor(message: string) {
        super(message);

        // Set the prototype explicitly.
        // TS limitation see https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
        Object.setPrototypeOf(this, NotSupportedError.prototype);
    }
}

export class DataSchemaError extends Error {
    value: DataSchemaValue;
    constructor(message: string, value: DataSchemaValue) {
        super(message);
        this.value = value;
        // Set the prototype explicitly.
        // TS limitation see https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
        Object.setPrototypeOf(this, NotSupportedError.prototype);
    }
}
