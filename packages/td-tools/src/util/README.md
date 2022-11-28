# Thing Description Utilities

## Asset Interface Description

The [IDTA Asset Interface Description (AID) working group](https://github.com/admin-shell-io/submodel-templates/tree/main/development/Asset%20Interface%20Description/1/0) defines a submodel that can be used to describe the asset's service interface or asset's related service interfaces. The current AID working assumptions reuse existing definitions from [WoT Thing Descriptions](https://www.w3.org/TR/wot-thing-description11/) and hence it is possible to consume AAS with AID definitions with node-wot (e.g., read/subscribe live data of the asset and/or associated service).

### Sample Application

The file `AID_v03_counter.json` describes the counter sample in AID format. The `AssetInterfaceDescriptionUtil` utility class allows to transform the AID format to a valid WoT TD format which in the end can be properly consumed by node-wot.

#### Prerequisites

-   `npm install @node-wot/td-tools`
-   `npm install @node-wot/core`
-   `npm install @node-wot/binding-http`

#### Sample Code

The example tries to load an AID file in AID format and transforms it to a regular WoT TD.

```js
// aid-client.js
const fs = require("fs/promises"); // to read JSON file in AID format

Servient = require("@node-wot/core").Servient;
HttpClientFactory = require("@node-wot/binding-http").HttpClientFactory;

// AID Util
AssetInterfaceDescriptionUtil = require("@node-wot/td-tools").AssetInterfaceDescriptionUtil;

// create Servient and add HTTP binding
let servient = new Servient();
servient.addClientFactory(new HttpClientFactory(null));

let assetInterfaceDescriptionUtil = new AssetInterfaceDescriptionUtil();

async function example() {
    try {
        const aid = await fs.readFile("AID_v03_counter.json", {
            encoding: "utf8",
        });
        // transform AID to WoT TD
        let tdAID = assetInterfaceDescriptionUtil.transformToTD(aid, `{"title": "counter"}`);
        // Note: transformToTD() may have up to 3 input parameters
        // * aid (required):           AID input
        // * template (optional):      Initial TD template
        // * submodelRegex (optional): Submodel filter based on regular expression
        //                             e.g., filtering HTTP only by calling transformToTD(aid, `{}`, "HTTP")

        // do work as usual
        const WoT = await servient.start();
        const thing = await WoT.consume(JSON.parse(tdAID));

        // read property count
        const read1 = await thing.readProperty("count");
        console.log("count value is: ", await read1.value());
    } catch (err) {
        console.log(err);
    }
}

// launch example
example();
```

#### Run the sample script

`node aid-client.js`

It will show the counter value retrieved from http://plugfest.thingweb.io:8083/counter/properties/count

Note: make sure that the file `AID_v03_counter.json` is in the same folder as the script.
