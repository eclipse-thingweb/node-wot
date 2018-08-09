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

const NAME_PROPERTY_COUNT = "count";
const NAME_ACTION_INCREMENT = "increment";
const NAME_ACTION_DECREMENT = "decrement";
const NAME_ACTION_RESET = "reset";

let thing = WoT.produce({
	name: "counter",
	description: "counter example Thing",
	"@context": { "iot": "http://iotschema.org/" }
});

console.log("Created thing " + thing.name);

thing.addProperty(
	NAME_PROPERTY_COUNT,
	{
		type: "integer",
		description: "current counter value",
		"iot:Custom": "example annotation",
		observable: true,
		writable: true
	},
	0);

thing.addAction(NAME_ACTION_INCREMENT);
thing.setActionHandler(
	NAME_ACTION_INCREMENT,
	() => {
		console.log("Incrementing");
		return thing.properties[NAME_PROPERTY_COUNT].read().then( (count) => {
			let value = count + 1;
			thing.properties[NAME_PROPERTY_COUNT].write(value);
		});
	}
);

thing.addAction(NAME_ACTION_DECREMENT);
thing.setActionHandler(
	NAME_ACTION_DECREMENT,
	() => {
		console.log("Decrementing");
		return thing.properties[NAME_PROPERTY_COUNT].read().then( (count) => {
			let value = count - 1;
			thing.properties[NAME_PROPERTY_COUNT].write(value);
		});
	}
);

thing.addAction(NAME_ACTION_RESET);
thing.setActionHandler(
	NAME_ACTION_RESET,
	() => {
		console.log("Resetting");
		thing.properties[NAME_PROPERTY_COUNT].write(0);
	}
);

thing["support"] = "none";
console.info(thing.support);

thing.expose();
