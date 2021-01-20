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
WoTHelpers.fetch("http://127.0.0.1:8080/servient").then(async (td) => {
    try {
        let servient = await WoT.consume(td);
        console.log("Searching for smart coffee machines...");
        let searchResults = await servient.invokeAction('search', "{\"title\": \"Smart-Coffee-Machine\"}");
        if (searchResults.length === 0) {
            console.log("No smart coffee machines found... Exiting");
            return;
        }
        console.log(`Found ${searchResults.length} smart coffee machine(s)!`);
        console.log("Consuming the first match...");
        // Remove identifier added by MongoDB from TD
        delete searchResults._id;
        let smartCoffeeMachine = await WoT.consume(searchResults[0]);
        console.log("Invoking makeDrink action...");
        let makeCoffee = await smartCoffeeMachine.invokeAction('makeDrink', undefined, { 'uriVariables': { 'drinkId': 'latte', 'size': 'l', 'quantity': 3 } });
        if (makeCoffee['result']) {
            log('Enjoy your drink!', makeCoffee);
        }
        else {
            log('Failed making your drink:', makeCoffee);
        }
    }
    catch (err) {
        console.error('Script error:', err);
    }
});
// Print data and an accompanying message in a distinguishable way
function log(msg, data) {
    console.info('======================');
    console.info(msg);
    console.dir(data);
    console.info('======================');
}
