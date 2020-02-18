# HTTP Protocol Binding of node-wot

## Getting Started

In the following examples it is shown how to use the HTTP binding of node-wot.

### Prerequisites
* `npm install @node-wot/core`
* `npm install @node-wot/binding-http`

### Client Example

The client example tries to connect to a TestThing via HTTP and reads a property `string`. The ThingDescription is located under the follwing uri http://plugfest.thingweb.io:8083/TestThing.

`node example-client.js`

```
// example-client.js
Servient = require("@node-wot/core").Servient
HttpClientFactory = require("@node-wot/binding-http").HttpClientFactory

Helpers = require("@node-wot/core").Helpers

// create Servient and add HTTP binding
let servient = new Servient();
servient.addClientFactory(new HttpClientFactory(null));

let wotHelper = new Helpers(servient);
wotHelper.fetch("http://plugfest.thingweb.io:8083/TestThing").then(async (td) => {
    // using await for serial execution (note 'async' in then() of fetch())
    try {
        servient.start().then((WoT) => {
            WoT.consume(td).then((thing) => {
                // read a property "string" and print the value
                thing.readProperty("string").then((s) => {
                    console.log(s);
                });
            });
        });
    } catch (err) {
        console.error("Script error:", err);
    }
}).catch((err) => { console.error("Fetch error:", err); });
```

### Server Example

The server example produces a thing that allows for setting a property `count`. The thing is reachable through HTTP. Additional additional handlers could be added.

`node example-server.js`

```
// example-server.js
Servient = require("@node-wot/core").Servient
HttpServer = require("@node-wot/binding-http").HttpServer

Helpers = require("@node-wot/core").Helpers

// create Servient add HTTP binding with port configuration
let servient = new Servient();
servient.addServer(new HttpServer({
    port: 8081 // (default 8080)
}));

servient.start().then((WoT) => {
    WoT.produce({
        "@context": "https://www.w3.org/2019/wot/td/v1",
        title: "MyCounter",
        properties: {
			count: {
				type: "integer"
            }
        }
    }).then((thing) => {
        console.log("Produced " + thing.title);
        thing.writeProperty("count", 0)

        thing.expose().then(() => {
            console.info(thing.title + " ready");
            console.info("TD : " + JSON.stringify(thing.getThingDescription()));
            thing.readProperty("count").then((c) => {
                console.log("cound is " + c);
            });
        });
    });
});
```

The *secure* server example shows how to add credentials and how to setup HTTPS.

`node example-server-secure.js`

```
// example-server-secure.js
Servient = require("@node-wot/core").Servient
HttpServer = require("@node-wot/binding-http").HttpServer

Helpers = require("@node-wot/core").Helpers

// create secure Servient with username & password credentials 
let servient = new Servient();
servient.addCredentials({
    "urn:dev:wot:org:eclipse:thingweb:my-example-secure": {
        username: "node-wot",
        password: "hello"
        // token: "1/mZ1edKKACtPAb7zGlwSzvs72PvhAbGmB8K1ZrGxpcNM"
    }
});
let httpConfig = {
    allowSelfSigned: true,
    serverKey: "privatekey.pem",
    serverCert: "certificate.pem",
    security: {
          scheme: "basic" // (username & password)
    }};
// add HTTPS binding with configuration
servient.addServer(new HttpServer(httpConfig));

servient.start().then((WoT) => {
    WoT.produce({
        "@context": "https://www.w3.org/2019/wot/td/v1",
        id: "urn:dev:wot:org:eclipse:thingweb:my-example-secure",
        title: "MyCounter",
        properties: {
			count: {
				type: "integer"
            }
        }
    }).then((thing) => {
        console.log("Produced " + thing.title);
        thing.writeProperty("count", 0)

        thing.expose().then(() => {
            console.info(thing.title + " ready");
            console.info("TD : " + JSON.stringify(thing.getThingDescription()));
            thing.readProperty("count").then((c) => {
                console.log("cound is " + c);
            });
        });
    });
});
```


### More Details

see https://github.com/eclipse/thingweb.node-wot/
