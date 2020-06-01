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

// This is an example of Web of Things producer ("server" mode) Thing script.
// It considers a fictional smart coffee machine in order to demonstrate the capabilities of Web of Things.
// An accompanying tutorial is available at http://thingweb.io/smart-coffee-machine.html.

import 'wot-typescript-definitions'

let WoT:WoT.WoT;

WoT.produce({
    title: 'Smart-Coffee-Machine',
    description: `A smart coffee machine with a range of capabilities.
A complementary tutorial is available at http://thingweb.io/smart-coffee-machine.html.`,
    support: 'git://github.com/eclipse/thingweb.node-wot.git',
    '@context': [
        'https://www.w3.org/2019/wot/td/v1',
    ],
    properties: {
        allAvailableResources: {
            type: 'object',
            description: `Current level of all available resources given as an integer percentage for each particular resource.
The data is obtained from the machine's sensors but can be set manually via the availableResourceLevel property in case the sensors are broken.`,
            readOnly: true,
            properties: {
                water: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 100,
                },
                milk: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 100,
                },
                chocolate: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 100,
                },
                coffeeBeans: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 100,
                },
            },
        },
        availableResourceLevel: {
            type: 'number',
            description: `Current level of a particular resource. Requires resource id variable as uriVariables.
The property can also be overridden, which also requires resource id as uriVariables.`,
            uriVariables: {
                id: {
                    type: 'string', 
                    enum: ['water', 'milk', 'chocolate', 'coffeeBeans'],
                },
            },
        },
        possibleDrinks: {
            type: 'array',
            description: `The list of possible drinks in general. Doesn't depend on the available resources.`,
            readOnly: true,
            items: {
                type: 'string',
            }
        },
        servedCounter: {
            type: 'integer',
            description: `The total number of served beverages.`,
            minimum: 0,
        },
        maintenanceNeeded: {
            type: 'boolean',
            description: `Shows whether a maintenance is needed. The property is observable. Automatically set to true when the servedCounter property exceeds 1000.`,
            observable: true,
        },
        schedules: {
            type: 'array',
            description: `The list of scheduled tasks.`,
            readOnly: true,
            items: {
                type: 'object',
                properties: {
                    drinkId: {
                        type: 'string',
                        description: `Defines what drink to make, drinkId is one of possibleDrinks property values, e.g. latte.`,
                    },
                    size: {
                        type: 'string',
                        description: `Defines the size of a drink, s = small, m = medium, l = large.`,
                        enum: ['s', 'm', 'l'],
                    },
                    quantity: {
                        type: 'integer',
                        description: `Defines how many drinks to make, ranging from 1 to 5.`,
                        minimum: 1,
                        maximum: 5,
                    },
                    time: {
                        type: 'string',
                        description: `Defines the time of the scheduled task in 24h format, e.g. 10:00 or 21:00.`,
                    },
                    mode: {
                        type: 'string',
                        description: `Defines the mode of the scheduled task, e.g. once or everyday. All the possible values are given in the enum field of this Thing Description.`,
                        enum: ['once', 'everyday', 'everyMo', 'everyTu', 'everyWe', 'everyTh', 'everyFr', 'everySat', 'everySun'],
                    },
                },
            },
        },
    },
    actions: {
        makeDrink: {
            description: `Make a drink from available list of beverages. Accepts drink id, size and quantity as uriVariables.
Brews one medium americano if no uriVariables are specified.`,
            uriVariables:
            {
                drinkId: {
                    type: 'string',
                    description: `Defines what drink to make, drinkId is one of possibleDrinks property values, e.g. latte.`,
                },
                size: {
                    type: 'string',
                    description: `Defines the size of a drink, s = small, m = medium, l = large.`,
                    enum: ['s', 'm', 'l'],
                },
                quantity: {
                    type: 'integer',
                    description: `Defines how many drinks to make, ranging from 1 to 5.`,
                    minimum: 1,
                    maximum: 5,
                },
            },
            output: {
                type: 'object',
                description: `Returns true/false and a message when all invoked promises are resolved (asynchronous).`,
                properties: {
                    result: {
                        type: 'boolean',
                    },
                    message: {
                        type: 'string',
                    },
                },
            },
        },
        setSchedule: {
            description: `Add a scheduled task to the schedules property. Accepts drink id, size, quantity, time and mode as body of a request.
Assumes one medium americano if not specified, but time and mode are mandatory fields.`,
            input: {
                type: 'object',
                properties: {
                    drinkId: {
                        type: 'string',
                        description: `Defines what drink to make, drinkId is one of possibleDrinks property values, e.g. latte.`,
                    },
                    size: {
                        type: 'string',
                        description: `Defines the size of a drink, s = small, m = medium, l = large.`,
                        enum: ['s', 'm', 'l'],
                    },
                    quantity: {
                        type: 'integer',
                        description: `Defines how many drinks to make, ranging from 1 to 5.`,
                        minimum: 1,
                        maximum: 5
                    },
                    time: {
                        type: 'string',
                        description: `Defines the time of the scheduled task in 24h format, e.g. 10:00 or 21:00.`,
                    },
                    mode: {
                        type: 'string',
                        description: `Defines the mode of the scheduled task, e.g. once or everyday. All the possible values are given in the enum field of this Thing Description.`,
                        enum: ['once', 'everyday', 'everyMo', 'everyTu', 'everyWe', 'everyTh', 'everyFr', 'everySat', 'everySun'],
                    },
                },
                required: ['time', 'mode'],
            },
            output: {
                type: 'object',
                description: `Returns true/false and a message when all invoked promises are resolved (asynchronous).`,
                properties: {
                    result: {
                        type: 'boolean',
                    },
                    message: {
                        type: 'string',
                    },
                },
            },
        },
    },
    events: {
        outOfResource: {
            description: `Out of resource event. Emitted when the available resource level is not sufficient for a desired drink.`,
            data: {
                type: 'string',
            },
        },
    },
}).then( (thing) => {
    // Initialize the property values
    thing.writeProperty('allAvailableResources', {
        water: readFromSensor('water'),
        milk: readFromSensor('milk'),
        chocolate: readFromSensor('chocolate'),
        coffeeBeans: readFromSensor('coffeeBeans'),
    });
    thing.writeProperty('possibleDrinks', ['espresso', 'americano', 'cappuccino', 'latte', 'hotChocolate', 'hotWater']);
    thing.writeProperty('maintenanceNeeded', false);
    thing.writeProperty('schedules', []);

    // Observe the value of maintenanceNeeded property
    thing.observeProperty('maintenanceNeeded', (data) => {
        
        // Notify a "maintainer" when the value has changed
        // (the notify function here simply logs a message to the console)
        notify('admin@coffeeMachine.com', `maintenanceNeeded property has changed, new value is: ${data}`);
    });

    // Override a write handler for servedCounter property,
    // raising maintenanceNeeded flag when the value exceeds 1000 drinks
    thing.setPropertyWriteHandler('servedCounter', (val) => {
        return new Promise((resolve, reject) => {
            resolve(val);
            if (val > 1000) {
                thing.writeProperty('maintenanceNeeded', true);
            }
        });
    });

    // Now initialize the servedCounter property
    thing.writeProperty('servedCounter', readFromSensor('servedCounter'));

    // Override a write handler for availableResourceLevel property,
    // utilizing the uriVariables properly
    thing.setPropertyWriteHandler('availableResourceLevel', (val, options) => {

        // Check if uriVariables are provided
        if (options && typeof options === 'object' && 'uriVariables' in options) {
            const uriVariables: any = options['uriVariables'];
            if ('id' in uriVariables) {
                return thing.readProperty('allAvailableResources').then((resources) => {
                    const id = uriVariables['id'];
                    resources[id] = val;
                    return thing.writeProperty('allAvailableResources', resources);
                });
            }
        }
        return new Promise((resolve, reject) => {
            resolve('Please specify id variable as uriVariables.');
        });
    });

    // Override a read handler for availableResourceLevel property,
    // utilizing the uriVariables properly
    thing.setPropertyReadHandler('availableResourceLevel', (options) => {

        // Check if uriVariables are provided
        if (options && typeof options === 'object' && 'uriVariables' in options) {
            const uriVariables: any = options['uriVariables'];
            if ('id' in uriVariables) {
                return thing.readProperty('allAvailableResources').then((resources) => {
                    const id = uriVariables['id'];
                    return new Promise((resolve, reject) => {
                        resolve(resources[id]);
                    });
                });
            }
        }
        return new Promise((resolve, reject) => {
            resolve('Please specify id variable as uriVariables.');
        });
    });

    // Set up a handler for makeDrink action
    thing.setActionHandler('makeDrink', (params, options) => {

        // Default values
        let drinkId = 'americano';
        let size = 'm';
        let quantity = 1;
        
        // Size quantifiers
        const sizeQuantifiers: any = {'s': 0.1, 'm': 0.2, 'l': 0.3};
        
        // Drink recipes showing the amount of a resource consumed for a particular drink
        const drinkRecipes: any = {
            'espresso': {
                'water': 1,
                'milk': 0,
                'chocolate': 0,
                'coffeeBeans': 2,
            },
            'americano': {
                'water': 2,
                'milk': 0,
                'chocolate': 0,
                'coffeeBeans': 2,
            },
            'cappuccino': {
                'water': 1,
                'milk': 1,
                'chocolate': 0,
                'coffeeBeans': 2,
            },
            'latte': {
                'water': 1,
                'milk': 2,
                'chocolate': 0,
                'coffeeBeans': 2,
            },
            'hotChocolate': {
                'water': 0,
                'milk': 0,
                'chocolate': 1,
                'coffeeBeans': 0,
            },
            'hotWater': {
                'water': 1,
                'milk': 0,
                'chocolate': 0,
                'coffeeBeans': 0,
            },
        }

        // Check if uriVariables are provided
        if (options && typeof options === 'object' && 'uriVariables' in options) {
            const uriVariables: any = options['uriVariables'];
            drinkId = ('drinkId' in uriVariables) ? uriVariables['drinkId'] : drinkId;
            size = ('size' in uriVariables) ? uriVariables['size'] : size;
            quantity = ('quantity' in uriVariables) ? uriVariables['quantity'] : quantity;
        }

        // Read the current level of allAvailableResources
        return thing.readProperty('allAvailableResources').then((resources) => {
            
            // Calculate the new level of resources
            let newResources = Object.assign({}, resources);
            newResources['water'] -= Math.ceil(quantity * sizeQuantifiers[size] * drinkRecipes[drinkId]['water']);
            newResources['milk'] -= Math.ceil(quantity * sizeQuantifiers[size] * drinkRecipes[drinkId]['milk']);
            newResources['chocolate'] -= Math.ceil(quantity * sizeQuantifiers[size] * drinkRecipes[drinkId]['chocolate']);
            newResources['coffeeBeans'] -= Math.ceil(quantity * sizeQuantifiers[size] * drinkRecipes[drinkId]['coffeeBeans']);

            // Check if the amount of available resources is sufficient to make a drink
            for (let resource in newResources) {
                if (newResources[resource] <= 0) {
                    return new Promise((resolve, reject) => {
                        thing.emitEvent('outOfResource', `Low level of ${resource}: ${resources[resource]}%`);
                        resolve({result: false, message: `${resource} level is not sufficient`});
                    });
                }
            }

            // Now store the new level of allAvailableResources
            return thing.writeProperty('allAvailableResources', newResources).then(() => {
                return thing.readProperty('servedCounter').then((counter) => {
                    return new Promise((resolve, reject) => {
                        thing.writeProperty('servedCounter', counter + quantity);

                        // Finally deliver the drink
                        resolve({result: true, message: `Your ${drinkId} is in progress!`});
                    });
                });
            });
        });
    });

    // Set up a handler for setSchedule action
    thing.setActionHandler('setSchedule', (params, options) => {

        // Check if uriVariables are provided
        if (params && typeof params === 'object' && 'time' in params && 'mode' in params) {

            // Use default values if not provided
            params['drinkId'] = ('drinkId' in params) ? params['drinkId'] : 'americano';
            params['size'] = ('size' in params) ? params['size'] : 'm';
            params['quantity'] = ('quantity' in params) ? params['quantity'] : 1;

            // Now read the schedules property, add a new schedule to it and then rewrite the schedules property
            return thing.readProperty('schedules').then((schedules) => {
                schedules.push(params);
                return thing.writeProperty('schedules', schedules).then(() => {
                    return new Promise((resolve, reject) => {
                        resolve({result: true, message: `Your schedule has been set!`});
                    });
                });
            });

        }
        return new Promise((resolve, reject) => {
            resolve({result: false, message: `Please provide all the required parameters: time and mode.`});
        });
    });

    // Set up a handler for outOfResource event
    thing.subscribeEvent('outOfResource', (data) => {

        // Notify an "admin" when the event is emitted
        // (the notify function here simply logs a message to the console)
        notify('admin@coffeeMachine.com', `outOfResource event: ${data}`);
    });

    // Finally expose the thing
    thing.expose().then( () => { console.info(`${thing.getThingDescription().title} ready`); } ); 
    console.log(`Produced ${thing.getThingDescription().title}`);
}).catch(e => {
    console.log(e);
});


function readFromSensor(sensorType: any) {
    // Actual implementation of reading data from a sensor can go here
    // For the sake of example, let's just return a value
    return 100;
}

function notify(subscribers: any, msg: string) {
    // Actual implementation of notifying subscribers with a message can go here
    console.log(msg);
    return;
}
