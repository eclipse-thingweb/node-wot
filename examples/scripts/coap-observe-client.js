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

//Tested with https://github.com/mcollina/node-coap/blob/master/examples/observe_server.js

let td = 
`{
    "name": "CoAP date server",
    "id": "urn:dev:wot:coap:date",
    "properties" : {
        "mydate": {
            "forms": [
                {"href": "coap://localhost:5683"}
            ]
        }
    }
}`;

let thing = WoT.consume(td);

thing.properties.mydate.subscribe(
	x => {
		console.info("onNext: ", x);
	},
	e => console.log("onError: %s", e),
	() => {
		console.log("onCompleted");
	}
);
console.info("Subscribed");
