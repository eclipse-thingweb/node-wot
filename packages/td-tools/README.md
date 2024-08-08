> [!WARNING] > `@node-wot/td-tools` package will be removed in the future. Please use `@node-wot/core` / `@thingweb/thing-model` / `@thingweb/td-utils` package instead.

# TD (Thing Description) tools of node-wot

Current Maintainer(s): [@danielpeintner](https://github.com/danielpeintner) [@relu91](https://github.com/relu91)

## Getting Started

In the following example it is shown how td-tools of node-wot can be used.

Note: Some additional tooling (e.g., AAS AID, TD to AsyncAPI Converter) can be found in its own repository (see https://github.com/eclipse-thingweb/td-tools).

### Prerequisites

-   `npm install @node-wot/td-tools`

### Example

The example parses a TD and also serializes yet another newly created TD.

`node example.js`

```
// example.js
const TDTools = require("@node-wot/td-tools");
const { Thing } = require("@node-wot/td-tools");

// parse TD
const tdString = JSON.stringify({
    id : "123",
    title: "MyThing"
});
const dd = TDTools.parseTD(tdString);
console.log("**** PARSED TD ****");
console.log(dd);
console.log("****");


// init Thing and serialize to TD
const thing = new Thing();
thing.id = "789";
thing["@type"] = "Thing";
thing.support = "foo@example.com"
thing.properties = {
    "myProp" : {
        type: "integer"
    }
}
const tdString2 = TDTools.serializeTD(thing);
console.log("**** SERIALIZED TD ****");
console.log(tdString2);
console.log("****");
```

## More Details

See <https://github.com/eclipse-thingweb/node-wot/>
