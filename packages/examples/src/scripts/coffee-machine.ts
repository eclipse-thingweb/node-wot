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
 
// Dictionary containing all available descriptions
// Separated out here in order to keep TD clean as much
const descriptions = {
    thing: 
`A smart coffee machine with a range of capabilities.
The full desciptions is available at URL`,  // TODO: paste url here.
    resources:
`Current level of all available resources given as an integer percentage for each particular resource.
The data is obtained from the machine's sensors but can be set manually in case the sensors are broken.`,
    resourceLevel:
`Current level of a particular resource. Requires resource id variable as uriVariables.
The property can also be overriden, which also requires resource id.`,
    availableDrinks:
`The list of currently available drinks.`,
    servedCounter:
`The total number of served beverages.`,
    maintenanceNeeded:
`Shows whether a maintenance is needed. The property is observable.`,
    schedules:
`The list of scheduled tasks.`,
    makeDrink:
`Make a drink from available list of beverages. Brews one medium americano if no uriVariables are specifed.`,
    setSchedule:
`Create a scheduled task. Accepts drink id, size, quantity, time and mode as body of a request.
Assumes one medium americano if not specified.`,
    outOfResource:
`Out of resource event. Emitted when the resource level is not sufficient for a desired drink.`,
};

import 'wot-typescript-definitions'

let WoT:WoT.WoT;

// This is an example of Web of Things producer ("server" mode) Thing script.
// It considers a fictional smart coffee machine in order to demonstrate the capabilities
// of Web of Things. The full description and an accompanying tutorial is available at
// TODO: paste url here.


/* This is a temprory explanatory part, which will be extended and moved into a tutorial under the URL above.
The coffee machine has following capabilities (affordances):

- Property Affordances:
    1. resources - readOnly object of available resources;
    2. resourceLevel - read/write level of a particular resource, uses UriVariables;
    3. availableDrinks - readOnly array of available drinks;
    4. servedCounter - read/write integer of served drinks in total;
    5. maintenanceNeeded - observable boolean showing if maintenance is needed;
    6. schedules - readOnly array of scheduled tasks.

The idea behind servedCounter and maintenanceNeeded is that, every time servedCounter exceeds 1000 the maintenanceNeeded flag is set to true.
And since this value is observable a "maintainer" gets notified, who then comes and performs the maintenance of the machine,
and afterwards sets the servedCounter and maintenanceNeeded to 0 and false, respectively.

- Action Affordances:
    1. makeDrink - an action of making a drink. Uses uriVariables (drinkId, size, quantity) and output (object);
    2. setSchedule - an action of adding a scheduled task to the schedules property. Uses input (object) and output (object).

- Event Affordances:
    1. outOfResource - an out of resource event. */

