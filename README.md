# Eclipse Thingweb node-wot
W3C Web of Things implementation on NodeJS.

Visit http://www.thingweb.io for a [hands-on tutorial](http://www.thingweb.io/hands-on.html) or additional information.

Useful labels: <span style="background-color:purple"><a href="https://github.com/eclipse/thingweb.node-wot/issues?q=+label%3Aquestion+">question</a></span>

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

If you want to use node-wot as a library in your Node.js application, you can use npm to install the node-wot packages that you need. To do so, `cd` inside you application folder, and run:
```
npm install @node-wot/core
npm install @node-wot/binding-coap
```
Alternatively you can add `@node-wot/<package-name>`as a dependency to your `package.json`.

#### As a dev dependency (debugging)

If you want to develop applications for node-wot, you can use the command-line interface to run and debug your local scripts. First, install the CLI module as a dev-dependency:

```
npm install @node-wot/cli --save-dev
```
Then to start `.js` files in the current directory use the following command `wot-servient` (or `node packages\cli\dist\cli.js`):

For example, if you want to run a specific file or a list of files just append the file paths:
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
Make all packages available on your local machine (as symlinks). You can then use each paket in its local version via `npm link <module>` instead of `npm install <module>` (see also https://docs.npmjs.com/cli/link).
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

* HTTP :heavy_check_mark:
* HTTPS :heavy_check_mark:
* CoAP :heavy_check_mark:
* CoAPS :heavy_check_mark:
* Websocket :heavy_check_mark:
* MQTT :heavy_check_mark:

Note: More protocols can be easily added by implementing `ProtocolClient`, `ProtocolClientFactory`, and `ProtocolServer` interface.

#### MediaType Support

* JSON :heavy_check_mark:
* Plain text :heavy_check_mark:
* CBOR :heavy_multiplication_x:
* EXI :heavy_multiplication_x:

Note: More mediaTyes can be easily added by implementing `ContentCodec` interface.

### Logging

We used to have a node-wot-logger package to allow fine-grained logging (by means of Winston). It turned out though that depending on the actual use-case other logging libraries might be better suited. Hence we do not want to prescribe which logging library to use. Having said that, we use console statements which can be easily overriden to use the prefered logging library if needed (see [here](https://gist.github.com/spmason/1670196)).

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
