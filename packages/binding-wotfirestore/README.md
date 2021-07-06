# Firestore Binding of node-wot

## Overview

Firestore Binding is an implementation of the [W3C Web of Things](https://www.w3.org/WoT/) Binding using Firestore, which can be used with [Eclipse Thingweb node-wot](https://github.com/eclipse/thingweb.node-wot/) to embody the Web of Things.

Firestore has the ability to subscribe to written data, and Firestore Binding uses this to perform communication between the Thing and the Client.  
This Binding provides a storage location (Reference) in Firestore for data corresponding to a Thing's properties, actions, and events. By writing data to the Reference, communication between the Thing or Client that subscribes to the data is realized.  
In this way, Firestore is only used for communication, and not for storing data history.

## Protocol specifier

The protocol prefix handled by this binding is `wotfirestore://`.

## Getting Started

In the following examples it is shown how to use the Firestore binding of node-wot.

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

The values defined in (A), (B) and (C) will be written in the configuration file shown in `Confiuration` chapter.

### Advance preparation

To prepare for creating a nodejs app, execute `npm install`.
After executing `npm init`, install the following modules.

* `npm install @node-wot/core`
* `npm install @hidetak/binding-wotfirestore`

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

The client example tries to connect to `MyCounter` thing via Firestore and reads a property `count`. The ThingDescription is stored in Firebase which can be access by client as `wotfirestore://sample-host/MyCounter`.
The ThingDescription registered by `example-server.js`.

`node example-client.js`
```js
// example-client.js
const Servient = require("@node-wot/core").Servient
const WoTFirestoreClientFactory = require("@hidetak/binding-wotfirestore").WoTFirestoreClientFactory
const Helpers = require("@node-wot/core").Helpers
const WoTFirestoreCodec = require("@hidetak/binding-wotfirestore").WoTFirestoreCodec

const firestoreConfig = require("./firestore-config.json")

let servient = new Servient()
const clientFactory = new WoTFirestoreClientFactory(firestoreConfig)
servient.addClientFactory(clientFactory)

const codec = new WoTFirestoreCodec()
servient.addMediaType(codec)
  
let wotHelper = new Helpers(servient)
wotHelper.fetch("wotfirestore://sample-host/MyCounter").then(async (td) => {
    try {
        servient.start().then((WoT) => {
            WoT.consume(td).then((thing) => {
                // read a property "count" and print the value
                thing.readProperty("count").then((s) => {
                    console.log(s);
                })
            })
        })
    } catch (err) {
        console.error("Script error:", err)
    }
}).catch((err) => { console.error("Fetch error:", err) })
```

### Server Example

The server example produces a thing that allows for setting a property `count`. The thing is reachable via Firestore. 

`node example-server.js`
```js
// example-server.js
const Servient = require("@node-wot/core").Servient
const WoTFirestoreServer = require("@hidetak/binding-wotfirestore").WoTFirestoreServer
const WoTFirestoreCodec = require("@hidetak/binding-wotfirestore").WoTFirestoreCodec

const firestoreConfig = require("./firestore-config.json")

// create server
const server = new WoTFirestoreServer(firestoreConfig)

// create Servient add Firebase binding
let servient = new Servient();
servient.addServer(server);

const codec = new WoTFirestoreCodec()
servient.addMediaType(codec)

servient.start().then((WoT) => {
    WoT.produce({
        "@context": "https://www.w3.org/2019/wot/td/v1",
        title: "MyCounter",
        properties: {
			count: {
                type: "integer",
                observable: true,
                readOnly: false        
            }
        }
    }).then((thing) => {
        console.log("Produced " + thing.getThingDescription().title);
        thing.writeProperty("count", 0)

        thing.expose().then(() => {
            console.info(thing.getThingDescription().title + " ready");
            console.info("TD : " + JSON.stringify(thing.getThingDescription()));
            thing.readProperty("count").then((c) => {
                console.log("count is " + c)
            })
        })
    })
})
```

## Support functions for Client and Server implementations

The functions that can be implemented for Client and Server differ as follows.

| functions | Client | Server |
| --- | --- | --- |
| read property | ✓ | ✓ |
| write property | ✓ | ✓ |
| observe property | ✓ | - |
| unobserve property | ✓ | - |
| invoke action | ✓ | - |
| emit event | - | ✓ |
| subscribe event | ✓ | - |
| unsubscribe event | ✓ | - |

## Notes

Because communication with Firestore occurs, you may be charged for using Firebase.
In order to avoid unexpected charges, please check your usage.
You can check it at [Firebase console](https://console.firebase.google.com/).
