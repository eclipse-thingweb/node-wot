# OPC UA Client Protocol Binding

W3C Web of Things (WoT) Protocol Binding for OPC UA.
This package uses [nodep-opcua](https://www.npmjs.com/package/node-opcua) as a low-level client for OPCUA over TCP.

## Protocol specifier

The protocol prefix handled by this binding is `opc.tcp`.
This is the standard prefix used by OPC-UA connection endpoint.

## Getting Started

You can define nan OPCUA property in a thing description, by using a "opc.tcp://" href.

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
                    href: "opc.tcp://opcuademo.sterfive.com:26543", // endpoint,
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": "ns=1;s=PumpSpeed",
                },
            ],
        },
    },
};
```

```javascript
// examples/src/opcua/dempo-opcua1.ts
import { Servient } from "@node-wot/core";
import { OPCUAClientFactory } from "@node-wot/binding-opcua";

(async () => {
    const servient = new Servient();
    servient.addClientFactory(new OPCUAClientFactory());

    const wot = await servient.start();
    const thing = await wot.consume(thingDescription);

    const content = await thing.readProperty("pumpSpeed");
    const json = (await content.value()).valueOf();

    console.log("Pump Speed is", json);

    await servient.shutdown();
})();
```

### Run the Example App

The `examples/src/opcua` folder contains a set of typescript demo that shows you
how to define a thing description containing OPCUA Variables and methods.

-   `demo-opcua1.ts` shows how to define and read an OPC-UA variable in WoT.
-   `demo-opcua2.ts` shows how to subscribe to an OPC-UA variable in WoT.
-   `opcua-coffee-machine-demo.ts` demonstrates how to define and invoke OPCUA methods as WoT actions.

### Form extensions

#### href

the `href` property must contains a OPCUA endpoint url in the form `opc.tcp://MACHINE:PORT/Application`
such as for instance:
`opc.tcp://opcuademo.sterfive.com:26543` or `opc.tcp://localhost:48010`

#### opcua:nodeId

The form must contain an `opcua:nodeId` property that describes the nodeId of the OPCUA Variable to read/write/subscribe or the nodeId of the OPCUA Object related to the action.

The `opcua:nodeId` can have 2 forms:

-   a **NodeId** as a string, such as `"ns=1;i=1234"` , for instance:

```javascript
"opcua:nodeId": "ns=1;s=\"Machine\".\"Component\""
```

-   or **browsePath**: The browse path will be converted into the corresponding nodeId at runtime when first encountered.

```
"opcua:nodeId": { root: "i=84", path: "/Objects/2:DeviceSet/1:CoffeeMachine" },
```

### opcua:method

for example:

```typescript
const thingDescription = {
    // ...
    actions: {
        brewCoffee: {
            forms: [
                {
                    href: endpointUrl,
                    op: ["invokeaction"],
                    "opcua:nodeId": { root: "i=84", path: "/Objects/2:DeviceSet/1:CoffeeMachine" },
                    "opcua:method": { root: "i=84", path: "/Objects/2:DeviceSet/1:CoffeeMachine/2:MethodSet/9:Start" },
                },
            ],
        },
    },
};
```

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
                    href: endpointUrl,
                    op: ["readproperty", "observeproperty"],
                    "opcua:nodeId": "ns=1;s=Temperature",
                },
            ],
        },
    },
};
```

## Advanced

The OPC-UA binding for node-wot offers additionals feature to allow you to interact with
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
some useful applications built on top of thingweb.node-wob and the OPCUA binding

ref: https://github.com/node-opcua/node-wot-opcua-tools
