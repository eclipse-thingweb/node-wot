/********************************************************************************
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
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
const core_1 = require("@node-wot/core");
const binding_http_1 = require("@node-wot/binding-http");
const binding_coap_1 = require("@node-wot/binding-coap");
// create Servient and add HTTP/CoAP binding
const servient = new core_1.Servient();
servient.addClientFactory(new binding_http_1.HttpClientFactory());
servient.addClientFactory(new binding_coap_1.CoapClientFactory());
const wotHelper = new core_1.Helpers(servient);
wotHelper.fetch("https://localhost:8080/oauth").then((td) => {
    WoT.consume(td).then(async (thing) => {
        try {
            const resp = await thing.invokeAction("sayOk");
            const result = resp === null || resp === void 0 ? void 0 : resp.value();
            console.log("oAuth token was", result);
        } catch (error) {
            console.log("It seems that I couldn't access the resource");
        }
    });
});
