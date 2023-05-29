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
const { Servient, Helpers } = require("@node-wot/core");
const { CoapClientFactory } = require("@node-wot/binding-coap");

// create Servient and add CoAP binding
const servient = new Servient();
servient.addClientFactory(new CoapClientFactory());

const wotHelper = new Helpers(servient);
wotHelper
    .fetch("coap://plugfest.thingweb.io:5683/testthing")
    .then(async (td) => {
        // using await for serial execution (note 'async' in then() of fetch())
        try {
            const WoT = await servient.start();
            const thing = await WoT.consume(td);

            // read property
            const read1 = await thing.readProperty("string");
            console.log("string value is: ", await read1.value());
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
const { Servient } = require("@node-wot/core");
const { CoapServer } = require("@node-wot/binding-coap");

// create Servient add HTTP binding
const servient = new Servient();
servient.addServer(new CoapServer());

servient.start().then((WoT) => {
    WoT.produce({
        title: "MyCounter",
        properties: {
            count: {
                type: "integer",
            },
        },
    }).then((thing) => {
        console.log("Produced " + thing.getThingDescription().title);

        let count = 0;

        // set property handlers (using async-await)
        thing.setPropertyReadHandler("count", async () => count);
        thing.setPropertyWriteHandler("count", async (intOutput) => {
            count = await intOutput.value();
        });

        thing.expose().then(() => {
            console.info(thing.getThingDescription().title + " ready");
            console.info("TD : " + JSON.stringify(thing.getThingDescription()));
        });
    });
});
```

### More Details

See <https://github.com/eclipse-thingweb/node-wot/>
