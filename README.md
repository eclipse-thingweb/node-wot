# Eclipse Thingweb node-wot
W3C Web of Things implementation on NodeJS

[![Build Status](https://travis-ci.org/eclipse/thingweb.node-wot.svg?branch=master)](https://travis-ci.org/eclipse/thingweb.node-wot)

## License
Dual-licensed under both

* [Eclipse Public License v. 2.0](http://www.eclipse.org/legal/epl-2.0)
* [W3C Software Notice and Document License (2015-05-13)](https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document)

Pick one of these two licenses that fits your needs.
Please also see the additional [notices](NOTICE.md) and [how to contribute](CONTRIBUTING.md).

## Prerequisites
All systems require:
* [NodeJS](https://nodejs.org/) version 8+ (e.g., 8.11.3 LTS)
* NodeJS version 10+ will not require certain polyfills, but is not LTS (long-term stable)

### Linux
Meet the [node-gyp](https://github.com/nodejs/node-gyp#installation) requirements:
* Python 2.7 (v3.x.x is not supported)
* make
* A proper C/C++ compiler toolchain, like GCC

### Windows
Install the Windows build tools through a CMD shell as administrator:
```
npm install -g --production windows-build-tools
```

### Mac OS
Meet the [node-gyp](https://github.com/nodejs/node-gyp#installation) requirements:
```
xcode-select --install
```

## How to get ready for coding
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

### Optional

#### Link Packages
Make all packages available on your local machine (as symlinks). You can then use each paket in its local version via `npm link <module>` instead of `npm install <module>` (see also https://docs.npmjs.com/cli/link).
```
sudo npm run link
```
(On Windows omit `sudo`)

#### Link Local wot-typescript-definitions
To evolve the Scripting API in development, you need to use a locally changed version of the [wot-typescript-definitions](https://www.npmjs.com/package/wot-typescript-definitions).
Use npm link for this as well:
```
git clone https://github.com/thingweb/wot-typescript-definitions.git
cd wot-typescript-definitions
sudo npm link
```
(On Windows omit `sudo`)

In each node-wot package, link the local version made available in the previous step:
```
sudo npm link wot-typescript-definitions
```
(On Windows omit `sudo`)

## Trouble shooting

* Build error around `node-aead-crypto`
   * node-gyp has been seen failing on MacOS
   * try node 10+, which does not require the crypto polyfill
* `sudo npm run link` does not work
   * try `npm run unlock` before calling `[sudo] npm run link`
   * try `npm link` in each package directory in this order: td-tools, core, binding-\*, cli, demo-servients

## No time for explanations - I want to start from something running!
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
node packages\cli\dist\cli.js examples\scripts\counter-client.js
```

* Go to http://localhost:8080/counter and you'll find a thing description
* Query the count by http://localhost:8080/counter/properties/count
* Modify the count via POST on http://localhost:8080/counter/actions/increment and http://localhost:8080/counter/actions/decrement
* Application logic is in `examples/scripts/counter.js`

## How to use the library

This library implements the WoT Scripting API:

* [Editors Draft](w3c.github.io/wot-scripting-api/) in [master](https://github.com/eclipse/thingweb.node-wot)
* [Working Draft](https://www.w3.org/TR/wot-scripting-api/) corresponding to node-wot release versions ([v0.3.0](https://github.com/thingweb/node-wot/releases/tag/v0.3.0) for FPWD, [v0.4.0](https://github.com/thingweb/node-wot/releases/tag/v0.4.0) for WD-2018-04-05, [v0.5.0](https://github.com/eclipse/thingweb.node-wot/releases/tag/v0.5.0) for WD-2018-10-??)

You can also see `examples/scripts` to have a feeling of how to script a Thing.

<!--
### Implemented/supported

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
* Websocket :heavy_plus_sign: (server only)
* MQTT :heavy_plus_sign: (in dev branch)

Note: More protocols can be easily added by implementing `ProtocolClient`, `ProtocolClientFactory`, and `ProtocolServer` interface.

#### MediaType Support

* JSON :heavy_check_mark:
* Plain text :heavy_check_mark:
* CBOR :heavy_multiplication_x:

Note: More mediaTyes can be easily added by implementing `ContentCodec` interface.

## Logging

We used to have a node-wot-logger package to allow fine-grained logging (by means of Winston). It turned out though that depending on the actual use-case other logging libraries might be better suited. Hence we do not want to prescribe which logging library to use. Having said that, we use console statements which can be easily overriden to use the prefered logging library if needed (see [here](https://gist.github.com/spmason/1670196)).
