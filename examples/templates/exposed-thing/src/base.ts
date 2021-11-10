/********************************************************************************
 * Copyright (c) 2019 - 2021 Contributors to the Eclipse Foundation
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
import * as WoT from "wot-typescript-definitions";

var request = require("request");

const Ajv = require("ajv");
var ajv = new Ajv();

export class WotDevice {
    public thing: WoT.ExposedThing;
    public WoT: WoT.WoT;
    public td: any;

    // property declarations
    private myProperty: any;

    constructor(WoT: WoT.WoT, tdDirectory?: string) {
        //create WotDevice as a server
        this.WoT = WoT;
        this.WoT.produce(
            //fill in the empty quotation marks
            {
                "@context": ["https://www.w3.org/2019/wot/td/v1", { "@language": "en" }],
                "@type": "",
                id: "new:thing",
                title: "",
                description: "",
                securityDefinitions: {
                    "": {
                        scheme: "",
                    },
                },
                security: "",
                properties: {
                    myProperty: {
                        title: "A short title for User Interfaces",
                        description: "A longer string for humans to read and understand",
                        unit: "",
                        type: "",
                    },
                },
                actions: {
                    myAction: {
                        title: "A short title for User Interfaces",
                        description: "A longer string for humans to read and understand",
                        input: {
                            unit: "",
                            type: "number",
                        },
                        out: {
                            unit: "",
                            type: "string",
                        },
                    },
                },
                events: {
                    myEvent: {
                        title: "A short title for User Interfaces",
                        description: "A longer string for humans to read and understand",
                        data: {
                            unit: "",
                            type: "",
                        },
                    },
                },
            }
        ).then((exposedThing) => {
            this.thing = exposedThing;
            this.td = exposedThing.getThingDescription();
            this.addProperties();   // Initialize properties and add their handlers
            this.addActions();      // Initialize actions and add their handlers
                                    // Events do not need to be initialzed, can be emited from anywhere
            this.thing.expose();    // Expose thing
            if (tdDirectory) {
                this.register(tdDirectory);
            }
            this.listenToMyEvent(); // used to listen to specific events provided by a library. If you don't have events, simply remove it
        });
    }

    public register(directory: string) {
        console.log("Registering TD in directory: " + directory);
        request.post(directory, { json: this.thing.getThingDescription() }, (error, response, body) => {
            if (!error && response.statusCode < 300) {
                console.log("TD registered!");
            } else {
                console.debug(error);
                console.debug(response);
                console.warn("Failed to register TD. Will try again in 10 Seconds...");
                setTimeout(() => {
                    this.register(directory);
                }, 10000);
                return;
            }
        });
    }

    private myPropertyReadHandler() {
        return new Promise((resolve, reject) => {
            // read something
            resolve(this.myProperty);
        });
    }

    private myPropertyWriteHandler(inputData, options?) {
        return new Promise((resolve, reject) => {
            // write something to property
            this.myProperty = inputData;
            // resolve that write was succesful
            resolve(true);
        });
    }


    private myActionHandler(inputData?, options?) {
        return new Promise((resolve, reject) => {
            // do something with inputData if available
            if(inputData) {
                this.thing.emitEvent("myEvent") // Emiting an event (may be removed; only for demonstration purposes)
            }
            //resolve that action was successful
            resolve(true);
        });
    }

    private listenToMyEvent() {
        /*
		specialLibrary.getMyEvent()//change specialLibrary to your library
		.then((thisEvent) => {
			this.thing.emitEvent("myEvent",""); //change quotes to your own event data
    	});
    	*/
    }

    private addProperties() {
        //fill in add properties
        this.myProperty = ""  ; // replace quotes with the initial value
        this.thing.setPropertyReadHandler("myProperty", this.myPropertyReadHandler);   // not applicable for write-only
        this.thing.setPropertyWriteHandler("myProperty", this.myPropertyWriteHandler); // not applicable for read-only
    }

    private addActions() {
        //fill in add actions
        this.thing.setActionHandler("myAction", (inputData) => {
            return new Promise((resolve, reject) => {
                if (!ajv.validate(this.td.actions.myAction.input, inputData)) {
                    reject(new Error("Invalid input"));
                } else {
                    resolve(this.myActionHandler(inputData));
                }
            });
        });
    }
}
