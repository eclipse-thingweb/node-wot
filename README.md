# Eclipse Thingweb node-wot

W3C Web of Things implementation on NodeJS

## License

Dual-licensed under both

* [Eclipse Public License v. 2.0](http://www.eclipse.org/legal/epl-2.0)
* [W3C Software Notice and Document License (2015-05-13)](https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document)

Pick one of these two licenses that fits your needs.
Please also see the additional [notices](NOTICE.md) and [how to contribute](CONTRIBUTING.md).

## Prerequisites

On Linux, install lerna
```
npm install -g lerna
```

On Windows, install the build tools and lerna (CMD shell as administrator)
```
npm install --global --production windows-build-tools -g lerna 
```

## How to get ready for coding

```
# Clone the repository
git clone https://github.com/eclipse/thingweb.node-wot

# Go into the repository
cd node-wot

# install root dependencies (locally installs tools like typescript and lerna)
npm install 

# bootstrap the packages (installs dependencies and links the inter-dependencies)
# Note: This step is automatically done on building or testing
npm run bootstrap

# use tsc to transcompile TS code to JS in dist directory for each package
npm run build

# run test suites of all packets
npm run test 

# (OPTIONAL!) 
# make all packages available on your local machine (as symlinks)
# you can then use each paket in its local version via "npm link" instead of "npm install"
# see also https://docs.npmjs.com/cli/link
sudo npm run link

```

## No time for explanations - I want to start from something running!
Run all the steps above and then run this:

```
cd examples/scripts
wot-servient


# e.g., Windows CMD shell (Counter Example)
# expose
# node packages\cli\dist\cli.js  examples\scripts\counter.js
# consume
# node packages\cli\dist\cli.js  examples\scripts\counterClient.js
```

* go to http://localhost:8080/counter and you'll find a thing description.
* you can query the count by http://localhost:8080/counter/properties/count
* you can modify the count via POST on http://localhost:8080/counter/actions/increment and http://localhost:8080/counter/actions/decrement
* application logic is in ``examples/scripts/counter.js``

## How to use the library

This library implements the WoT Scripting API

* [First Public Working Draft](https://www.w3.org/TR/2017/WD-wot-scripting-api-20170914/) in [release v0.3.0](https://github.com/thingweb/node-wot/releases/tag/v0.3.0)
  * Note: There are known differences between node-wot and FPWD (see [Issue72](https://github.com/w3c/wot-scripting-api/issues/72)).
* [Editors Draft](w3c.github.io/wot-scripting-api/) in [master](https://github.com/thingweb/node-wot)

You can also see _examples/scripts_ to have a feeling of how to script a Thing.

<!---
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
* HTTPS :question: ?fix needed?
* CoAP :heavy_check_mark:
* CoAPS :heavy_multiplication_x:
* Websocket :heavy_multiplication_x:

Note: More protocols can be easily added by implementing `ProtocolClient`, `ProtocolClientFactory` and `ProtocolServer` interface.

#### MediaType Support

* JSON  :heavy_check_mark:
* plainText :heavy_check_mark:

Note: More mediaTyes can be easily added by implementing `ContentCodec` interface.

## Logging

We used to have a node-wot-logger package to allow fine-grained logging (by means of Winston). It turned out though that depending on the actual use-case other logging libraries might be better suited. Hence we do not want to prescribe which logging library to use. Having said that, we use console statements which can be easily overriden to use the prefered logging library if needed (see [here](https://gist.github.com/spmason/1670196)).
