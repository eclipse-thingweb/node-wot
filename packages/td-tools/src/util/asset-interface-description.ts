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

import Thing from "../thing-description";
// import * as TD from "../thing-description";

/** Utilities around Asset Interface Description
 * https://github.com/admin-shell-io/submodel-templates/tree/main/development/Asset%20Interface%20Description/1/0
 *
 * e.g, transform to TD
 *
 */

const TD_TEMPLATE = `{
    "@context": "https://www.w3.org/2022/wot/td/v1.1"
}`;

// "id": "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
// "title": "MyAssetInterfaceDescriptionThing",
// "securityDefinitions": {
//     "basic_sc": { "scheme": "basic", "in": "header"}
// },
// "security": "basic_sc",

/*
 * TODOs
 * - what is the desired input/output? string, object, ... ?
 * - what are options that would be desired? (context version, id, security, ...)
 *
 */

export class AssetInterfaceDescriptionUtil {
    // TODO allow to set options

    public transformToTD(aid: string): string {
        const thing: Thing = JSON.parse(TD_TEMPLATE);

        // TODO add interactions
        // 1. properties
        // 2. actions
        // 3. events

        return JSON.stringify(thing);
    }
}
