### What to do with the library

The two main functionalities of node-wot are creating WoT Things and interacting with other WoT Things.
These can be combined into a Thing that interacts with other Things.

#### Creating a WoT Thing

Creating a WoT Thing is called exposing a Thing.
Exposing a Thing creates a Thing Description that can be used to by others to interact with this Thing.

##### Starting a Servient

```javascript
const { Servient } = require("@node-wot/core");
const servient = new Servient();
servient.start().then(async (WoT) => {
    // ...
});
```

##### In Client mode, add factories

```javascript
const { Servient } = require("@node-wot/core");
const { HttpClientFactory } = require("@node-wot/binding-http");
const { CoapClientFactory } = require("@node-wot/binding-coap");
const servient = new Servient();
servient.addClientFactory(new HttpClientFactory());
servient.addClientFactory(new CoapClientFactory());
servient.start().then(async (WoT) => {
    // ...
});
```

The different bindings offer client factories.
These need to be added in order to be able to access devices through this protocol.

For more details on bindings, e.g. configuration options for a specific `*ClientFactory`, look at the `README.md` files in their respective directories.

##### In Server mode, add servers

```javascript
const { Servient } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");
const servient = new Servient();
servient.addServer(new HttpServer({}));
servient.start().then(async (WoT) => {
    // ...
});
```

Same as for clients, bindings offer servers.

##### Credentials

```javascript
const { Servient } = require("@node-wot/core");
const servient = new Servient();
servient.addCredentials({
    "urn:dev:ops:32473-example-thing": {
        username: "admin",
        password: "password", // if you copy these and don't change them, don't claim you were "hacked"
    },
});
```

You can add credentials like this.
They are either used to authenticate clients when running in server mode or used to authenticate against servers when running in client mode.

This example uses `username` and `password`, but other authentication mechanisms are supported as well.
Authentication data is always mapped to a Thing through its id.

##### Expose a Thing

```javascript
WoT.produce({
    title: "counter",
    description: "counter example thing",
}).then((thing) => {
    console.log(thing.getThingDescription().title + " produced");

    // any other code to develop the thing

    // expose the thing
    thing.expose().then(() => {
        console.info(thing.getThingDescription().title + " exposed");
    });
});
```

Here, an object named `thing` is produced. At this stage, it has only a title and a description for humans to read.
`thing.expose();` exposes/starts the exposed Thing in order to process external requests. This also creates a Thing Description that describes the interfaces of the `counter` thing.

##### Add a Property definition to the Thing

Properties expose internal state of a Thing that can be directly accessed (get) and optionally manipulated (set).

They are added as part of the `WoT.produce` invocation, like so:

```javascript
WoT.produce({
    title: "counter",
    description: "counter example thing",
    properties: {
        count: {
            type: "integer",
            description: "current counter value",
        },
    },
}).then((thing) => {
    // thing.setPropertyReadHandler(...);
    // thing.setPropertyWriteHandler(...);
    // thing.expose().then(() => { ...});
});
```

This creates a property `count`.

You can create a Property that has a more complex type, such as an object. This is shown in the following:

```javascript
WoT.produce({
    title: "complexproperty",
    properties: {
        color: {
            type: "object",
            properties: {
                r: { type: "integer", minimum: 0, maximum: 255 },
                g: { type: "integer", minimum: 0, maximum: 255 },
                b: { type: "integer", minimum: 0, maximum: 255 },
            },
        },
    },
});
```

##### Add a Property read handler

```javascript
let count = 0;
servient.start().then(async (WoT) => {
    WoT.produce({
        title: "counter",
        description: "counter example thing",
        properties: {
            count: {
                type: "integer",
            },
        },
    }).then((thing) => {
        thing.setPropertyReadHandler("count", async () => count);
        // expose the thing
        thing.expose().then(() => {
            // ...
        });
    });
});
```

You can specify if the thing needs to do something in case of a property read.
Here, a value is reported.

##### Add a Property write handler

```javascript
let count = 0;
servient.start().then(async (WoT) => {
    WoT.produce({
        title: "counter",
        description: "counter example thing",
        properties: {
            count: {
                type: "integer",
            },
        },
    }).then((thing) => {
        thing.setPropertyWriteHandler("count", async (intOutput, options) => {
            count = await intOutput.value();
            return undefined;
        });
        // ...
    });
});
```

You can specify if the thing needs do to something in case of a property write.
Here, the value is used to set the `count` value.

##### Add an Action definition to the Thing

