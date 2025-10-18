## Binding Examples

This folder contains examples for different binding protocols.

It demonstrates how to create Things that take their properties, actions, and events from different protocol bindings.

For each use case a Thing Description is provided that describes the Thing in a protocol-agnostic way.
Then a Servient is created that uses the respective binding protocol to expose the Thing.
A console client is also provided to interact with the Thing.

Examples are located in

-   `bindings\coap`
-   `bindings\http`
-   `bindings\opcua`

## OPCUA

For inializing an OPCUA client Servient, we need to import the `OPCUAClientFactory` from the `@node-wot/binding-opcua` package.

```typescript
const servient = new Servient();
servient.addClientFactory(new OPCUAClientFactory());
const wot = await servient.start();
const thing = await wot.consume(thingDescription);
```

Then we can interact with the Thing as usual:

```typescript
// now interact with the things
await thing.invokeAction(...);
await thing.readProperty(...);
await thing.subscribeEvent(...);

```

Finally, we can shutdown the servient:

```typescript
await servient.shutdown();
```