WoT.produce({
    title: 'Smart Coffee Machine',
    description: descriptions.thing,
    support: 'git://github.com/eclipse/thingweb.node-wot.git',
    '@context': [
        'https://www.w3.org/2019/wot/td/v1',
        {
            'iot': 'http://example.org/iot',
        },
    ],
    properties: {
        resources: {
            type: 'object',
            description: descriptions.resources,
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
        resourceLevel: {
            type: 'number',
            desciption: descriptions.resourceLevel,
            uriVariables: {
                id: {
                    type: 'string', 
                    enum: ['water', 'milk', 'chocolate', 'coffeeBeans'],
                },
            },
        },
        availableDrinks: {
            type: 'array',
            description: descriptions.availableDrinks,
            readOnly: true,
            items: {
                type: 'string',
            }
        },
        servedCounter: {
            type: 'integer',
            description: descriptions.servedCounter,
        },
        maintenanceNeeded: {
            type: 'boolean',
            description: descriptions.maintenanceNeeded,
            observable: true,
        },
        schedules: {
            type: 'array',
            desciption: descriptions.schedules,
            readOnly: true,
            items: {
                type: 'object',
                properties: {
                    drinkId: {
                        type: 'string',
                    },
                    size: {
                        type: 'string',
                        enum: ['s', 'm', 'l'],
                    },
                    quantity: {
                        type: 'integer',
                        minimum: 1,
                        maximim: 5
                    },
                    time: {
                        type: 'string',
                    },
                    mode: {
                        type: 'string',
                        enum: ['once', 'everyday', 'everyMo', 'everyTu', 'everyWe', 'everyTh', 'everyFr', 'everySat', 'everySun'],
                    },
                },
            },
        },
    },
    actions: {
        makeDrink: {
            desciption: descriptions.makeDrink,
            uriVariables:
            {
                drinkId: {
                    type: 'string',
                },
                size: {
                    type: 'string',
                    enum: ['s', 'm', 'l'],
                },
                quantity: {
                    type: 'integer',
                    minimum: 1,
                    maximim: 5,
                },
            },
            output: {
                type: 'object',
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
            desciption: descriptions.setSchedule,
            input: {
                type: 'object',
                properties: {
                    drinkId: {
                        type: 'string',
                    },
                    size: {
                        type: 'string',
                        enum: ['s', 'm', 'l'],
                    },
                    quantity: {
                        type: 'integer',
                        minimum: 1,
                        maximim: 5
                    },
                    time: {
                        type: 'string',
                    },
                    mode: {
                        type: 'string',
                        enum: ['once', 'everyday', 'everyMo', 'everyTu', 'everyWe', 'everyTh', 'everyFr', 'everySat', 'everySun'],
                    },
                },
                required: ['time', 'mode'],
            },
            output: {
                type: 'object',
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
            desciption: descriptions.outOfResource,
            data: {
                type: 'string',
            },
        },
    },
}).then( (thing) => {
    // Initialize the property values
    thing.writeProperty('resources', {
        water: readFromSensor('water'),
        milk: readFromSensor('milk'),
        chocolate: readFromSensor('chocolate'),
        coffeeBeans: readFromSensor('coffeeBeans'),
    });
    thing.writeProperty('availableDrinks', ['espresso', 'americano', 'cappuchino', 'latte', 'hotChocolate', 'hotWater']);
    thing.writeProperty('maintenanceNeeded', false);
    thing.writeProperty('schedules', []);

    // Observe the value of maintenanceNeeded property
    thing.observeProperty('maintenanceNeeded', (data) => {
        notify('admin@coffeeMachine.com', `maintenanceNeeded property has changed: ${data}`);
    });

    // Override a write handler for servedCounter property,
    // raising maintenanceNeeded flag when needed
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

    // Override write and read handlers for resourceLevel property,
    // utilizing the uriVariables properly
    thing.setPropertyWriteHandler('resourceLevel', (val, options) => {
        if (options && typeof options === 'object' && 'uriVariables' in options) {
            const uriVariables: any = options['uriVariables'];
            if ('id' in uriVariables) {
                return thing.readProperty('resources').then((resources) => {
                    const id = uriVariables['id'];
                    resources[id] = val;
                    return thing.writeProperty('resources', resources);
                });
            }
        }
        return new Promise((resolve, reject) => {
            reject('Please specify id variable as uriVariables.');
        });
    });

    thing.setPropertyReadHandler('resourceLevel', (options) => {
        if (options && typeof options === 'object' && 'uriVariables' in options) {
            const uriVariables: any = options['uriVariables'];
            if ('id' in uriVariables) {
                return thing.readProperty('resources').then((resources) => {
                    const id = uriVariables['id'];
                    return new Promise((resolve, reject) => {
                        resolve(resources[id]);
                    });
                });
            }
        }
        return new Promise((resolve, reject) => {
            reject('Please specify id variable as uriVariables.');
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
            'cappuchino': {
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

        // Check for uriVariables
        if (options && typeof options === 'object' && 'uriVariables' in options) {
            const uriVariables: any = options['uriVariables'];
            drinkId = ('drinkId' in uriVariables) ? uriVariables['drinkId'] : drinkId;
            size = ('size' in uriVariables) ? uriVariables['size'] : size;
            quantity = ('quantity' in uriVariables) ? uriVariables['quantity'] : quantity;
        }

        // Read the current level of resources
        return thing.readProperty('resources').then((resources) => {
            
            // Calculate the new level of resources
            let newResources = Object.assign({}, resources);
            newResources['water'] -= Math.ceil(quantity * sizeQuantifiers[size] * drinkRecipes[drinkId]['water']);
            newResources['milk'] -= Math.ceil(quantity * sizeQuantifiers[size] * drinkRecipes[drinkId]['milk']);
            newResources['chocolate'] -= Math.ceil(quantity * sizeQuantifiers[size] * drinkRecipes[drinkId]['chocolate']);
            newResources['coffeeBeans'] -= Math.ceil(quantity * sizeQuantifiers[size] * drinkRecipes[drinkId]['coffeeBeans']);

            // Check if sufficient amount of resources are available
            for (let resource in newResources) {
                if (newResources[resource] <= 0) {
                    return new Promise((resolve, reject) => {
                        thing.emitEvent('outOfResource', `Low level of ${resource}: ${resources[resource]}%`);
                        reject({result: false, message: `${resource} level is not sufficient`});
                    });
                }
            }

            // Now store the new level of resources
            return thing.writeProperty('resources', newResources).then(() => {
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

        // Check for uriVariables
        if (params && typeof params === 'object' && 'time' in params && 'mode' in params) {

            // Use default values if not provided
            let drinkId = ('drinkId' in params) ? params['drinkId'] : 'americano';
            let size = ('size' in params) ? params['size'] : 'm';
            let quantity = ('quantity' in params) ? params['quantity'] : 1;

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
            reject({result: false, message: `Please provide all the required parameters: time and mode.`});
        });
    });

    // Set up a handler for outOfResource event
    thing.subscribeEvent('outOfResource', (data) => {
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