Actions offer functions of the thing.
These functions may manipulate the interal state of a thing in a way that is not possible through setting properties.
Examples are changing internal state that is not exposed as a property, changing multiple properties, changing properties over time or with a process that shall not be disclosed.
Actions may also be pure functions, that is, they do not use any internal state at all, e.g. for processing input data and returning the result directly.

Just like properties above, adding actions is done as part of a WoT.produce() call.

```javascript
WoT.produce({
    title: "counter",
    actions: {
        increment: {
            title: "increment",
        },
    },
});
```

Note: `input` and `output` data types can be specified, similar to how property types are described in TDs.

##### Add an Action handler

You need to code what will happen if an action is invoked. This is done by setting an action handler:

```javascript
thing.setActionHandler("increment", () => {
    count = count + 1;
});
```

##### Add an Event definition to the Thing

The Event Interaction Affordance describes event sources that asynchronously push messages.
This means that instead of communicating state, state transitions (events) are communicated (e.g. "clicked").
Events may be triggered by internal state changes that are not exposed as Properties.
Events usually follow strong consistency, where messages need to be queued to ensure eventual delivery of all occured events.

Just like Actions above, Events are added as part of `WoT.produce`.
In the following, we will add the Event `onchange`:

```javascript
WoT.produce({
    title: "change",
    events: {
        onchange: {
            type: "number",
        },
    },
});
```

##### Emit Event, i.e. notify all listeners subscribed to that Event

```javascript
setInterval(async () => {
    ++count;
    thing.emitEvent("onchange", count);
}, 5000);
```

Here the event is triggered in regular intervals but emitting an event can be done based on other internal state changes.

<!-- * Attach semantic information to the Thing.
* Attach semantic information to a Property.
* Attach semantic information to an Action.
* Attach semantic information to an Event. -->
<!-- * Provide notifications for TD changes to clients subscribed to that.
* Mark/unmark the Thing to be discoverable. -->
<!-- * Mark/unmark the Thing to be consumable. -->
<!-- * Start the exposed Thing in order to process external requests.
```javascript
```
* Stop the exposed Thing.
```javascript
``` -->
<!-- * Register handlers for external requests:
  * to retrieve a Property value;
  * to update a Property value;
  * to run an Action: take the parameters from the request, execute the defined action, and return the result; -->

#### Interacting with another WoT Thing

Interacting with another WoT Thing is called consuming a Thing and works by using its Thing Description.

##### Fetch a Thing Description of a Thing given its URL

```javascript
WoT.requestThingDescription("http://localhost:8080/counter").then(async(td) => {
  // Do something with the TD
}
```

URLs can have various schemes, including `file://` to read from the local filesystem.

##### Consume a TD of a Thing, including parsing the TD and generating the protocol bindings in order to access lower level functionality

```javascript
WoT.requestThingDescription("http://localhost:8080/counter").then(async (td) => {
    const thing = await WoT.consume(td);
    // Do something with the consumed Thing
});
```

Things can be `consume`d no matter if they were fetched with `WoT.requestThingDescription()` or any other mean.
`consume` only requires a TD as an `Object`, so you could also use `fs.readFile` and `JSON.parse` or inline it into your code.
As long at it results in a TD Object, you can receive it over Fax, Morse it or use smoke signals.

#### On a consumed Thing

You can access all the interactions this Thing has and interact with them.

##### Read the value of a Property or set of properties

You can read the property values with the `readProperty` function.
It is an asynchronous function that will take some time to complete.
So you should handle it explicitely.
Here we use the await functionality of Node.js.

```javascript
let read = await thing.readProperty("count");
let value = await read.value();
console.info("count value is", value);
```

##### Set the value of a Property or a set of properties

You can write to a property by using the `writeProperty` function.

```javascript
await thing.writeProperty("color", { r: 255, g: 255, b: 0 });
```

<!-- * Observe value changes of a Property. -->

##### Invoke an Action

You can invoke an action by using the `invokeAction` function.
It is an asynchronous function that will take some time to complete.
So you should handle it explicitly.
Here we use the `async`/`await` functionality of NodeJS.

Declare the surrounding function as `async`, e.g., the `WoT.requestThingDescription()` resolve handler:

```javascript
WoT.requestThingDescription(myURI).then(async(td) => { ... });
```

Use `await` to make Promises synchronous (blocking):

```javascript
await thing.invokeAction("increment");
// or passing a value
await thing.invokeAction("print", "this is a test");
```

<!--   * Observe Events emitted by the Thing.
  ```javascript
  ``` -->
  <!-- * Observe changes to the Thing Description of the Thing. -->
  <!-- * Get the Thing Description. -->
  <!-- * Get the list of linked resources based on the Thing Description. -->
