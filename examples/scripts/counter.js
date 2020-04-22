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

// This is an example Thing script. 
// It has a count property that can be incremented or decremented via actions and its changes are reported via events.
// It also has two properties that return an image. The SVG property is also influenced by the increment and decrement actions.
// Features
// * basic properties, actions, events
// * uriVariables
// * multi-language
// * image contentTypes for properties (Note: the contentType applies to all forms of the property)
WoT.produce({
    title: "counter",
    titles: {
        "en": "counter",
        "de": "zähler",
        "it": "Contatore"
    },
    description: "counter example Thing",
    descriptions: {
        "en": "counter example Thing",
        "de": "Zähler Beispiel Ding",
        "it": "Contatore Esempio"
    },
    support: "git://github.com/eclipse/thingweb.node-wot.git",
    "@context": ["https://www.w3.org/2019/wot/td/v1", { "iot": "http://example.org/iot" }],
    properties: {
        count: {
            type: "integer",
            description: "current counter value",
            descriptions: {
                "en": "current counter value",
                "de": "Derzeitiger Zähler Stand",
                "it": "valore attuale del contatore"
            },
            "iot:Custom": "example annotation",
            observable: true,
            readOnly: true
        },
        countAsImage: {
            description: "current counter value as SVG image",
            forms: [{
                    contentType: "image/svg+xml"
                }],
            observable: false,
            readOnly: true,
            uriVariables: {
                fill: { "type": "string" }
            }
        },
        redDotImage: {
            description: "Red dot image as PNG",
            forms: [{
                    contentType: "image/png"
                }],
            observable: false,
            readOnly: true
        },
        lastChange: {
            type: "string",
            description: "last change of counter value",
            descriptions: {
                "en": "last change of counter value",
                "de": "Letzte Änderung",
                "it": "ultima modifica del valore"
            },
            observable: true,
            readOnly: true
        }
    },
    actions: {
        increment: {
            description: "Incrementing counter value (with optional step parameter as uriVariable)",
            descriptions: {
                "en": "increment value",
                "de": "Zähler erhöhen",
                "it": "incrementare valore"
            },
            uriVariables: {
                step: { "type": "integer", "minimum": 1, "maximum": 250 }
            }
        },
        decrement: {
            description: "Decrementing counter value (with optional step parameter as uriVariable)",
            descriptions: {
                "en": "decrement value",
                "de": "Zähler verringern",
                "it": "decrementare valore"
            },
            uriVariables: {
                step: { "type": "integer", "minimum": 1, "maximum": 250 }
            }
        },
        reset: {
            description: "Resetting counter value",
            descriptions: {
                "en": "Resetting counter value",
                "de": "Zähler resettieren",
                "it": "resettare valore"
            }
        }
    },
    events: {
        change: {
            description: "change event",
            descriptions: {
                "en": "change event",
                "de": "Änderungsnachricht",
                "it": "resettare valore"
            }
        }
    }
})
    .then((thing) => {
    console.log("Produced " + thing.getThingDescription().title);
    // init property values
    thing.writeProperty("count", 0);
    thing.writeProperty("lastChange", (new Date()).toISOString());
    thing.setPropertyReadHandler("countAsImage", (options) => {
        return thing.readProperty("count").then((count) => {
            return new Promise((resolve, reject) => {
                let fill = "black";
                if (options && typeof options === 'object' && 'uriVariables' in options) {
                    console.log("options = " + JSON.stringify(options));
                    if ('fill' in options['uriVariables']) {
                        let uriVariables = options['uriVariables'];
                        fill = uriVariables['fill'];
                    }
                }
                resolve("<svg xmlns='http://www.w3.org/2000/svg' height='30' width='200'>" +
                    "<text x='0' y='15' fill='" + fill + "'>" + count + "</text>" +
                    "</svg>");
            });
        });
    });
    thing.setPropertyReadHandler("redDotImage", () => {
        return new Promise((resolve, reject) => {
            // data:image/png;base64,
            resolve("iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==");
        });
    });
    // set action handlers
    thing.setActionHandler("increment", (params, options) => {
        return thing.readProperty("count").then((count) => {
            let step = 1;
            if (options && typeof options === 'object' && 'uriVariables' in options) {
                console.log("options = " + JSON.stringify(options));
                if ('step' in options['uriVariables']) {
                    let uriVariables = options['uriVariables'];
                    step = uriVariables['step'];
                }
            }
            let value = count + step;
            console.log("Incrementing count from " + count + " to " + value + " (with step " + step + ")");
            thing.writeProperty("count", value);
            thing.writeProperty("lastChange", (new Date()).toISOString());
            thing.emitEvent("change", value);
        });
    });
    thing.setActionHandler("decrement", (params, options) => {
        return thing.readProperty("count").then((count) => {
            let step = 1;
            if (options && typeof options === 'object' && 'uriVariables' in options) {
                console.log("options = " + JSON.stringify(options));
                if ('step' in options['uriVariables']) {
                    let uriVariables = options['uriVariables'];
                    step = uriVariables['step'];
                }
            }
            let value = count - step;
            console.log("Decrementing count from " + count + " to " + value + " (with step " + step + ")");
            thing.writeProperty("count", value);
            thing.writeProperty("lastChange", (new Date()).toISOString());
            thing.emitEvent("change", value);
        });
    });
    thing.setActionHandler("reset", () => {
        return new Promise((resolve, reject) => {
            console.log("Resetting count");
            thing.writeProperty("count", 0);
            thing.writeProperty("lastChange", (new Date()).toISOString());
            thing.emitEvent("change", 0);
            resolve();
        });
    });
    // expose the thing
    thing.expose().then(() => { console.info(thing.getThingDescription().title + " ready"); });
})
    .catch((e) => {
    console.log(e);
});
