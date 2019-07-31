/********************************************************************************
 * Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
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

WoT.produce({
		title: "counter",
		description: "counter example Thing",
		support: "git://github.com/eclipse/thingweb.node-wot.git",
		"@context": ["https://www.w3.org/2019/wot/td/v1", {"iot": "http://example.org/iot"}],
		properties: {
			count: {
				type: "integer",
				description: "current counter value",
				"iot:Custom": "example annotation",
				observable: true,
				readOnly: true
			},
			lastChange: {
				type: "string",
				description: "last change of counter value",
				observable: true,
				readOnly: true
			}
		},
		actions: {
			increment: {
			},
			decrement: {
			},
			reset: {
			}
		},
		events: {
			change: {
			}
		}
	})
	.then((thing) => {
		console.log("Produced " + thing.title);
		
		// init property values
		thing.writeProperty("count", 0); 
		thing.writeProperty("lastChange", (new Date()).toISOString()); 
		
		// set action handlers
		thing.setActionHandler("increment", () => {
			return thing.readProperty("count").then( (count) => {
				let value = count + 1;
				console.log("Incrementing count from " + count + " to " + value);
				thing.writeProperty("count", value);
				thing.writeProperty("lastChange", (new Date()).toISOString());
				thing.emitEvent("change", value);
			});
		});
		thing.setActionHandler("decrement", () => {
			return thing.readProperty("count").then( (count) => {
				let value = count - 1;
				console.log("Decrementing count from " + count + " to " + value);
				thing.writeProperty("count", value); 
				thing.writeProperty("lastChange", (new Date()).toISOString()); 
				thing.emitEvent("change", value);
			});
		});
		thing.setActionHandler("reset", () => {
			console.log("Resetting count");
			thing.writeProperty("count", 0); 
			thing.writeProperty("lastChange", (new Date()).toISOString());
			thing.emitEvent("change", value);
		});
		
		// expose the thing
		thing.expose().then( () => { console.info(thing.title + " ready"); } );
	})
	.catch((e) => {
		console.log(e)
	});
