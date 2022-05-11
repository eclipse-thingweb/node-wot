# Exposed Thing with node-wot as Dependency

## Introduction

In this document, we aim to introduce how to use the node-wot libraries to implement an Exposed Thing.
Differently from the [Thingweb Hands-on](http://www.thingweb.io/hands-on.html), here we will show to use TypeScript along with node-wot as an npm dependency rather than cloning a GitHub repository.
The aim is to establish an easy to understand and reusable template that can be used to implement any Exposed Thing.
Some devices that use this template can be found [here](https://github.com/tum-esi/wot-sys/tree/master/Devices).

Using TypeScript gives type safety and the separation of source and build directories.
Using node-wot as an npm dependency allows faster installation and also being able to install only what is needed for the given project.
For example, this way one can install only the CoAP binding if the device will only communicate with CoAP.

The source files can be found [at the examples folder of node-wot](https://github.com/eclipse/thingweb.node-wot/tree/master/examples/templates/exposed-thing). You should modify this code to match your needs.

## Code Structure

The structure can be seen in two parts:

-   `index.js` that is run with `npm run start` where the different protocol bindings and parameters such as a TD directory address is added. In this filem one would expect to see no device specific libraries or logic. For example, if you are moving a robot from left to right, a handler for this action should not be present. Once the `index.js` is set up, there should not be any need to edit this file, the work should continue in the `src` folder.
-   `src` folder is where the TypeScript sources are found. Upon running `npm run build` the contents of this folder will be transcompiled into JavaScript and will found in `dist` folder. The TypeScript file `src/base.ts` is where the actual logic of the Exposed Thing is. In this file, we add the TD, different interaction affordances, handlers and TD registration.

We can thus summarize it like:

-   `index.js`: Starting point of the Exposed Thing, analogous to `index.html` of websites. This is also common practice for npm packages.
-   `src` folder: Logic of the Exposed Thing in TypeScript source format
-   `dist` folder: Transcompiled logic of the Exposed Thing in JavaScript source format that is used by `index.js`
-   `package.json`: npm dependencies of the Exposed Thing project. Here you will find the different protocol bindings.

## Code Explanation

Here, we will explain what every (or most!) of the lines do. If you just want to use it, skip to [What to change and get running](#what-to-change-and-get-running).

### package.json

-   `devDependencies`: These are the dependencies that will be used during development time.
    Most importantly, `wot-typescript-definitions` is needed in order for TypeScript to understand what is `WoT`, `ExposedThing` etc.

```js
{
    ...
    "devDependencies": {
        "typescript": "4.4.3",
        "wot-typescript-definitions": "0.8.0-SNAPSHOT.22", //update this accordingly
        "@types/node": "16.4.13",
        "tslint": "5.12.1"
    }
    ...
}
```

-   `dependencies`: These are dependencies that will be used in development and runtime.
    Here you will put the bindings that are required. `@node-wot/core` is always needed so that functions like `produce()`, `start()` are available.
    We also use the [request](https://www.npmjs.com/package/request) library for registration of the TD to a directory via HTTP and the [ajv](https://www.npmjs.com/package/ajv) for validation of inputs with the DataSchema of the TD.
    Below is an example with the HTTP binding but you can change it to [CoAP](https://www.npmjs.com/package/@node-wot/binding-coap) or [MQTT](https://www.npmjs.com/package/@node-wot/binding-mqtt) or anything else that node-wot supports.

```js
{
  ...
  "dependencies": {
    "@node-wot/binding-http": "0.8.0", //update this accordingly
    "@node-wot/core": "0.8.0", //update this accordingly
    "request": "2.88.0",
    "ajv": "^7.0.4"
  }
  ...
}
```

-   `scripts`: These are the scripts that are used to build, run and clean the repository.
    Other than the `clean` script, they are cross-platform, i.e. can run on Linux, macOS or Windows.

-   others: You can also change your package name, description, author, license etc. and adapt to your needs.

### index.js

`index.js` is the entry point of the script. Here we create and add the necessary servers such as HTTP, CoAP or MQTT to the servient and then start it.
Upon start, a WoT object will be created and passed to the `base.ts` (or `base.js` when transcompiled) where the actual device implementation is.

-   `WotDevice = require("./dist/base.js").WotDevice` links to the actual device implementation. In case you change `base.ts` with another name, you should adapt this line.
-   `const TD_DIRECTORY = ""` specifies the TD directory URI. You can comment it out to remove the registration function.
-   `Servient = require("@node-wot/core").Servient` and `var servient = new Servient();` are responsible for creating a servient. Then different servers (bindings) can be added before starting it. A servient can even contain multiple exposed things.
-   Bindings: Does linking, creating and adding of different bindings to the servient, respectively. If you want to change the bindings, you can comment them out. For each binding, the `package.json` file should be also changed and `npm install` should be run to ensure that the dependencies are installed. A change on the bindings should not cause any change in the `base.ts` file.
-   Starting the servient: After starting the servient, which does nothing without any ExposedThing, exposed thing(s) should be added. As you can see, this is where we make the reference to the `WoTDevice` created previously. You can add more than one `WoTDevice` (could be called anything). node-wot puts multiple ExposedThings under one servient differentiating them by their names. Thus, one can have `http://localhost:8080/counter/` and `http://localhost:8080/mywotdevice/` served from the servient.

### base.ts

This is where the logic of the ExposedThing is implemented and its TD can be seen.

-   WoT object: The WoT object allows the use of methods such as `produce()` which are used with a servient. As it can be seen, in `base.ts` there is no link to a servient that is created in the `index.js` file and used to pass a WoT object. Similar to the CLI, this file relies on the WoT object which is defined using the `wot-typescript-definitions`.
-   request and TD registration: [request](https://www.npmjs.com/package/request) is a very simple library for HTTP requests. In this script, we use it to send an HTTP POST request to a TD directory with its TD as the payload. When the ExposedThing is exposed, the registrer method is called with its TD. Code lines implement the registration methods to the given TD Directory address. We wait 10 seconds before trying again, which recursively calls itself, meaning that every 10 seconds it will try to register its TD. If the `TD_DIRECTORY` is not defined in `index.js` this method will not be executed.
-   JSON Schema Validation: We use [ajv](https://www.npmjs.com/package/ajv) for JSON Schema validation, which is to this date the fastest and the most up-to-date JSON Schema validation library in npm. You can use it in the handlers of action invokes or property writes in order to validate the data sent by the Consumer. In order to use ajv, we include it and instantiate it. How it can be used is seen where an invalid data is responded with "Invalid input" error.
-   WoTDevice class: WoTDevice gets the WoT object from the servient and TD Directory address for its constructor. It has attributes `thing`, `WoT` and `td`. `thing` is instantiated as a result of the `produce()` method. `td` is available from an ExposedThing using the `getThingDescription()` method. To avoid multiple calls to this method, we save it as the `td` attribute.
-   Thing Description: `WoT.produce()` takes as TD as argument and returns an ExposedThing. In this script, we use a TD with 1 property, 1 action and 1 event in order to demonstrate scripting for all interaction affordances. They are all named `myX` with X being an Interaction Affordance like property, action or event.
-   `initializeProperties()`
-   `initializeActions()`
-   ...

## What to change and get running

If you don't need to understand everything in the code, just make sure you do the following at least before installing, building and running:

-   `package.json`:
    -   Change `package.json` to include the bindings you want, e.g. add ` "@node-wot/binding-coap": "0.8.0",` to dependencies.
    -   Change npm related information such as `name`, `version` etc.
-   `index.js`:
    -   Add the required bindings in `index.js` in 3 locations:
        -   `CoapServer = require("@node-wot/binding-coap").CoapServer`
        -   `var coapServer = new CoapServer({port: 5683});`
        -   `servient.addServer(coapServer);`
    -   Change or remove the TD_DIRECTORY value in `index.js`
-   `base.ts`:
    -   Change the TD passed to `produce()` method
    -   Write a property handler for different properties
    -   Write an action invoke handler for different actions
    -   Decide when to emit events
    -   ...

### Installation and Running

-   Get the latest node.js:

```bash
curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs
```

You will need to change 16.x to a newer version if needed

-   To install dependencies: `npm install`
-   To build (transcompiling Typescript to javascript): `npm run build`
-   To run the code: `npm run start`

## Change from Version 0.7.X to 0.8.X for Exposed Things

Version 0.8.X handles properties and interaction inputs differently than previous versions. Below is the list of changes:

-   Properties are not handled internally by node-wot anymore. Property handlers need to read and write to variables or class members that are explicitly defined in the code for the Exposed Things
-   The value of interaction inputs cannot be accessed directly. `WoT.InteractionInput` objects have a member function `value()` that returns a promise that will resolve to the value of the input when available. You can either use `input.value().then(...)` or `await input.value()` in an `async` function.

## Change from Version 0.6.X to 0.7.X for Exposed Things

Resulting from the discussions in the Scripting API, the API has changed on 28.10.2019. This was a rather big change that also resulted changes in node-wot. Below is a list of changes:

-   You need to pass a full TD (but without forms) as argument to the `produce()` method. Before only non interaction information were passed.
-   You cannot do `myExposedThing.td` and have to pass through `myExposedThing.getThingDescription()`
-   `WoTFactory` is replaced by `WoT` in `wot-typescript-definitions`. You thus see `WoT.produce()` instead of `thingFactory.produce()`
-   Since you pass a whole TD to `produce()` method, you don't need `addProperty`, `addAction` and `addEvent`.
-   Instead of `this.thing.events[myEvent].emit(myPayload);` there is `this.thing.emitEvent(myEvent,myPayload);`
-   You have to use `setActionHandler` whereas before you could assign the handler in the `addAction` like `addAction(name,metadata,handler)`.
-   Since you cannot pass the initial value for a property with `addProperty`, you have to do a `writeProperty(myInitialValue)` _at some point_.
-   You cannot change the TD of an ExposedThing, i.e. you cannot do `thing.id="thingweb:io:example"`.

You can see a git diff [here](https://github.com/tum-esi/wot-sys/commit/6cef8530b3317d98c2a7dea389c92ba2786be892#diff-0d33955cb472f41f07397fc2687c6425R10)
