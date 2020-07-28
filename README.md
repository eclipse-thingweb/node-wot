# Eclipse Thingweb node-wot
W3C Web of Things implementation on NodeJS.

Visit http://www.thingweb.io for a practical [node-wot API usage](http://www.thingweb.io/smart-coffee-machine.html), [hands-on tutorials](http://www.thingweb.io/hands-on.html) or additional information.

Useful labels:
<a href="https://github.com/eclipse/thingweb.node-wot/issues?q=label%3Aquestion+">question</a> |
<a href="https://github.com/eclipse/thingweb.node-wot/issues?q=label%3A%22good+first+issue%22+">good first issue</a>

[![Build Status](https://travis-ci.org/eclipse/thingweb.node-wot.svg?branch=master)](https://travis-ci.org/eclipse/thingweb.node-wot)

### Table of Contents
- [License](#license)
- [Prerequisites](#prerequisites)
- [How to get the library](#how-to-get-the-library)
- [Start with an example](#no-time-for-explanations---show-me-a-running-example)
- [How to use the library](#how-to-use-the-library)

## License
Dual-licensed under both

* [Eclipse Public License v. 2.0](http://www.eclipse.org/legal/epl-2.0)
* [W3C Software Notice and Document License (2015-05-13)](https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document)

Pick one of these two licenses that fits your needs.
Please also see the additional [notices](NOTICE.md) and [how to contribute](CONTRIBUTING.md).

## Prerequisites
### To use with Node.js
All systems require:
* [NodeJS](https://nodejs.org/) version 10+ (e.g., 10.13.0 LTS)

#### Linux
Meet the [node-gyp](https://github.com/nodejs/node-gyp#installation) requirements:
* Python 2.7 (v3.x.x is not supported)
* make
* A proper C/C++ compiler toolchain, like GCC

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

* Microsoft Edge 15 and later
* Firefox 54 and later
* Chrome 58 and later
* Safari 10 and later

Using a browser with only ES5 support (eg. IE 11) might be possible if you add polyfills.

## How to get the library
### As a Node.js dependency

You can install node-wot in the following ways:

1. As a normal dependency (i.e., like loadsh). In this case, you are embedding a servient inside your application.
2. As a CLI to run scripts. In this case, your application is running inside
the default servient.

#### Normal Dependency

If you want to use node-wot as a library in your Node.js application, you can use npm to install the node-wot packages that you need. To do so, `cd` inside you application folder, and run:

```
npm i @node-wot/core @node-wot/binding-coap --save
```

Now, you can implement your node-wot entry point, e.g., `main.js` as follows:

```JavaScript
// Required steps to create a servient
const Servient = require('@node-wot/core').Servient
const HttpServer = require('@node-wot/binding-http').HttpServer

const servient = new Servient()
const servient.addServer(new HttpServer(servientConfig.http))
const WoT = await this.servient.start()

//Then from here on use WoT object to consume/produce Things
//i.e. WoT.produce({.....})
```

You can then start the application by running `node main.js`.

#### CLI Tool
You can alternatively install the node-wot CLI, either globally (`npm i @node-wot/cli -g`) or as
a (dev) dependency (`npm i @node-wot/cli --save` or `npm i @node-wot/cli --save-dev`).

Then, you don't need to specify any further node-wot dependencies and can implement your application
(e.g., `main.js`) without explicitly requiring node-wot dependencies:

```JavaScript
//No need to require node-wot componets
// WoT runtime is provided as global object

WoT.produce({/*.....*/})
```

If the CLI is globally installed, you don't need to set up a Node.js project.
If you do so, anyway, you can specify the entry point as follows:

```JavaScript
"scripts":{
   "start": "wot-servient main.js"
}
```

There are several ways to start the application:  
   a. Execute `npm start`.  
   b. Execute  `./node_modules/.bin/wot-servient main.js`.  
   c. Execute `node ./node_modules/@node-wot/cli/dist/cli.js main.js`.  
   d. If you have installed `@node-wot/cli` globally you can even start the application right
   away using this command `wot-servient main.js`. However, in the current implementation, the
   import of local dependencies is not supported in this case.


wot-servient can execute multiple files at once, for example as follows:
```
wot-servient script1.js ./src/script2.js
```

Finally, to debug use the option `--inspect` or `--inspect-brk` if you want to hang until your debug client is connected. Then start [Chrome Dev Tools](chrome://inspect) or [vscode debugger](https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_attaching-to-nodejs) or your preferred v8 inspector to debug your code.

For further details check: `wot-servient --help`

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
Install root dependencies (locally installs tools such as [typescript](https://www.npmjs.com/package/typescript) and [lerna](https://www.npmjs.com/package/lerna)):
```
npm install 
```
Use `tsc` to transcompile TS code to JS in dist directory for each package:
*Note: This step automatically calls `npm run bootstrap`.*
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
- yarn init
- yarn add [packages]
- npm run build
- lerna init
- lerna exec 'npm prune --production'

#### Trouble shooting

* Build error around `node-aead-crypto`
   * node-gyp has been seen failing on MacOS
   * try node 10+, which does not require the crypto polyfill
* Build error about `No matching version found for @node-wot/...` or something about `match`
   * try `npm run unlock` from project root before building
* `sudo npm run link` does not work
   * try `npm run unlock` from project root before calling `[sudo] npm run link`
   * try `npm link` in each package directory in this order: td-tools, core, binding-\*, cli, demo-servients
* Build error around `prebuild: npm run bootstrap`
   * This has been seen failing on WSL.  Try using Node 12.13.0

### As a browser library

Node-wot can also be imported as browser-side library. To do so, include the following `script` tag in your html:
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
node packages\cli\dist\cli.js --clientonly examples\scripts\counter-client.js
```

* Go to http://localhost:8080/counter and you'll find a thing description
* Query the count by http://localhost:8080/counter/properties/count
* Modify the count via POST on http://localhost:8080/counter/actions/increment and http://localhost:8080/counter/actions/decrement
* Application logic is in `examples/scripts/counter.js`

### Using a browser
An example of how to use node-wot as a browser-side library can be found under `examples/browser/index.html`.
To run it, open [`examples/browser/index.html`](http://plugfest.thingweb.io/webui/) in a modern browser, and consume the test Thing available under `http://plugfest.thingweb.io:8083/TestThing` to interact with it.

The JavaScript code that uses node-wot as a library to power this application can be found under: `examples/browser/index.js`

## How to use the library
### The API

This library implements the WoT Scripting API:

* [Editors Draft](w3c.github.io/wot-scripting-api/) in [master](https://github.com/eclipse/thingweb.node-wot)
* [Working Draft](https://www.w3.org/TR/wot-scripting-api/) corresponding to node-wot release versions ([v0.3.0](https://github.com/thingweb/node-wot/releases/tag/v0.3.0) for FPWD, [v0.4.0](https://github.com/thingweb/node-wot/releases/tag/v0.4.0) for WD-2018-04-05, [v0.5.0](https://github.com/eclipse/thingweb.node-wot/releases/tag/v0.5.0) for WD-2018-10-??)

You can also see `examples/scripts` to have a feeling of how to script a Thing.

### Implemented/supported features

<!--
* [`WoT`](https://www.w3.org/TR/2017/WD-wot-scripting-api-20170914/#the-wot-object) object
  * `discover` :heavy_multiplication_x:
  * `consume` :heavy_check_mark:
  * `expose` :heavy_check_mark:
  
* [`ConsumedThing`](https://www.w3.org/TR/2017/WD-wot-scripting-api-20170914/#the-consumedthing-interface) interface
  * `invokeAction` :heavy_check_mark:
  * `setProperty` :heavy_check_mark:
  * `getProperty` :heavy_check_mark:
  
  * `addListener` :heavy_multiplication_x:
  * `removeListener` :heavy_multiplication_x:
  * `removeAllListeners` :heavy_multiplication_x:
  * `observe` :heavy_multiplication_x:

* [`ExposedThing`](https://www.w3.org/TR/2017/WD-wot-scripting-api-20170914/#the-exposedthing-interface) interface
  * `addProperty` :heavy_check_mark:
  * `removeProperty` :heavy_check_mark:
  * `addAction` :heavy_check_mark:
  * `removeAction` :heavy_check_mark:
  * `addEvent` :heavy_check_mark:
  * `removeEvent` :heavy_check_mark:
  
  * `onRetrieveProperty` :heavy_check_mark:
  * `onUpdateProperty` :heavy_check_mark:
  * `onInvokeAction` :heavy_check_mark:
  * `onObserve` :heavy_multiplication_x:
  
  * `register` :heavy_multiplication_x:
  * `unregister` :heavy_multiplication_x:
  * `start` :heavy_multiplication_x:
  * `stop` :heavy_multiplication_x:
  * `emitEvent` :heavy_multiplication_x:
-->

#### Protocol Support

* [HTTP](https://github.com/eclipse/thingweb.node-wot/blob/master/packages/binding-http/README.md) :heavy_check_mark:
* [HTTPS](https://github.com/eclipse/thingweb.node-wot/blob/master/packages/binding-http/README.md) :heavy_check_mark:
* [CoAP](https://github.com/eclipse/thingweb.node-wot/blob/master/packages/binding-coap/README.md) :heavy_check_mark:
* [CoAPS](https://github.com/eclipse/thingweb.node-wot/blob/master/packages/binding-coap/README.md) :heavy_check_mark:
* Websocket :heavy_check_mark:
* [MQTT](https://github.com/eclipse/thingweb.node-wot/blob/master/packages/binding-mqtt/README.md) :heavy_check_mark:
* [OPC-UA](https://github.com/eclipse/thingweb.node-wot/blob/master/packages/binding-opcua/README.md) :heavy_plus_sign: (Client only)
* [NETCONF](https://github.com/eclipse/thingweb.node-wot/blob/master/packages/binding-netconf/README.md) :heavy_plus_sign: (Client only)
* [Modbus](https://github.com/eclipse/thingweb.node-wot/tree/master/packages/binding-modbus) :heavy_plus_sign: (Client only)

Note: More protocols can be easily added by implementing `ProtocolClient`, `ProtocolClientFactory`, and `ProtocolServer` interface.

#### MediaType Support

* JSON :heavy_check_mark:
* Text (HTML, CSS, XML, SVG) :heavy_check_mark:
* Base64 (PNG, JPEG, GIF) :heavy_check_mark:
* Octet stream :heavy_check_mark:
* CBOR :heavy_multiplication_x:
* EXI :heavy_multiplication_x:

Note: More mediaTyes can be easily added by implementing `ContentCodec` interface.

### Logging

We used to have a node-wot-logger package to allow fine-grained logging (by means of Winston). It turned out though that depending on the actual use-case other logging libraries might be better suited. Hence we do not want to prescribe which logging library to use. Having said that, we use console statements which can be easily overriden to use the prefered logging library if needed (see [here](https://gist.github.com/spmason/1670196)).

The logs in the library follows those best practice rules (see [here](https://github.com/eclipse/thingweb.node-wot/issues/229)):
1. Tag log messages with the package as following: `console.debug("[package-name]", "log message)`. This is useful to identify which package generated the log.
2. Avoid to use `info` and `log` in packages other than the cli package.

Please follows these rules if you are going to contribute to node-wot library.

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
