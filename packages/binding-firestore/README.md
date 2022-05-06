# Firestore Protocol Binding of node-wot

## Overview

Firestore Binding is an implementation of the [W3C Web of Things](https://www.w3.org/WoT/) Binding using Firestore, which can be used with [Eclipse Thingweb node-wot](https://github.com/eclipse/thingweb.node-wot/) to embody the Web of Things.

Firestore has the ability to subscribe to written data, and Firestore Binding uses this to perform communication between the Thing and the Client.
This Binding provides a storage location (Reference) in Firestore for data corresponding to a Thing's properties, actions, and events. By writing data to the Reference, communication between the Thing or Client that subscribes to the data is realized.

In addition, when you do an Expose thing in a Server program that uses this Binding, the exposed Thing Description will be saved in Firestore.
This Thing Description can be accessed by the Client as follows.

```js
wotHelper.fetch("firestore://sample-host/MyCounter").then((td) => {
    // do something
}
```

For more information on how to use Firestore, see `How to use Firestore`.

## Protocol specifier

The protocol prefix handled by this binding is `firestore://`.

## Getting Started

In the following examples, how to use the Firestore binding of node-wot is shown.

You must have a Firebase account to use this binding.

### Setting up Firebase

In order to use Firestore Binding, you need to set up Firebase.
Perform the following setup from the [Firestore console](https://console.firebase.google.com/).

1. Getting started with Authentication
1. Enable email/password for Sign-in Method in Authentication
1. Add user in Users (A)
1. Create a database in Cloud Firestore
1. Edit database rule of Firestore to require user authentication for access
    ```
    rules_version = '2';
    service cloud.firestore {
        match /databases/{database}/documents {
            match /{document=**} {
                allow read, write: if request.auth.uid != null;
            }
        }
    }
    ```
1. Select `Project Settings` from the top left gear and confirm the Project ID (B) and Web Api Key (C).

The values defined in (A), (B) and (C) will be written in the configuration file shown in `Configuration` chapter.

### Advance preparation

To prepare for creating a nodejs app, execute `npm install`.
After executing `npm init`, install the following modules.

-   `npm install @node-wot/core`
-   `npm install @node-wot/binding-firestore`

### Creating configuration file

These examples require a configuration file that contains Firestore connection information and other information. This configuration file should contain the following information((A), (B), and (C) correspond to the information written in the `Setting up Firebase` chapter):

```json
{
    "hostName": "<Host Name defined by user>",
    "firebaseConfig": {
        "apiKey": "<API Key of Firebase (C)>",
        "projectId": "<Project Id of Firebase (B)>",
        "authDomain": "<Auth Domain of Firebase(Usually it will be <B>.firebaseapp.com>"
    },
    "user": {
        "email": "<email address registered in Firebase (A)>",
        "password": "<password corresponding to the email address above (A)>"
    }
}
```

The information needed to create the configuration file can be found at [Firestore console](https://console.firebase.google.com/).

### Client Example

The client example tries to connect to `MyCounter` thing via Firestore and read the `count` property .
The Thing Description is stored in Firebase which can be access by client as `firestore://sample-host/MyCounter`.
The Thing Description is registered by `example-server.js`.

`node example-client.js`

```js
// example-client.js
const Servient = require("@node-wot/core").Servient;
const FirestoreClientFactory = require("@node-wot/binding-firestore").FirestoreClientFactory;
const Helpers = require("@node-wot/core").Helpers;
const FirestoreCodec = require("@node-wot/binding-firestore").FirestoreCodec;

const firestoreConfig = require("./firestore-config.json");

let servient = new Servient();
const clientFactory = new FirestoreClientFactory(firestoreConfig);
servient.addClientFactory(clientFactory);

const codec = new FirestoreCodec();
servient.addMediaType(codec);

let wotHelper = new Helpers(servient);
wotHelper
    .fetch("firestore://sample-host/MyCounter")
    .then(async (td) => {
        try {
            servient.start().then((WoT) => {
                WoT.consume(td).then((thing) => {
                    // read a property "count" and print the value
                    thing.readProperty("count").then((s) => {
                        console.log(s);
                    });
                });
            });
        } catch (err) {
            console.error("Script error:", err);
        }
    })
    .catch((err) => {
        console.error("Fetch error:", err);
    });
```

### Server Example

The server example produces a thing that allows for setting a property `count`. The thing is reachable via Firestore.

`node example-server.js`

```js
// example-server.js
const Servient = require("@node-wot/core").Servient;
const FirestoreServer = require("@node-wot/binding-firestore").FirestoreServer;
const FirestoreCodec = require("@node-wot/binding-firestore").FirestoreCodec;

const firestoreConfig = require("./firestore-config.json");

// create server
const server = new FirestoreServer(firestoreConfig);

// create Servient add Firebase binding
let servient = new Servient();
servient.addServer(server);

const codec = new FirestoreCodec();
servient.addMediaType(codec);

let count = 0;

servient.start().then((WoT) => {
    WoT.produce({
        "@context": "https://www.w3.org/2019/wot/td/v1",
        title: "MyCounter",
        properties: {
            count: {
                type: "integer",
                observable: true,
                readOnly: false,
            },
        },
    }).then((thing) => {
        console.log("Produced " + thing.getThingDescription().title);
        thing.expose().then(() => {
            console.info(thing.getThingDescription().title + " ready");
            console.info("TD : " + JSON.stringify(thing.getThingDescription()));
            thing.setPropertyReadHandler("count", async () => count);
        });
    });
});
```

### Other examples

We will store another example in the `packages/examples/src/bindings/firestore/` folder, so please refer to that as well.

## How to use Firestore

This Binding realizes the interaction between Client and Server for Property, Action, and Event by storing data in the following reference.

-   things/\<hostName\>%2F\<title of Thing Description\>
    Stores the Thing Description that the Server program exposes.
-   things/\<hostName\>%2F\<title of Thing Description\>%2FpropertyReadReq%2F\<name of property\>
    Stores the read request of the Property when it is requested by the Client.
-   things/\<hostName\>%2F\<title of Thing Description\>%2FpropertyReadResult/%2F\<name of property\>
    Stores the value of the requested Property from the Client.
-   things/\<hostName\>%2F\<title of Thing Description\>%2FpropertyWriteReq%2F\<name of property\>
    Stores the value of the Property when it is changed by the Client.
-   things/\<hostName\>%2F\<title of Thing Description\>%2Factions%2F\<name of action\>
    Stores the action calling information when the Client invokes an Action.
-   things/\<hostName\>%2F\<title of Thing Description\>%2FactionResults%2F\<name of action\>
    Stores the result of an Action executed by the Server.
-   things/\<hostName\>%2F\<title of Thing Description\>%events%2F\<name of event\>
    Stores the emitted events.

Data will always be overwritten and no history will be retained.

## Support WoT operations for Client implementations

The WoT operations that can be implemented for Client as follows.

| WoT operations          | Client |
| ----------------------- | ------ |
| readProperty            | ✓      |
| readAllProperties       | -      |
| readMultipleProperties  | -      |
| writeProperty           | ✓      |
| writeMultipleProperties | -      |
| observeProperty         | -      |
| unobserveProperty       | -      |
| invokeAction            | ✓      |
| emitEvent               | N/A    |
| subscribeEvent          | ✓      |
| unsubscribeEvent        | ✓      |

## Notes

Because communication with Firestore occurs, you may be charged for using Firebase.
In order to avoid unexpected charges, please check your usage.
You can check it at [Firebase console](https://console.firebase.google.com/).

## More Details

See <https://github.com/eclipse/thingweb.node-wot/>
