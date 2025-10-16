"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const td = {
    "@context": "https://www.w3.org/2019/wot/td/v1",
    title: "OAuth",
    id: "urn:dev:wot:oauth:test",
    securityDefinitions: {
        oauth2_sc: {
            scheme: "oauth2",
            flow: "client",
            token: "https://localhost:3000/token",
            scopes: ["user", "admin"],
        },
    },
    security: ["oauth2_sc"],
    actions: {
        sayOk: {
            description: "A simple action protected with oauth",
            idempotent: true,
            output: { type: "string" },
        },
    },
};
try {
    WoT.produce(td).then((thing) => {
        thing.setActionHandler("sayOk", async () => "Ok!");
        thing.expose();
    });
} catch (err) {
    console.error("Script error: " + err);
}
