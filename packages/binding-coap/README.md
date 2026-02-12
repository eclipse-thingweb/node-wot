# CoAP Protocol Binding of node-wot

W3C WoT Binding Template specification for CoAP can be found [here](https://w3c.github.io/wot-binding-templates/bindings/protocols/coap/index.html).

Current Maintainer(s): [@JKRhb](https://github.com/JKRhb)

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
const { Servient } = require("@node-wot/core");
const { CoapClientFactory } = require("@node-wot/binding-coap");

// create Servient and add CoAP binding
const servient = new Servient();
servient.addClientFactory(new CoapClientFactory());

servient
    .start()
    .then(async (WoT) => {
        try {
            const td = await WoT.requestThingDescription("coap://plugfest.thingweb.io:5683/testthing");
            const thing = await WoT.consume(td);

            // read property
            const read1 = await thing.readProperty("string");
            console.log("string value is: ", await read1.value());
        } catch (err) {
            console.error("Script error:", err);
        }
    })
    .catch((err) => {
        console.error("Start error:", err);
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

## Using CoAPs with PSK

The CoAP binding also supports secure CoAP (`coaps://`) using DTLS with the
`psk` (Pre-Shared Key) security scheme.

Currently, PSK support is implemented in the `CoapsClient` and can be
configured via the Thing Description and client credentials.

### Thing Description Example

To use PSK, the Thing Description must define a `psk` security scheme:

```json
{
    "securityDefinitions": {
        "psk_sc": {
            "scheme": "psk"
        }
    },
    "security": ["psk_sc"]
}
```

### Client Configuration Example

On the client side, credentials must be provided via the Servient
using `addCredentials()`. The credentials are associated with the
Thing's `id` and are automatically applied based on the TD security
configuration.

```js
const { Servient } = require("@node-wot/core");
const { CoapsClientFactory } = require("@node-wot/binding-coap");

const servient = new Servient();
servient.addClientFactory(new CoapsClientFactory());

servient.start().then(async (WoT) => {
    const td = await WoT.requestThingDescription("coaps://example.com/secure-thing");

    // Configure PSK credentials for this Thing
    servient.addCredentials({
        [td.id]: {
            identity: "Client_identity",
            psk: "secretPSK",
        },
    });

    const thing = await WoT.consume(td);

    await thing.invokeAction("someAction");
});
```

The `identity` and `psk` values must match the configuration of the
CoAPs server.

> **Note:** Only the psk security scheme is currently supported for CoAPs.

### More Details

See <https://github.com/eclipse-thingweb/node-wot/>
