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

var targetUri = "http://localhost:8080/counter";

WoT.fetch(targetUri)
.then(function(td) {
	let thing = WoT.consume(td);
	console.log("TD: " + td);
	
	// read property #1
	thing.readProperty("count")
	.then(function(count){
		console.log("count value is ", count);
    })
	.catch(err => { throw err });
	
	// increment property #1
	thing.invokeAction("increment")
	.then(function(count){
		console.log("count value after increment #1 is ", count);
    })
	.catch(err => { throw err });
	
	// increment property #2
	thing.invokeAction("increment")
	.then(function(count){
		console.log("count value after increment #2 is ", count);
    })
	.catch(err => { throw err });
	
	// decrement property
	thing.invokeAction("decrement")
	.then(function(count){
		console.log("count value after decrement is ", count);
    })
	.catch(err => { throw err });
	
	// read property #2
	thing.readProperty("count")
	.then(function(count){
		console.log("count value is ", count);
    })
	.catch(err => { throw err });
	
})
.catch(err => { throw err });
