### What to do with the library
The two main functionalities of node-wot are creating WoT Things and interacting with other WoT Things.
These can be combined into a Thing that interacts with other Things.

#### Creating a WoT Thing
Creating a WoT Thing is called exposing a Thing.
Exposing a Thing creates a Thing Description that can be used to by others to interact with this Thing.

##### Starting a Servient
```javascript
WotCore = require("@node-wot/core")
let servient = new WotCore.Servient();
let WoT = await servient.start();
```

##### In Client mode, add factories
```javascript
WotCore = require("@node-wot/core")
BindingHttp = require("@node-wot/binding-http")
BindingCoap = require("@node-wot/binding-coap")
let servient = new NodeWoTCore.Servient();
servient.addClientFactory(new BindingHttp.HttpClientFactory())
servient.addClientFactory(new BindingCoap.CoapClientFactory())
```
The different bindings offer client factories.
These need to be added in order to be able to access devices through this protocol.

For more details on bindings, e.g. configuration options for a specific `*ClientFactory`, look at the `README.md` files in their respective directories.

##### In Server mode, add servers
```javascript
WotCore = require("@node-wot/core")
CoapServer = require("@node-wot/binding-coap").CoapServer
let servient = new WotCore.Servient();
servient.addServer(new CoapServer());
```
Same as for clients, bindings offer servers.


##### Credentials
```javascript
let servient = new (require("@node-wot/core")).Servient();
servient.addCredentials({
    "urn:dev:ops:32473-example-thing": {
        "username": "admin",
        "password:" "password"  // if you copy these and don't change them, don't claim you were "hacked"
    }
);
```
You can add credentials like this.
They are either used to authenticate clients when running in server mode or used to authenticate against servers when running in client mode.

This example uses `username` and `password`, but other authentication mechanisms are supported as well.
Authentication data is always mapped to a Thing through its id.

##### Expose a Thing
```javascript
let thing = WoT.produce({
  title: "counter",
  description: "counter example Thing"
});

// any other code to develop the Thing

thing.expose();
```
Here, an object named `thing` is produced. At this stage, it has only a name and a description for humans to read.
`thing.expose();` exposes/starts the exposed Thing in order to process external requests. This also creates a Thing Description that describes the interfaces of the `counter` thing.


##### Add a Property definition to the Thing
Properties expose internal state of a Thing that can be directly accessed (get) and optionally manipulated (set).

They are added as part of the `WoT.produce` invocation, like so:
```javascript
WoT.produce({
  title: "property",
  properties: {
    counter: {
      type: "integer",
      description: "current counter value",
      observable: false
    }
  }
});
```
This creates a Property.
Its value can be initializes by calling `writeProperty`, otherwise it reads as `null`.
After being written to, the value can be read by other Things.

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
      }
    }
  }
});
```

##### Add a Property read handler

```javascript
thing.setPropertyReadHandler(
  "counter",
  (propertyName) => {
    console.log("Handling read request for " + propertyName);
    return new Promise((resolve, reject) => {
      resolve(Math.random(100));
    })
  });
```
You can specify if the Thing needs to do something in case of a property read.
Here, instead of reading a static value, a new random value is generated on every invocation.

##### Add a Property write handler

```javascript
thing.setPropertyWriteHandler('brightness', (value) => {
  return new Promise((resolve, reject) => {
    value %= 2; // only even values are valid in this example
    setBrightness(value);
    resolve(value);
  });
});
```
You can specify if the Thing needs do to something in case of a property write.
Here, the value written is used to set the brightness of an LED that requires a specific function (`setBrightness()`) to do that.
The property value becomes the value passed to `resolve()`, which in this case would mean the number modulo 2.

##### Add an Action definition to the Thing
Actions offer functions of the Thing.
These functions may manipulate the interal state of a Thing in a way that is not possible through setting Properties.
Examples are changing internal state that is not exposed as a Property, changing multiple Properties, changing Properties over time or with a process that shall not be disclosed.
Actions may also be pure functions, that is, they do not use any internal state at all, e.g. for processing input data and returning the result directly.

Just like Properties above, adding Actions is done as part of a WoT.produce() call.

```javascript
WoT.produce({
  title: "action",
  actions: {
    echo: {
      description: "Returns what it gets passed. Subject to SLA. Will probably terminate at null-bytes, because it treats input as strings."
      input: { type: "string" },
      output: { type: "string" }
    }
  }
})
```

As can be seen above, `input` and `output` data types can be specified, similar to how property types are described in TDs.

##### Add an Action invoke handler
You need to write what will happen if an Action is invoked. This is done by setting an Action Handler:

```javascript
thing.setActionHandler("increment", () => {
  console.log("Incrementing");
  return thing.readProperty("counter").then((count) => {
    let value = count + 1;
    thing.writeProperty("counter", value);
  });
});
  ```
Here, you see also how to access the properties of a Thing you are creating.

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
      type: "number"
    }
  }
});
```

##### Emit Event, i.e. notify all listeners subscribed to that Event
```javascript
setInterval(async() => {
  ++counter;
  thing.emitEvent("onchange", counter);
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
WoTHelpers.fetch("http://localhost:8080/counter").then(async(td) => {
  // Do something with the TD
}
```
URLs can have various schemes, including `file://` to read from the local filesystem.

##### Consume a TD of a Thing, including parsing the TD and generating the protocol bindings in order to access lower level functionality
```javascript
WoTHelpers.fetch("http://localhost:8080/counter").then(async(td) => {
  let thing = WoT.consume(td);
  // Do something with the consumed Thing
});
```
Things can be `consume`d no matter if they were fetched with WoTHelpers or not.
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
let read1 = await thing.readProperty("count");
console.info("count value is", read1);
```

##### Set the value of a Property or a set of properties
You can write to a property by using the `writeProperty` function.

```javascript
thing.writeProperty("color", { r: 255, g: 255, b: 0 });
```
<!-- * Observe value changes of a Property. -->

##### Invoke an Action
You can invoke an action by using the `invokeAction` function.
It is an asynchronous function that will take some time to complete.
So you should handle it explicitly.
Here we use the `async`/`await` functionality of NodeJS.

Declare the surrounding function as `async`, e.g., the `WoTHelpers.fetch()` resolve handler:
```javascript
WoTHelpers.fetch(myURI).then(async(td) => { ... });
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
