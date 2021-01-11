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
// This is an example of Web of Things consumer ("client" mode) Thing script.
// It considers a fictional smart coffee machine in order to demonstrate the capabilities of Web of Things.
// An accompanying tutorial is available at http://www.thingweb.io/smart-coffee-machine.html.
WoTHelpers.fetch("http://127.0.0.1:8080/smart-coffee-machine").then(async (td) => {
    try {
        let thing = await WoT.consume(td);
        log('Thing Description:', td);
        // Read property allAvailableResources
        let allAvailableResources = await thing.readProperty('allAvailableResources');
        log('allAvailableResources value is:', allAvailableResources);
        // Now let's change water level to 80
        await thing.writeProperty('availableResourceLevel', 80, { 'uriVariables': { 'id': 'water' } });
        // And see that the water level has changed
        let waterLevel = await thing.readProperty('availableResourceLevel', { 'uriVariables': { 'id': 'water' } });
        log('waterLevel value after change is:', waterLevel);
        // This can also be seen in allAvailableResources property
        allAvailableResources = await thing.readProperty('allAvailableResources');
        log('allAvailableResources value after change is:', allAvailableResources);
        // It's also possible to set a client-side handler for observable properties
        thing.observeProperty('maintenanceNeeded', (data) => {
            log('maintenanceNeeded property has changed! New value is:', data);
        });
        // Now let's make 3 cups of latte!
        let makeCoffee = await thing.invokeAction('makeDrink', undefined, { 'uriVariables': { 'drinkId': 'latte', 'size': 'l', 'quantity': 3 } });
        if (makeCoffee['result']) {
            log('Enjoy your drink!', makeCoffee);
        }
        else {
            log('Failed making your drink:', makeCoffee);
        }
        // See how allAvailableResources property value has changed
        allAvailableResources = await thing.readProperty('allAvailableResources');
        log('allAvailableResources value is:', allAvailableResources);
        // Let's add a scheduled task
        let scheduledTask = await thing.invokeAction('setSchedule', {
            'drinkId': 'espresso',
            'size': 'm',
            'quantity': 2,
            'time': '10:00',
            'mode': 'everyday'
        });
        log(scheduledTask['message'], scheduledTask);
        // See how it has been added to the schedules property
        let schedules = await thing.readProperty('schedules');
        log('schedules value: ', schedules);
        // Let's set up a handler for outOfResource event
        thing.subscribeEvent('outOfResource', (data) => {
            // Here we are simply logging the message when the event is emitted
            // But, of course, could have a much more sophisticated handler
            log('outOfResource event:', data);
        });
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
