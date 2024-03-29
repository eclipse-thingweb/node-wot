# File Binding of node-wot

## Protocol specifier

The protocol prefix handled by this binding is `file://`.

## Getting Started

In the following examples, how to use the File binding of node-wot is shown.

### Prerequisites

-   `npm install @node-wot/core`
-   `npm install @node-wot/binding-file`
-   local test file `test.txt` with content

### Example 1

The example tries to load an internal TestThing TD and reads the `fileContent` property, which exposes the content of the file `test.txt`.

`node example1.js`

```js
// example1.js
const { Servient } = require("@node-wot/core");
const { FileClientFactory } = require("@node-wot/binding-file");

// create Servient and add File binding
const servient = new Servient();
servient.addClientFactory(new FileClientFactory(null));

td = {
    id: "urn:dev:wot:org:w3:testthing:file",
    title: "TestThing",
    "@type": "Thing",
    security: ["nosec_sc"],
    properties: {
        fileContent: {
            type: "string",
            readOnly: true,
            observable: false,
            forms: [
                {
                    href: "file:///test.txt",
                    contentType: "text/plain",
                    op: ["readproperty"],
                },
            ],
        },
    },
    securityDefinitions: {
        nosec_sc: {
            scheme: "nosec",
        },
    },
};

// try to read property that exposes the content of file test.txt
try {
    servient.start().then(async (WoT) => {
        const thing = await WoT.consume(td);

        // read property "fileContent" and print the content
        const read1 = await thing.readProperty("fileContent");
        console.log("Content of File:\n", await read1.value());
    });
} catch (err) {
    console.error("Script error:", err);
}
```

### Example 2

The example tries to load a locally stored TestThing TD and reads the `fileContent` property, which exposes the content of the file `test.txt`.

### Prerequisites

-   local TD file `TD.jsonld` with content as in Example 1

`node example2.js`

```js
// example2.js
const { Servient } = require("@node-wot/core");
const { FileClientFactory } = require("@node-wot/binding-file");

// create Servient and add File binding
const servient = new Servient();
servient.addClientFactory(new FileClientFactory(null));

servient
    .start()
    .then(async (WoT) => {
        // using await for serial execution (note 'async' in then() of start())
        try {
            const td = await WoT.requestThingDescription("file:///TD.jsonld");
            const thing = await WoT.consume(td);

            // read property "fileContent" and print the content
            const read1 = await thing.readProperty("fileContent");
            console.log("Content of File:\n" + (await read1.value()));
        } catch (err) {
            console.error("Script error:", err);
        }
    })
    .catch((err) => {
        console.error("Fetch error:", err);
    });
```

## More Details

See <https://github.com/eclipse-thingweb/node-wot/>
