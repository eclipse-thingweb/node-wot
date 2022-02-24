# TD (Thing Description) tools of node-wot

## Getting Started

In the following example it is shown how td-tools of node-wot can be used.

### Prerequisites

-   `npm install @node-wot/td-tools`

### Example

The example parses a TD and also serializes yet another newly created TD.

`node example.js`

```
// example.js
TDTools = require("@node-wot/td-tools");
Thing = require("@node-wot/td-tools").Thing;


// parse TD
let tdString = JSON.stringify({
    id : "123",
    title: "MyThing"
});
let dd = TDTools.parseTD(tdString);
console.log("**** PARSED TD ****");
console.log(dd);
console.log("****");


// init Thing and serialize to TD
let thing = new Thing();
thing.id = "789";
thing["@type"] = "Thing";
thing.support = "foo@example.com"
thing.properties = {
    "myProp" : {
        type: "integer"
    }
}
let tdString2 = TDTools.serializeTD(thing);
console.log("**** SERIALIZED TD ****");
console.log(tdString2);
console.log("****");
```

## More Details

See <https://github.com/eclipse/thingweb.node-wot/>
