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
