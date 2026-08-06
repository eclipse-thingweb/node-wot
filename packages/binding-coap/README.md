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

## Using PSK with CoAPs (DTLS)

The CoAP binding also supports secure communication over `coaps://` using DTLS with Pre-Shared Keys (PSK).

To use PSK security, define a `psk` security scheme in the Thing Description and provide the credentials when consuming the Thing.

### Thing Description Example (PSK)

```json
{
  "title": "SecureThing",
  "securityDefinitions": {
    "psk_sc": {
      "scheme": "psk"
    }
  },
  "security": ["psk_sc"],
  "properties": {
    "count": {
      "type": "integer",
      "forms": [
        {
          "href": "coaps://localhost:5684/count"
        }
      ]
    }
  }
}
```

### Client Example with PSK

```js
const { Servient } = require("@node-wot/core");
const { CoapClientFactory } = require("@node-wot/binding-coap");

const servient = new Servient();
servient.addClientFactory(new CoapClientFactory());

servient
    .start()
    .then(async (WoT) => {
        try {
            const td = await WoT.requestThingDescription("coaps://localhost:5684/secureThing");
            const thing = await WoT.consume(td);

            // configure PSK security
            thing.setSecurity(
                td.securityDefinitions,
                {
                    identity: "Client_identity",
                    psk: "secretPSK"
                }
            );

            const value = await thing.readProperty("count");
            console.log("count value is:", await value.value());
        } catch (err) {
            console.error("Script error:", err);
        }
    })
    .catch((err) => {
        console.error("Start error:", err);
    });
```

### Notes

- The `identity` must match the server configuration.
- The `psk` must match the server's configured secret.
- Currently, only the `psk` security scheme is supported for `coaps://` in this binding.

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
