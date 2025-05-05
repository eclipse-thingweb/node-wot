# OPC UA Client Protocol Binding

W3C Web of Things (WoT) Protocol Binding for OPC UA.
This package uses [nodep-opcua](https://www.npmjs.com/package/node-opcua) as a low-level client for OPCUA over TCP.

Current Maintainer(s): [@erossignon](https://github.com/erossignon)

## Protocol specifier

The protocol prefix handled by this binding is `opc.tcp`.
This is the standard prefix used by OPC-UA connection endpoint.

## Getting Started

You can define an OPCUA property in a thing description, by using an "opc.tcp://" href.

```js
const thingDescription = {
    "@context": "https://www.w3.org/2019/wot/td/v1",
    "@type": ["Thing"],
    securityDefinitions: { nosec_sc: { scheme: "nosec" } },
    security: "nosec_sc",
    title: "servient",
    description: "node-wot CLI Servient",
    properties: {
        pumpSpeed: {
            description: "the pump speed",
            type: "number",
            forms: [
                {
                    href: "opc.tcp://opcuademo.sterfive.com:26543?id=ns=1;s=PumpSpeed",
                    op: ["readproperty", "observeproperty"],
                },
            ],
        },
    },
};
```

```javascript
// examples/src/opcua/demo-opcua1.ts
import { Servient } from "@node-wot/core";
import { OPCUAClientFactory } from "@node-wot/binding-opcua";

import { thingDescription } from "./demo-opcua-thing-description";
(async () => {
    const servient = new Servient();
    servient.addClientFactory(new OPCUAClientFactory());

    const wot = await servient.start();
    const thing = await wot.consume(thingDescription);

    const content = await thing.readProperty("pumpSpeed");
    const pumpSpeed = await content.value();

    console.log("------------------------------");
    console.log("Pump Speed is : ", pumpSpeed, "m/s");
    console.log("------------------------------");

    await servient.shutdown();
})();
```

### Run the Example App

The `packages/examples/src/bindings/opcua` folder contains a set of typescript demo that shows you
how to define a thing description containing OPCUA Variables and methods.

-   `demo-opcua1.ts` shows how to define and read an OPC-UA variable in WoT.
-   `demo-opcua2.ts` shows how to subscribe to an OPC-UA variable in WoT.
-   `opcua-coffee-machine-demo.ts` demonstrates how to define and invoke OPCUA methods as WoT actions.

### Format for href

The `href` must contain an OPCUA endpoint url in the form of `opc.tcp://<address>:<port>/?id=<nodeId>`
such as for instance:
`opc.tcp://opcuademo.sterfive.com:26543?id=ns=1;s=PumpSpeed`

`<nodeId>` has the following expectations:

-   any hash character (`#`) must be URL encoded (`%23`)
-   any ampersand character (`&`) must be URL encoded (`%26`)

### defining a property

```javascript
const thingDescription = {
    // ...
    properties: {
        temperature: {
            description: "the temperature",
            observable: true,
            readOnly: true,
            unit: "m/s",
            type: "number",
            forms: [
                {
                    href: "opc.tcp://opcuademo.sterfive.com:26543?id=ns=1;s=Temperature",
                    op: ["readproperty", "observeproperty"],
                },
            ],
        },
    },
};
```

## Advanced

The OPC-UA binding for node-wot offers additional features to allow you to interact with
OPCUA Variant and DataValue in OPCUA JSON encoded form.
For an example of use, you can dive into the unit test of the binding-opcua library.

### Exploring the unit tests

A set of examples can be found in this unit test: packages\binding-opcua\test\full-opcua-thing-test.ts

## Additional tools

### basic OPC-UA demo server

A basic demo OPC-UA server can be started using the following command.

```
thingweb.node-wot> ts-node packages/binding-opcua/test/fixture/basic-opcua-server.ts
Server started opc.tcp://<YOURMACHINENAME>:7890
```

### awesome WoT - OPCUA tools

the [node-wot-opcua-tools](https://github.com/node-opcua/node-wot-opcua-tools) project provides
some useful applications built on top of node-wot and the OPCUA binding.
