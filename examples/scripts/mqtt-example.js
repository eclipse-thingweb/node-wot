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

let counter = 0;
let thing = undefined;

try {
    thing = WoT.produce({
        name: "MQTT3-Counter",
        description: "MQTT3 counter stores a counter that can be read (property), reset or incremented (action) and subscribed to get notifications for value changes actions (event)."
    });

    actionTriggered = async (actionName) => {
        thing.properties.counterValue.read()
        .then(val => console.log("Triggered new action: " + actionName + " -> counterValue: " + val));
        thing.events.actionTriggered.emit(actionName);
    }

    // Increment: Increment the counter value by 1.
    thing
    .addProperty(
        "counterValue",
        {
            type: "integer",
            description: "current counter value",
            "iot:Custom": "example annotation",
            observable: true,
            writeable: false
        },
        0
    )
    .setPropertyReadHandler(
        "counterValue",
        () => new Promise((resolve) => resolve(counter))
    )
    .addAction(
        "incrementCounter",
        {},
        () => {
            console.log("Incrementing counter");
            actionTriggered("incrementCounter");
            counter += 1;
            return;
        }
    )
    .addAction(
        "resetCounter",
        {},
        () => {
            console.log("Resetting counter");
            actionTriggered("resetCounter");
            counter = 0;
            return;
        }
    )
    .addEvent(
        "actionTriggered",
        {
            type: "string"
        }
    );
    


    debugger;
    thing.expose()
    .then(() => {
        console.info(thing.name + " ready");
        console.log(JSON.stringify(thing, null, 2));
        
        
    })
    .catch(err => console.error("Expose error: " + err));
} catch (err) {
    console.error("Script error: " + err);
}