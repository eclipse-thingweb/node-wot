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
WoTHelpers.fetch("https://localhost:8080/oauth").then((td) => {
    WoT.consume(td).then(async (thing) => {
        try {
            const resp = await thing.invokeAction("sayOk");
            const result = await (resp === null || resp === void 0 ? void 0 : resp.value());
            console.log("oAuth token was", result);
        } catch (error) {
            console.log("It seems that I couldn't access the resource");
        }
    });
});
