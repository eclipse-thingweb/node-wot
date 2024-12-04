<h1>
  <picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/eclipse-thingweb/thingweb/master/brand/logos/node-wot_for_dark_bg.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/eclipse-thingweb/thingweb/master/brand/logos/node-wot.svg">
  <img title="ThingWeb node-wot" alt="Thingweb node-wot logo" src="https://raw.githubusercontent.com/eclipse-thingweb/thingweb/master/brand/logos/node-wot.svg" width="300">
</picture>
</h1>

> A fast and extensible framework to connect any device with your application

[![Default CI Pipeline](https://github.com/eclipse-thingweb/node-wot/actions/workflows/ci.yaml/badge.svg)](https://github.com/eclipse-thingweb/node-wot/actions/workflows/ci.yaml)
[<img alt="npm" src="https://img.shields.io/npm/dw/@node-wot/core">](https://npm-stat.com/charts.html?package=%40node-wot%2Fcore)
[![codecov](https://codecov.io/gh/eclipse-thingweb/node-wot/branch/master/graph/badge.svg)](https://codecov.io/gh/eclipse-thingweb/node-wot)
[![Telegram Group](https://img.shields.io/endpoint?color=neon&url=https%3A%2F%2Ftg.sumanjay.workers.dev%2Fnodewot)](https://t.me/nodewot)
[![Discord](https://img.shields.io/badge/Discord-7289DA?logo=discord&logoColor=white&label=node-wot)](https://discord.gg/JXY2Jzefz3)
[![Static Badge](https://img.shields.io/badge/Show%20Adopters%20and%20Users-%2331b8a3ff?logoColor=31b8a3ff)](https://github.com/eclipse-thingweb/node-wot#adopters)

The Eclipse Thingweb node-wot is a framework for implementing [Web of Things](https://www.w3.org/WoT/) servers and clients in Node.js. It is written from the ground up with Typescript with the goal of providing a fast and extensible framework for IoT applications. Node-wot wants to give developers the ability to create complex business logic without worrying about protocol and low-level details leveraging on a standard metadata format, the [Thing Description (TD)](https://www.w3.org/TR/wot-thing-description11/). Thanks to the TD abstraction developers can find a set of satellite tools to create their applications in a fast and easy way.

## Web of Things principles in a Nutshell

The Web of Things (WoT) tackles IoT fragmentation by extending standardized web technologies. It simplifies IoT application development, promoting flexibility and interoperability. WoT preserves existing IoT standards, ensuring reuse, and provides an adaptable, abstract architecture based on real-world use cases across domains. In essence, WoT paves the way for seamless IoT integration by defining an information model capable of describing Things and Services and how to interact with them. This information model is called the Thing Description (TD) and it is a JSON-LD document that describes the Thing and its capabilities, including its network services (APIs), its network interactions, and security requirements. The TD is the cornerstone of the Web of Things architecture and it is the main abstraction that node-wot uses to implement its functionalities. Every Thing has the following capabilities or "affordances":

-   **⚙️ Properties**: a property is a value that can be read, written or observed. For example, a temperature sensor can have a property that represents the current temperature.
-   **🦾 Actions**: an action is an operation that can be invoked. For example, a light bulb can have an action that turns it on or off.
-   **⚡ Events**: an event is a notification. For example, a motion sensor can send an event when it detects motion.

For further information please refer to the official [W3C Web of Things](https://www.w3.org/WoT/) website.

### Table of Contents

<!-- https://ecotrust-canada.github.io/markdown-toc/ -->

-   [Installation](#installation)
    -   [As a library](#as-a-library)
        -   [Node.js](#nodejs)
        -   [Browser](#browser)
    -   [As a CLI tool](#as-a-cli-tool)
        -   [As a docker image](#as-a-docker-image)
-   [Examples](#examples)
-   [Implemented/supported features](#implementedsupported-features)
    -   [Protocol Support](#protocol-support)
    -   [MediaType Support](#mediatype-support)
-   [No time for explanations - show me a running example!](#no-time-for-explanations---show-me-a-running-example)
    -   [Using Node.js](#using-nodejs)
    -   [Using Docker](#using-docker)
    -   [Using a browser](#using-a-browser)
-   [Online Things](#online-things)
-   [Documentation](#documentation)
    -   [The API](#the-api)
    -   [TD Tooling](#td-tooling)
    -   [Logging](#logging)
    -   [Install new/different versions of Node.js](#install-newdifferent-versions-of-nodejs)
-   [Contributing](#contributing)
-   [License](#license)

## Installation

The framework can be used in two ways: as a library or as a CLI tool. In this section we will explain how to install the framework in both ways.

### As a library

The framework is composed by different packages that users can use as they please. The core package is `@node-wot/core` and it is the only mandatory package to install. The other packages are bindings that allow the framework to communicate with different protocols.

#### Node.js

> [!WARNING]
> We no longer actively support Node.js version 16 and lower.

-   [Node.js](https://nodejs.org/) version 18+
-   [npm](https://www.npmjs.com/) version 9+

Platforms specific prerequisites:

-   Linux: Meet the [node-gyp](https://github.com/nodejs/node-gyp#installation) requirements:
    -   Python v3.6, v3.7, or v3.8
    -   make
    -   A proper C/C++ compiler toolchain, like GCC
-   Windows: Install the Windows build tools through a CMD shell as administrator:
    -   `npm install -g --production windows-build-tools`
-   Mac OS: Meet the [node-gyp](https://github.com/nodejs/node-gyp#installation) requirements:
    -   `xcode-select --install`

If you want to use node-wot as a library in your Node.js application, you can use npm to install the node-wot packages that you need. To do so, `cd` inside your application folder, and run:

```
npm i @node-wot/core @node-wot/binding-http --save
```

#### Browser

To use node-wot as a browser-side JavaScript Library, the browser needs to support ECMAScript 2015.

Using a browser with only ES5 support (e.g., IE 11) might be possible if you add polyfills. If you want to use node-wot as a library in your browser application, you can install the `@node-wot/browser-bundle` as following:

```
npm i @node-wot/browser-bundle --save
```

you can find more installation options in the specific [package README](./packages/browser-bundle/README.md).

### As a CLI tool

You can alternatively use node-wot via its command line interface (CLI). Please visit the [CLI tool's Readme](<[url](https://github.com/eclipse-thingweb/node-wot/tree/master/packages/cli)>) to find out more.

#### As a docker image

Another option is to use node-wot inside a docker image. Make sure you are under Linux or under WSL if you are running on Windows.

Clone the repository:

```
git clone https://github.com/eclipse-thingweb/node-wot
```

Go into the repository:

```
cd node-wot
```

Build the Docker image named `wot-servient` from the `Dockerfile`:

```
npm run build:docker
```

Run the wot-servient as a container:

```
docker run --rm wot-servient -h
```

## Examples

With node-wot you can create server-side Things, in WoT jargon we call this operation "expose a Thing" or you can create client-side Things, in WoT jargon we call this operation "consume a Thing". An exposed Thing allows you to bring your device or services to the Web with just a few lines of code. On the other hand, with a consumed Thing, you have a fixed interface to interact with devices, potentially using different protocols/frameworks. In the following section, we will show how to create a simple counter Thing and how to consume it. Assuming you have installed and configured node-wot as a library, you can create and expose a counter Thing as follows:

```JavaScript
// Required steps to create a servient for creating a thing
const { Servient } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");

const servient = new Servient();
servient.addServer(new HttpServer());

servient.start().then( async (WoT) => {
    // Then from here on you can use the WoT object to produce the thing
    let count = 0;
    const exposingThing = await WoT.produce({
        title: "Counter",
        description: "A simple counter thing",
        properties: {
            count: {
                type: "integer",
                description: "current counter value",
                observable: true,
                readOnly: true
            }
        },
        actions: {
            increment: {
                description: "increment counter value",
            }
        }
    })
    exposingThing.setPropertyReadHandler("count", () => { return count; });
    exposingThing.setActionHandler("increment", () => { count++; exposingThing.emitPropertyChange("count"); });
    await exposingThing.expose();
    // now you can interact with the thing via http://localhost:8080/counter
});
```

Now supposing you want to interact with the device, you have to consume its Thing Description as follows:

```JavaScript
// client.js
// Required steps to create a servient for a client
const { Servient } = require("@node-wot/core");
const { HttpClientFactory } = require("@node-wot/binding-http");

const servient = new Servient();
servient.addClientFactory(new HttpClientFactory(null));

servient.start().then(async (WoT) => {
    const td = await WoT.requestThingDescription("http://localhost:8080/counter");
    // Then from here on you can consume the thing
    let thing = await WoT.consume(td);
    thing.observeProperty("count", async (data) => { console.log("count:", await data.value()); });
    for (let i = 0; i < 5; i++) {
        await thing.invokeAction("increment");
    }
}).catch((err) => { console.error(err); });
```

If you execute both scripts you will see `count: ${count}` printed 5 times. We host a more complex version of this example at [http://plugfest.thingweb.io/examples/counter.html](http://plugfest.thingweb.io/examples/counter.html) and you can find the source code in the [counter example](./examples/browser) folder. You can also find more examples in the [examples folder](./examples/scripts) for JavaScript and in the [examples folder](./packages/examples/) for TypeScript. Finally, for your convenience, we host a set of online Things that you can use to test your applications. You can find more information about them in the [Online Things](#online-things) section.

## Implemented/supported features

### Protocol Support

-   [HTTP](https://github.com/eclipse-thingweb/node-wot/blob/master/packages/binding-http/README.md) :heavy_check_mark:
-   [HTTPS](https://github.com/eclipse-thingweb/node-wot/blob/master/packages/binding-http/README.md) :heavy_check_mark:
-   [CoAP](https://github.com/eclipse-thingweb/node-wot/blob/master/packages/binding-coap/README.md) :heavy_check_mark:
-   [CoAPS](https://github.com/eclipse-thingweb/node-wot/blob/master/packages/binding-coap/README.md) :heavy_check_mark:
-   [MQTT](https://github.com/eclipse-thingweb/node-wot/blob/master/packages/binding-mqtt/README.md) :heavy_check_mark:
-   ~~[Firestore//lastSupportedVersion](https://github.com/eclipse/thingweb.node-wot/blob/v0.8.6/packages/binding-firestore/README.md) :heavy_check_mark:~~
-   [Websocket](https://github.com/eclipse-thingweb/node-wot/tree/master/packages/binding-websockets) :heavy_plus_sign: (Server only)
-   [OPC-UA](https://github.com/eclipse-thingweb/node-wot/blob/master/packages/binding-opcua/README.md) :heavy_plus_sign: (Client only)
-   [NETCONF](https://github.com/eclipse-thingweb/node-wot/blob/master/packages/binding-netconf/README.md) :heavy_plus_sign: (Client only)
-   [Modbus](https://github.com/eclipse-thingweb/node-wot/tree/master/packages/binding-modbus) :heavy_plus_sign: (Client only)
-   [M-Bus](https://github.com/eclipse-thingweb/node-wot/tree/master/packages/binding-mbus) :heavy_plus_sign: (Client only)

> [!NOTE]
> More protocols can be easily added by implementing `ProtocolClient`, `ProtocolClientFactory`, and `ProtocolServer` interface.

> [!NOTE]
> The bindings for [binding-fujitsu](https://github.com/eclipse-thingweb/node-wot/tree/v0.7.x/packages/binding-fujitsu) and [binding-oracle](https://github.com/eclipse-thingweb/node-wot/tree/v0.7.x/packages/binding-oracle) were removed after `v0.7.x` due to lack of maintainers.

### MediaType Support

-   JSON :heavy_check_mark:
-   Text (HTML, CSS, XML, SVG) :heavy_check_mark:
-   Base64 (PNG, JPEG, GIF) :heavy_check_mark:
-   Octet stream :heavy_check_mark:
-   CBOR :heavy_check_mark:
-   EXI :timer_clock:

Can't find your preferred MediaType? More codecs can be easily added by implementing `ContentCodec` interface. Read more in the [Documentation](#documentation) section.

## No time for explanations - show me a running example!

### Using Node.js

Run all the steps above including "Link Packages" and then run this:

```
wot-servient -h
cd examples/scripts
wot-servient
```

Without the "Link Packages" step, the `wot-servient` command is not available and `node` needs to be used (e.g., Windows CMD shell):

```
# expose
node packages\cli\dist\cli.js examples\scripts\counter.js
# consume
node packages\cli\dist\cli.js --client-only examples\scripts\counter-client.js
```

-   Go to http://localhost:8080/counter and you'll find a thing description
-   Query the count by http://localhost:8080/counter/properties/count
-   Modify the count via POST on http://localhost:8080/counter/actions/increment and http://localhost:8080/counter/actions/decrement
-   Application logic is in `examples/scripts/counter.js`

### Using Docker

First [build the docker image](#as-a-docker-image) and then run the counter example:

```
# expose
docker run -it --init -p 8080:8080/tcp -p 5683:5683/udp -v "$(pwd)"/examples:/srv/examples --rm wot-servient /srv/examples/scripts/counter.js
# consume
docker run -it --init -v "$(pwd)"/examples:/srv/examples --rm --net=host wot-servient /srv/examples/scripts/counter-client.js --client-only
```

-   The counter exposes the HTTP endpoint at 8080/tcp and the CoAP endpoint at 5683/udp and they are bound to the host machine (with `-p 8080:8080/tcp -p 5683:5683/udp`).
-   The counter-client binds the network of the host machine (`--net=host`) so that it can access the counter thing's endpoints.
-   `--init` allows the containers to be killed with SIGINT (e.g., Ctrl+c)
-   `-v "$(pwd)"/examples:/srv/examples` mounts the `examples` directory to `/srv/examples` on the container so that the node inside the container can read the example scripts.

### Using a browser

An example of how to use node-wot as a browser-side library can be found under `examples/browser/index.html`.
To run it, open [`examples/browser/index.html`](http://plugfest.thingweb.io/webui/) in a modern browser, and consume the test Thing available under `http://plugfest.thingweb.io:8083/testthing` to interact with it.

The JavaScript code that uses node-wot as a library to power this application can be found under: `examples/browser/index.js`

## Online Things

We offer online simulated Things that are available to be used by anyone.

Their TDs are available at the following links:

-   Counter: HTTP at <http://plugfest.thingweb.io:8083/counter> and CoAP at <coap://plugfest.thingweb.io:5683/counter>
-   Smart Coffee Machine: HTTP at <http://plugfest.thingweb.io:8083/smart-coffee-machine> and CoAP at <coap://plugfest.thingweb.io:5683/smart-coffee-machine>
-   TestThing: HTTP at <http://plugfest.thingweb.io:8083/testthing> and CoAP at <coap://plugfest.thingweb.io:5683/testthing>
-   Presence sensor: MQTT at <https://zion.vaimee.com/things/urn:uuid:0a028f8e-8a91-4aaf-a346-9a48d440fd7c>
-   Smart Clock: CoAP at <https://zion.vaimee.com/things/urn:uuid:913cf8cb-3687-4d98-8d2f-f6f27cfc7162>
-   Simple Coffee Machine: HTTP at <https://zion.vaimee.com/things/urn:uuid:7ba2bca0-a7f6-47b3-bdce-498caa33bbaf>

All of them require no security mechanism to be communicated with.
Below are small explanations of what they can be used for:

-   Counter: It has a count property that can be read or observed and can be incremented or decremented via separate actions.
    It is also possible to reset the count value, obtain when the last change occurred, subscribe to a change in the count value or get the count value as an image.
-   TestThing: This Thing exists primarily for testing different data schemas and payload formats. It also has events attached to affordances that notify when a value changes.
-   Smart Coffee Machine: This is a simulation of a coffee machine that also has a [simple user interface](http://plugfest.thingweb.io/examples/smart-coffee-machine.html) that displays the values of properties.
    In addition to proving a real-life device example, it can be used for testing `uriVariables`. You can ask it to brew different coffees and monitor the available resource level.
-   Presence Sensor: It mocks the detection of a person by firing an event every 5 seconds.
-   Smart Clock: It simply has a property affordance for the time. However, it runs 60 times faster than real-time to allow time-based decisions that can be easily tested.
-   Simple Coffee Machine: This is a simpler simulation of the coffee machine above.

## Documentation

> [!WARNING]
> ⚒️ We are planning to extend this section and to provide a more detailed documentation. Stay tuned!

### The API

This library implements the WoT Scripting API:

-   [Editors Draft](w3c.github.io/wot-scripting-api/) in [master](https://github.com/eclipse-thingweb/node-wot)
-   [Working Draft](https://www.w3.org/TR/wot-scripting-api/) corresponding to node-wot [release versions](https://github.com/eclipse-thingweb/node-wot/releases)

Additionally, you can have a look at our [API Documentation](API.md).

To learn by examples, see `examples/scripts` to have a feeling of how to script a Thing or a Consumer.

### Adding a new codec

To add a new codec, you need to implement the `ContentCodec` interface. The interface is defined as follows:

```TypeScript
export interface ContentCodec {
    getMediaType(): string;
    bytesToValue(bytes: Buffer, schema: DataSchema, parameters?: {[key: string]: string}): any;
    valueToBytes(value: any, schema: DataSchema, parameters?: {[key: string]: string}): Buffer;
}
```

Finally you can add to your servient the new codec as follows:

```JavaScript
const { ContentSerdes, JsonCodec } = require("@node-wot/core");

// e.g., assign built-in codec for *new* contentType
const cs = ContentSerdes.get();
cs.addCodec(new JsonCodec("application/calendar+json"));

// e.g., assign *own* MyCodec implementation (implementing ContentCodec interface)
cs.addCodec(new MyCodec("application/myType"));

```

### TD Tooling

The package [td-tools](https://github.com/eclipse-thingweb/node-wot/tree/master/packages/td-tools) provides utilities around Thing Description (TD) tooling:

-   Thing Description (TD) parsing
-   Thing Model (TM) tooling
-   [Asset Interface Description (AID)](https://github.com/eclipse-thingweb/node-wot/tree/master/packages/td-tools/src/util) utility
-   ...

### Logging

Logging in node-wot is implemented via the [`debug`](https://www.npmjs.com/package/debug) package.
This allows users to enable log messages for specific logging levels (`info`, `debug`, `warn`, or `error`) or packages.
Which log messages are emitted is controlled by the `DEBUG` environment variable.

In the following, we will show a couple of examples of its usage using wildcard characters (`*`).
Note, however, that the syntax for setting an environment variable depends on your operating system and the terminal you use.
See the [`debug` documentation](https://www.npmjs.com/package/debug) for more details on platform-specific differences.

First, you can enable all log messages by setting `DEBUG` to a wildcard like so:

```sh
DEBUG=* npm start
```

To only show `node-wot`-specific logging messages, prefix the wildcard with `node-wot`:

```sh
DEBUG=node-wot* npm start
```

To only show a specific log level, use one of `info`, `debug`, `warn`, or `error` as the suffix.
Note in this context that you can provide multiple values for `DEBUG`.
For example, if you want to show only `debug` and `info` messages, you can use the following:

```sh
DEBUG='*debug,*info' npm start
```

Finally, you can choose to only display log messages from a specific `node-wot` package.
For example, if you only want to see log messages for the `core` package, use the following:

```sh
DEBUG=node-wot:core* npm start
```

Using the log levels above, you can also apply more fine-grained parameters for logging.
For instance, if you only want to see `error` messages from the `binding-coap` package, use this:

```sh
DEBUG=node-wot:binding-coap*error npm start
```

### Install new/different versions of Node.js

Using NPM, you can install Node.js independent from the usually outdated package managers such as apt. This is nicely done by `n`:

```
sudo npm cache clean -f
sudo npm install -g n
```

To get the "stable" version:

```
sudo n stable
```

To get the "latest" version:

```
sudo n latest
```

Finally, make the node command available through:

```
sudo ln -sf /usr/local/n/versions/node/<VERSION>/bin/node /usr/bin/node
```

## Contributing

Please check out our [contributing guidelines](CONTRIBUTING.md) for more details.

## Adopters

If you are using Eclipse Thingweb node-wot within your organization, please support us by adding your logo to the [Eclipse IoT adopters list](https://iot.eclipse.org/adopters/#iot.thingweb).
To do so, simply open an issue at [the Eclipse Gitlab](https://gitlab.eclipse.org/eclipsefdn/it/api/eclipsefdn-project-adopters/-/issues/new?issuable_template=adopter_request) by providing the name of your organization, its logo, and a link to your organization or team.
You should be affiliated with that organization for the issue to be implemented.

## License

Dual-licensed under:

-   [Eclipse Public License v. 2.0](http://www.eclipse.org/legal/epl-2.0)
-   [W3C Software Notice and Document License (2015-05-13)](https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document)

Pick one of these two licenses that fits your needs.
Please also see the additional [notices](NOTICE.md) and [how to contribute](CONTRIBUTING.md).

## Development Internals

<details>
<summary>details</summary>

### Publishing on NPM

Run `npm publish --workspaces` in root node-wot folder.

### Regenerating package-lock.json

1. Delete `package-lock.json` file
1. Delete _any_ local cache (like `node_modules` folders etc.)
1. Run `npm install`
1. Run `npm dedupe` (see https://github.com/eclipse-thingweb/node-wot/pull/765#issuecomment-1133772886)

</details>
