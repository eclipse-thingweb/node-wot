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

const NAME_PROPERTY_COUNT = "count";
const NAME_PROPERTY_LAST_CHANGE = "lastChange";
const NAME_ACTION_INCREMENT = "increment";
const NAME_ACTION_DECREMENT = "decrement";
const NAME_ACTION_RESET = "reset";
const NAME_EVENT_CHANGE = "change";

let thing = WoT.produce({
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
		"@context": ["https://www.w3.org/2019/wot/td/v1", {"iot": "http://example.org/iot"}],
	});

console.log("Produced " + thing.title);

thing.addProperty(
	NAME_PROPERTY_COUNT,
	{
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
	0);
thing.addProperty(
	NAME_PROPERTY_LAST_CHANGE,
	{
		type: "string",
		description: "increment value",
		descriptions: {
			"en":" last change of counter value",
			"de": "Letzte Änderung",
			"it": "ultima modifica del valore"
		},
		observable: true,
		readOnly: true
	},
	(new Date()).toISOString());

thing.addAction(
	NAME_ACTION_INCREMENT,
	{
		description: "increment value",
		descriptions: {
			"en": "increment value",
			"de": "Zähler erhöhen",
			"it": "incrementare valore"
		}
	},
	() => {
		console.log("Incrementing");
		return thing.properties[NAME_PROPERTY_COUNT].read().then( (count) => {
			let value = count + 1;
			thing.properties[NAME_PROPERTY_COUNT].write(value);
			thing.properties[NAME_PROPERTY_LAST_CHANGE].write((new Date()).toISOString());
			thing.events[NAME_EVENT_CHANGE].emit();
		});
	});

thing.addAction(
	NAME_ACTION_DECREMENT,
	{
		description: "decrement value",
		descriptions: {
			"en": "decrement value",
			"de": "Zähler verringern",
			"it": "decrementare valore"
		}
	},
	() => {
		console.log("Decrementing");
		return thing.properties[NAME_PROPERTY_COUNT].read().then( (count) => {
			let value = count - 1;
			thing.properties[NAME_PROPERTY_COUNT].write(value);
			thing.properties[NAME_PROPERTY_LAST_CHANGE].write((new Date()).toISOString());
			thing.events[NAME_EVENT_CHANGE].emit();
		});
	});

thing.addAction(
	NAME_ACTION_RESET,
	{
		description: "reset value",
		descriptions: {
			"en": "reset value",
			"de": "Zähler resettieren",
			"it": "resettare valore"
		}
	},
	() => {
		console.log("Resetting");
		thing.properties[NAME_PROPERTY_COUNT].write(0);
		thing.properties[NAME_PROPERTY_LAST_CHANGE].write((new Date()).toISOString());
		thing.events[NAME_EVENT_CHANGE].emit();
	});
	
thing.addEvent(
	NAME_EVENT_CHANGE,
	{
		description: "change event",
		descriptions: {
			"en": "change event",
			"de": "Änderungsnachricht",
			"it": "resettare valore"
		}
	}
	);

thing["support"] = "git://github.com/eclipse/thingweb.node-wot.git";

thing.expose().then( () => { console.info(thing.title + " ready"); } );
