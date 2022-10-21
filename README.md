[![Default CI Pipeline](https://github.com/eclipse/thingweb.node-wot/actions/workflows/ci.yaml/badge.svg)](https://github.com/eclipse/thingweb.node-wot/actions/workflows/ci.yaml)
[<img alt="npm" src="https://img.shields.io/npm/dw/@node-wot/td-tools">](https://npm-stat.com/charts.html?package=%40node-wot%2Ftd-tools)
[![codecov](https://codecov.io/gh/eclipse/thingweb.node-wot/branch/master/graph/badge.svg)](https://codecov.io/gh/eclipse/thingweb.node-wot)
[![Telegram Group](https://img.shields.io/endpoint?color=neon&url=https%3A%2F%2Ftg.sumanjay.workers.dev%2Fnodewot)](https://t.me/nodewot)

# Eclipse Thingweb node-wot

W3C Web of Things implementation on NodeJS.

Visit http://www.thingweb.io for a practical [node-wot API usage](http://www.thingweb.io/smart-coffee-machine.html), [hands-on tutorials](http://www.thingweb.io/hands-on.html) or additional information.

Useful labels:
<a href="https://github.com/eclipse/thingweb.node-wot/issues?q=label%3Aquestion+">question</a> |
<a href="https://github.com/eclipse/thingweb.node-wot/issues?q=label%3A%22good+first+issue%22+">good first issue</a>

### Table of Contents

<!-- https://ecotrust-canada.github.io/markdown-toc/ -->

-   [License](#license)
-   [Implemented/supported features](#implementedsupported-features)
    -   [Protocol Support](#protocol-support)
    -   [MediaType Support](#mediatype-support)
-   [Prerequisites](#prerequisites)
    -   [To use with Node.js](#to-use-with-nodejs)
    -   [To use in a browser](#to-use-in-a-browser)
-   [How to get the library](#how-to-get-the-library)
    -   [As a Node.js dependency](#as-a-nodejs-dependency)
    -   [As a standalone application](#as-a-standalone-application)
    -   [As a Docker image](#as-a-docker-image)
    -   [As a browser library](#as-a-browser-library)
-   [No time for explanations - show me a running example!](#no-time-for-explanations---show-me-a-running-example)
    -   [Using Node.js](#using-nodejs)
    -   [Using Docker](#using-docker)
    -   [Using a browser](#using-a-browser)
-   [How to use the library](#how-to-use-the-library)
    -   [The API](#the-api)
    -   [Logging](#logging)
    -   [Install new/different versions of NodeJS](#install-newdifferent-versions-of-nodejs)

## License

Dual-licensed under both

-   [Eclipse Public License v. 2.0](http://www.eclipse.org/legal/epl-2.0)
-   [W3C Software Notice and Document License (2015-05-13)](https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document)

Pick one of these two licenses that fits your needs.
Please also see the additional [notices](NOTICE.md) and [how to contribute](CONTRIBUTING.md).

## Implemented/supported features

### Protocol Support

-   [HTTP](https://github.com/eclipse/thingweb.node-wot/blob/master/packages/binding-http/README.md) :heavy_check_mark:
-   [HTTPS](https://github.com/eclipse/thingweb.node-wot/blob/master/packages/binding-http/README.md) :heavy_check_mark:
-   [CoAP](https://github.com/eclipse/thingweb.node-wot/blob/master/packages/binding-coap/README.md) :heavy_check_mark:
-   [CoAPS](https://github.com/eclipse/thingweb.node-wot/blob/master/packages/binding-coap/README.md) :heavy_check_mark:
-   [MQTT](https://github.com/eclipse/thingweb.node-wot/blob/master/packages/binding-mqtt/README.md) :heavy_check_mark:
-   [Firestore](https://github.com/eclipse/thingweb.node-wot/tree/master/packages/binding-firestore/README.md) :heavy_check_mark:
-   [Websocket](https://github.com/eclipse/thingweb.node-wot/tree/master/packages/binding-websockets) :heavy_plus_sign: (Server only)
-   [OPC-UA](https://github.com/eclipse/thingweb.node-wot/blob/master/packages/binding-opcua/README.md) :heavy_plus_sign: (Client only)
-   [NETCONF](https://github.com/eclipse/thingweb.node-wot/blob/master/packages/binding-netconf/README.md) :heavy_plus_sign: (Client only)
-   [Modbus](https://github.com/eclipse/thingweb.node-wot/tree/master/packages/binding-modbus) :heavy_plus_sign: (Client only)
-   [M-Bus](https://github.com/eclipse/thingweb.node-wot/tree/master/packages/binding-mbus) :heavy_plus_sign: (Client only)

Note: More protocols can be easily added by implementing `ProtocolClient`, `ProtocolClientFactory`, and `ProtocolServer` interface.

Note: the bindings for [binding-fujitsu](https://github.com/eclipse/thingweb.node-wot/tree/v0.7.x/packages/binding-fujitsu) and [binding-oracle](https://github.com/eclipse/thingweb.node-wot/tree/v0.7.x/packages/binding-oracle) were removed after `v0.7.x` due to lack of maintainers.

### MediaType Support

-   JSON :heavy_check_mark:
-   Text (HTML, CSS, XML, SVG) :heavy_check_mark:
-   Base64 (PNG, JPEG, GIF) :heavy_check_mark:
-   Octet stream :heavy_check_mark:
-   CBOR :timer_clock:
-   EXI :timer_clock:

Note: More mediaTypes can be easily added by implementing `ContentCodec` interface.

```JavaScript
const ContentSerdes = require('@node-wot/core').ContentSerdes
const JsonCodec = require('@node-wot/core').JsonCodec

// e.g., assign built-in codec for *new* contentType
let cs = ContentSerdes.get();
cs.addCodec(new JsonCodec("application/calendar+json"));

// e.g., assign *own* MyCodec implementation (implementing ContentCodec interface)
cs.addCodec(new MyCodec("application/myType"));

```

## Prerequisites

### To use with Node.js

All systems require:

-   [NodeJS](https://nodejs.org/) version 12+
-   [npm](https://www.npmjs.com/) version 7+

#### Linux

Meet the [node-gyp](https://github.com/nodejs/node-gyp#installation) requirements:

-   Python v3.6, v3.7, or v3.8
-   make
-   A proper C/C++ compiler toolchain, like GCC

#### Windows

Install the Windows build tools through a CMD shell as administrator:

```
npm install -g --production windows-build-tools
```

> WSL: Windows Services for Linux should follow Linux instructions.

#### Mac OS

Meet the [node-gyp](https://github.com/nodejs/node-gyp#installation) requirements:

```
xcode-select --install
```

### To use in a browser

To use node-wot as a browser-side JavaScript Library, the browser needs to support ECMAScript 2015.
Supported browsers include:

-   Microsoft Edge 15 and later
-   Firefox 54 and later
-   Chrome 58 and later
-   Safari 10 and later

Using a browser with only ES5 support (eg. IE 11) might be possible if you add polyfills.

## How to get the library

## As a Node.js dependency

You can install node-wot in the following ways:

1. As a normal dependency (i.e., like loadsh). In this case, you are embedding a servient inside your application.
2. As a CLI to run scripts. In this case, your application is running inside
   the default servient.

#### Normal Dependency

If you want to use node-wot as a library in your Node.js application, you can use npm to install the node-wot packages that you need. To do so, `cd` inside you application folder, and run:

```
npm i @node-wot/core @node-wot/binding-http --save
```

Now, you can implement a thing as follows:

```JavaScript
// server.js
// Required steps to create a servient for creating a thing
const Servient = require('@node-wot/core').Servient;
const HttpServer = require('@node-wot/binding-http').HttpServer;

const servient = new Servient();
servient.addServer(new HttpServer());

servient.start().then((WoT) => {
    // Then from here on you can use the WoT object to produce the thing
    // i.e WoT.produce({.....})
});
```

A client consuming a thing can be implemented like this:

```JavaScript
// client.js
// Required steps to create a servient for a client
const { Servient, Helpers } = require("@node-wot/core");
const { HttpClientFactory } = require('@node-wot/binding-http');

const servient = new Servient();
servient.addClientFactory(new HttpClientFactory(null));
const WoTHelpers = new Helpers(servient);

WoTHelpers.fetch("http://localhost:8080/example").then(async (td) => {
    try {
        servient.start().then(async (WoT) => {
            // Then from here on you can consume the thing
            // i.e let thing = await WoT.consume(td) ...
        });
    }
    catch (err) {
        console.error("Script error:", err);
    }
}).catch((err) => { console.error("Fetch error:", err); });
```

You can then start the applications with node by running `node server.js` and `node client.js`.

#### CLI Tool

You can alternatively use node-wot via its command line interface (CLI). Please visit the [CLI tool's Readme](<[url](https://github.com/eclipse/thingweb.node-wot/tree/master/packages/cli)>) to find out more.

### As a standalone application

#### Clone and build

Clone the repository:

```
git clone https://github.com/eclipse/thingweb.node-wot
```

Go into the repository:

```
cd thingweb.node-wot
```

Install root dependencies (locally installs tools such as [typescript](https://www.npmjs.com/package/typescript)):

```
npm ci
```

Use `tsc` to transcompile TS code to JS in dist directory for each package:
_Note: This step automatically calls `npm run bootstrap`._

```
npm run build
```

#### Optional steps

###### Link Packages

Make all packages available on your local machine (as symlinks). You can then use each package in its local version via `npm link <module>` instead of `npm install <module>` (see also https://docs.npmjs.com/cli/link).

```
sudo npm run link
```

(On Windows omit `sudo`)

##### Link Local wot-typescript-definitions

To evolve the Scripting API in development, you need to use a locally changed version of the [wot-typescript-definitions](https://www.npmjs.com/package/wot-typescript-definitions).
Use npm link for this as well:

```
git clone https://github.com/w3c/wot-scripting-api/
cd wot-scripting-api/typescript/
sudo npm link
```

(On Windows omit `sudo`)

In each node-wot package, link the local version made available in the previous step:

```
sudo npm link wot-typescript-definitions
```

(On Windows omit `sudo`)

##### Optimization

To reduce the size of the installation from about 800 MByte down to about 200 MByte, you can run the following commands (currently only tested on Linux):
`npm prune --production`

#### Trouble shooting

-   Build error around `node-aead-crypto`
    -   node-gyp has been seen failing on MacOS
    -   try node 10+, which does not require the crypto polyfill
-   Build error about `No matching version found for @node-wot/...` or something about `match`
    -   try `npm run unlock` from project root before building
-   `sudo npm run link` does not work
    -   try `npm run unlock` from project root before calling `[sudo] npm run link`
    -   try `npm link` in each package directory in this order: td-tools, core, binding-\*, cli, demo-servients
-   Error mesage for `npm link @node-wot/<module>`
    `ELOOP: too many symbolic links encountered, stat '/usr/lib/node_modules/@node-wot/<module>`
    1. Run `npm run link` in `thingweb.node-wot` again
    2. Remove `node_modules` in the targeted project
    3. Remove all `@node-wot/<module>` dependencies in your `package.json`
    4. Run `npm i` again
    5. Install the packages with `npm link @node-wot/<module>`
-   Build error around `prebuild: npm run bootstrap`
    -   This has been seen failing on WSL. Try using Node 12.13.0

### As a Docker image

Alternatively, node-wot can be built as a Docker image with the `Dockerfile`.

Make sure you are under linux or under WSL if you are running on Windows.

Clone the repository:

```
git clone https://github.com/eclipse/thingweb.node-wot
```

Go into the repository:

```
cd thingweb.node-wot
```

Build the Docker image named `wot-servient` from the `Dockerfile`:

```
npm run build:docker
```

Run the wot-servient as a container:

```
docker run --rm wot-servient -h
```

### As a browser library

node-wot can also be imported as browser-side library. To do so, include the following `script` tag in your html:

```html
<script src="https://cdn.jsdelivr.net/npm/@node-wot/browser-bundle@latest/dist/wot-bundle.min.js"></script>
```

In the browser, node wot only works in client mode with limited binding support. Supported bindings: HTTP / HTTPS / WebSockets
You can access all node-wot functionality through the "Wot" global object:

```javascript
var servient = new Wot.Core.Servient();
var client = new Wot.Http.HttpClient();
```

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

## How to use the library

### The API

This library implements the WoT Scripting API:

-   [Editors Draft](w3c.github.io/wot-scripting-api/) in [master](https://github.com/eclipse/thingweb.node-wot)
-   [Working Draft](https://www.w3.org/TR/wot-scripting-api/) corresponding to node-wot [release versions](https://github.com/eclipse/thingweb.node-wot/releases)

Additionally, you can have a look at our [API Documentation](API.md).

To learn by examples, see `examples/scripts` to have a feeling of how to script a Thing or a Consumer.

### Logging

Logging in node-wot is implemented via the [`debug`](https://www.npmjs.com/package/debug) package.
This allows users to enable log messages for specific logging levels (`info`, `debug`, `warn`, or `error`) or packages.
Which log messages are emitted is controlled by the `DEBUG` environment variable.

#### Examples

In the following, we will show a couple of examples for its usage using wildcard characters (`*`).
Note, however, that the syntax for setting an environment variable depends on your operating system and the terminal you use.
See the `debug` documentation linked above for more details on platform-specific differences.

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
DEBUG=node-wot:binding-coap*debug npm start
```

#### Adding logging functionality to a package

If you are contributing a new binding, please use the `createLoggers` function from the `core` package for adding logging functionality to your package.
The function accepts an arbitrary number of arguments that will be mapped to `debug` namespaces.
In the example below, the `createLoggers` function will map its arguments `binding-foo` and `foo-server` to the namespace `node-wot:binding-foo:foo-server`.
The resulting functions `debug`, `info`, `warn`, and `error` will append their log-level to this namespace when creating the actual log message.
This enables filtering as described in the section before.

```ts
import { createLoggers } from "@node-wot/core";
const { debug, info, warn, error } = createLoggers("binding-foo", "foo-server");

function startFoo() {
    info("This is an info message!");
    debug("This is a debug message!");
    warn("This is a warn message!");
    error("This is an error message!");
}
```

### Install new/different versions of NodeJS

Using NPM, you can install NodeJS independent from the usually outdated package managers such as apt. This is nicely done by n:

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

## Development Internals

<details>
<summary>details</summary>

### Publishing on NPM

Run `npm publish --workspaces` in root node-wot folder.

### Regenerating package-lock.json

1. Delete `package-lock.json` file
1. Delete _any_ local cache (like `node_modules` folders etc.)
1. Run `npm install`
1. Run `npm dedupe` (see https://github.com/eclipse/thingweb.node-wot/pull/765#issuecomment-1133772886)

</details>
