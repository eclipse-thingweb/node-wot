### What to do with the library

Two main functionalities of node-wot is to creating a WoT Thing and interacting with another WoT Thing. These can be also combined to have a Thing interacts with other Things.

#### Creating a WoT Thing
Creating a WoT Thing is called exposing a Thing. Exposing a Thing creates a Thing Description that can be used to by others to interact with this Thing.

* Exposing a Thing:

```javascript
let thing = WoT.produce({
  name: "counter",
  description: "counter example Thing"
});

//any other code to develop the Thing

thing.expose();
```
Here, an object named thing is produced. At this stage, it has only a name and a description for humans to read.
'thing.expose();' exposes/starts the exposed Thing in order to process external requests. This also creates a Thing Description that describes the interfaces of the thing Thing.


* Add a Property definition to the Thing.

Properties expose internal state of a Thing that can be directly accessed (get) and optionally manipulated (set).

```javascript
thing.addProperty(
  "counter",
  {
    type: "integer",
    description: "current counter value",
    observable: false,
    writeable: true
  },
123);
```
This creates a Property and initializes it with the value `123`. This value can be read by other Things.

You can create a Property that has a more complex type, such as an object. This is shown in the following:

```javascript
thing.addProperty(
  "color",
  {
    type: "object",
    properties: {
      r: { type: "integer", minimum: 0, maximum: 255 },
      g: { type: "integer", minimum: 0, maximum: 255 },
      b: { type: "integer", minimum: 0, maximum: 255 },
    },
    writable: true
  },
  { r: 0, g: 0, b: 0 } 
)
```
  * Add a Property read handler

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
You can specify if the Thing needs to something in case of a property read. Here, instead of reading a static value, a random value is generated just for this read case.

  * Add a Property write handler
```javascript
thing.setPropertyWriteHandler(
  "brightness",
  (value : any) => {
    return new Promise((resolve, reject) => {
      setBrightness(value);
      resolve(value);
    });
  });
```
You can specify if the Thing needs to something in case of a property write. Here, the value written is used to set the brightness of an LED that requires a specific function (`setBrightness()`)to do that. 

* Add an Action definition to the Thing.

Actions offer functions of the Thing. These functions may manipulate the interal state of a Thing in a way that is not possible through setting Properties. Examples are changing internal state that is not exposed as Property, changing multiple Properties, changing Properties over time or with a process that shall not be disclosed. Actions may also be pure functions, that is, they do not use any internal state at all, e.g., for processing input data and returning the result directly. You can add an Action like in the following:

```javascript
thing.addAction("increment");
```

Or you can specify what `input` data it needs to be executed or what `output` data it will respond with after the Action has been completed. In the following, an input data is specified:

```javascript
thing.addAction(
  "gradient",
  {
    input: { //here you can put output to specify output data
      type: "array",
      items: {
        type: "object",
        properties: {
          r: { type: "integer", minimum: 0, maximum: 255 },
          g: { type: "integer", minimum: 0, maximum: 255 },
          b: { type: "integer", minimum: 0, maximum: 255 },
        }
      },
      "minItems": 2
    }
  });
```
  * Add an Action invoke handler 

You need to write what will happen if an Action is invoked. This is done by setting an Action Handler:

  ```javascript
thing.setActionHandler(
  "increment",
  () => {
    console.log("Incrementing");
    return thing.properties.counter.read().then( (count) => {
      let value = count + 1;
      thing.properties.counter.write(value);
    });
  }
);
  ```
Here, you see also how to access the properties of a Thing you are creating.

* Add an Event definition to the Thing.

The Event Interaction Pattern describes event sources that asynchronously push messages. Here not state, but state transitions (events) are communicated (e.g., "clicked"). Events may be triggered by internal state changes that are not exposed as Properties. Events usually follow strong consistency, where messages need to be queued to ensure eventual delivery of all occured events.

In the following, we add an Event `onchange`:

```javascript
thing.addEvent(
  "onchange",
  {
    type: "number"
  });
```
  * Emit Event, i.e. notify all listeners subscribed to that Event.
  
  ```javascript
setInterval( async () => {
  ++counter;
  thing.events.onchange.emit(counter);
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

* Fetch a Thing Description of a Thing given its URL.
```javascript
WoT.fetch("http://localhost:8080/counter").then( async (td) => {

// Do something with the TD

}
```
* Consume a TD of a Thing, including parsing the TD and generating the protocol bindings in order to access lower level functionality.
```javascript
WoT.fetch("http://localhost:8080/counter").then( async (td) => {

  let thing = WoT.consume(td);
  
  //do something with the consumed Thing

  });

```
* On a consumed Thing

You can access all the interactions this Thing has and interact with them.
  
  * Read the value of a Property or set of properties.
  
  You can read the property values with the `read` function. It is an asynchronous function that will take some time to complete. So you should handle it explicitely. Here we use the await functionality of node.js.

  ```javascript
  let read1 = await thing.properties.count.read();
  console.info("count value is", read1);
  ```
  * Set the value of a Property or a set of properties.

You can write to a property by using the `write` function.

  ```javascript
thing.properties.color.write({ r: 255, g: 255, b: 0 } );
  ```
  <!-- * Observe value changes of a Property. -->

  * Invoke an Action.

  You can invoke an action by using the `invoke` function. It is an asynchronous function that will take some time to complete. So you should handle it explicitly. Here we use the `async`/`await` functionality of NodeJS.

  Declare the surrounding function as `async`, e.g., the `WoT.fetch()` resolve handler:
  ```javascript
  WoT.fetch(myURI).then( async (td) => { ...;
  ```

  Use `await` to make Promises synchronous (blocking):
  ```javascript
  await thing.actions.increment.invoke();
  ```

<!--   * Observe Events emitted by the Thing.
  ```javascript
  ``` -->
  <!-- * Observe changes to the Thing Description of the Thing. -->
  <!-- * Get the Thing Description. -->
  <!-- * Get the list of linked resources based on the Thing Description. -->
