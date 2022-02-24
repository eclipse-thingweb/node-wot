# Browser Bundle of node-wot

Bundle to run node-wot as browser-side library. Note, this will only include the node-wot in client mode with limited binding support.

## Supported bindings

HTTP / HTTPS / WebSockets

## Embedding node-wot library in HTML

Include the following script tag in your html

```js
<script src="https://cdn.jsdelivr.net/npm/@node-wot/browser-bundle@latest/dist/wot-bundle.min.js"></script>
```

You can access all node-wot functionality through the "Wot" global object:

```js
var servient = new Wot.Core.Servient();
var client = new Wot.Http.HttpClient();
```

## Using node-wot browser bundle library in web frameworks (e.g., Angular)

Install browser-bundle in your project by running

-   `npm install @node-wot/browser-bundle`

## Example and live demo

An example of how to use node-wot as a browser-side library can be found under `https://github.com/eclipse/thingweb.node-wot/blob/master/examples/browser/index.html`.
To run it live, open [`examples/browser/index.html`](http://plugfest.thingweb.io/webui/) in a modern browser,
and consume the test Thing available under `http://plugfest.thingweb.io:8083/testthing` to interact with it.

## More Details

See <https://github.com/eclipse/thingweb.node-wot/>
