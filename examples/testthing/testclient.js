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

"use strict"

WoT.consume("http://127.0.0.1:8080/TestThing").then(thing => {
        thing.getProperty("bool")
            .then( res => {
                console.log("READ bool: " + res);
                thing.setProperty("bool", true).then( ret => {
                thing.setProperty("bool", false).then( ret => {
                thing.setProperty("bool", "true").then( ret => {
                })})});
            })
            .catch(err => console.error(err));
        
        thing.getProperty("int")
            .then( res => {
                console.log("READ int: " + res);
                thing.setProperty("int", 4711);
                thing.setProperty("int", 3.1415);
                thing.setProperty("int", "true");
            })
            .catch(err => console.error(err));
        
        thing.getProperty("num")
            .then( res => {
                console.log("READ num: " + res);
                thing.setProperty("num", 4711);
                thing.setProperty("num", 3.);
                thing.setProperty("num", "true");
            })
            .catch(err => console.error(err));
        
        thing.getProperty("string")
            .then( res => {
                console.log("READ string: " + res);
                thing.setProperty("string", "client");
                thing.setProperty("string", null);
                thing.setProperty("string", 12);
            })
            .catch(err => console.error(err));
    })
    .catch(err => console.error(err));