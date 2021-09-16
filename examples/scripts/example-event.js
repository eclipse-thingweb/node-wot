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

try {
    // internal state, not exposed as Property
    let counter = 0;
    WoT.produce({
        title: "EventSource",
        actions: {
            reset: {},
        },
        events: {
            onchange: {
                data: { type: "integer" },
            },
        },
    })
        .then((thing) => {
            console.log("Produced " + thing.getThingDescription().title);
            // set action handlers
            thing.setActionHandler("reset", () => {
                return new Promise((resolve, reject) => {
                    console.info("Resetting");
                    counter = 0;
                    return new Promise((resolve, reject) => {
                        resolve();
                    });
                });
            });
            // expose the thing
            thing.expose().then(() => {
                console.info(thing.getThingDescription().title + " ready");
                setInterval(() => {
                    ++counter;
                    thing.emitEvent("onchange", counter);
                    console.info("Emitted change ", counter);
                }, 5000);
            });
        })
        .catch((e) => {
            console.log(e);
        });
} catch (err) {
    console.error("Script error: ", err);
}
