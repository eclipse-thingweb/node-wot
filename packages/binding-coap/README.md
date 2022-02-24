# CoAP Protocol Binding of node-wot

W3C WoT Binding Template specification for CoAP can be found [here](https://w3c.github.io/wot-binding-templates/bindings/protocols/coap/index.html).

## Protocol specifier

The protocol prefix handled by this binding is `coap://` or `coaps://`.

## Getting Started

In the following examples, how to use the CoAP binding of node-wot is shown.

### Prerequisites

-   `npm install @node-wot/core`
-   `npm install @node-wot/binding-coap`

### Client Example

The client example tries to connect to a TestThing via CoAP and read the `string` property.
The Thing Description is located under the following CoAP URI `coap://plugfest.thingweb.io:5683/testthing`.

`node example-client.js`

```js
// example-client.js
Servient = require("@node-wot/core").Servient;
CoapClientFactory = require("@node-wot/binding-coap").CoapClientFactory;

Helpers = require("@node-wot/core").Helpers;

// create Servient and add CoAP binding
let servient = new Servient();
servient.addClientFactory(new CoapClientFactory(null));

let wotHelper = new Helpers(servient);
wotHelper
    .fetch("coap://plugfest.thingweb.io:5683/testthing")
    .then(async (td) => {
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
    })
    .catch((err) => {
        console.error("Fetch error:", err);
    });
```

### Server Example

The server example produces a thing that allows for setting a property `count`. The thing is reachable through CoAP.

`node example-server.js`

```js
// example-server.js
Servient = require("@node-wot/core").Servient;
CoapServer = require("@node-wot/binding-coap").CoapServer;

Helpers = require("@node-wot/core").Helpers;

// create Servient add HTTP binding
let servient = new Servient();
servient.addServer(new CoapServer());

servient.start().then((WoT) => {
    WoT.produce({
        "@context": "https://www.w3.org/2019/wot/td/v1",
        title: "MyCounter",
        properties: {
            count: {
                type: "integer",
            },
        },
    }).then((thing) => {
        console.log("Produced " + thing.getThingDescription().title);
        thing.writeProperty("count", 0);

        thing.expose().then(() => {
            console.info(thing.getThingDescription().title + " ready");
            console.info("TD : " + JSON.stringify(thing.getThingDescription()));
            thing.readProperty("count").then((c) => {
                console.log("count is " + c);
            });
        });
    });
});
```

### More Details

See <https://github.com/eclipse/thingweb.node-wot/>
