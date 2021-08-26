/********************************************************************************
 * Copyright (c) 2020 - 2021 Contributors to the Eclipse Foundation
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

import "wot-typescript-definitions"

let WoT:WoT.WoT;

var counter  = 0;

WoT.produce({ 
	title: "MQTT-Test",
	description: "Tests a MQTT client that published counter values as an WoT event and subscribes the resetCounter topic as WoT action to reset the own counter.",
	actions: {
		resetCounter: {
			description: "Reset counter"
		}
	},
	events: {
		counterEvent: {
			description: "Get counter"
		}
	}
})
.then((thing) => {
	console.info("Setup MQTT broker address/port details in wot-servient.conf.json (also see sample in wot-servient.conf.json_mqtt)!");

	thing.setActionHandler("resetCounter", () => {
		return new Promise<any>((resolve, reject) => {
			console.log("Resetting counter");
			counter = 0;
			resolve();
		});
	});

	thing.expose().then(() => {
		console.info(thing.getThingDescription().title + " ready");
		
		setInterval(() => {
			++counter;
			thing.emitEvent("counterEvent", counter);
			console.info("New count", counter);
		}, 1000);
	});
})
.catch((e) => {
	console.log(e)
});
