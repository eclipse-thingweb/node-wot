# File Binding of node-wot

## Getting Started

In the following examples it is shown how to use the File binding of node-wot.

### Prerequisites
* `npm install @node-wot/core`
* `npm install @node-wot/binding-file`
* local test file `test.txt` with content

### Example 1

The example tries to load an internal TestThing TD and reads a property `fileContent` which exposes the content of the file `test.txt`.

`node example1.js`

```js
// example.js1
Servient = require("@node-wot/core").Servient
FileClientFactory = require("@node-wot/binding-file").FileClientFactory

// create Servient and add File binding
let servient = new Servient();
servient.addClientFactory(new FileClientFactory(null));

td = {
	"id": "urn:dev:wot:org:w3:testthing:file",
	"title": "TestThing",
	"@context": "https://www.w3.org/2019/wot/td/v1",
	"@type": "Thing",
	"security": ["nosec_sc"],
	"properties": {
		"fileContent": {
			"type": "string",
			"readOnly": true,
			"observable": false,
			"forms": [{
				"href": "file://test.txt",
				"contentType": "text/plain",
				"op": ["readproperty"]
			}]
		}
	},
	"securityDefinitions": {
		"nosec_sc": {
			"scheme": "nosec"
		}
	}
};

// try to read property that exposes the content of file test.txt
try {
    servient.start().then((WoT) => {
        WoT.consume(td).then((thing) => {
            // read property "fileContent" and print the content
            thing.readProperty("fileContent").then((s) => {
                console.log("Content of File:\n" + s);
            });
        });
    });
} catch (err) {
    console.error("Script error:", err);
}
```


### Example 2

The example tries to load a locally stored TestThing TD and reads a property `fileContent` which exposes the content of the file `test.txt`.

### Prerequisites
* local TD file `TD.jsonld` with content as in Example 1

`node example2.js`

```js
// example2.js
Servient = require("@node-wot/core").Servient
FileClientFactory = require("@node-wot/binding-file").FileClientFactory

Helpers = require("@node-wot/core").Helpers

// create Servient and add File binding
let servient = new Servient();
servient.addClientFactory(new FileClientFactory(null));

let wotHelper = new Helpers(servient);
wotHelper.fetch("file://TD.jsonld").then(async (td) => {
    // using await for serial execution (note 'async' in then() of fetch())
    try {
        servient.start().then((WoT) => {
            WoT.consume(td).then((thing) => {
				// read property "fileContent" and print the content
				thing.readProperty("fileContent").then((s) => {
					console.log("Content of File:\n" + s);
				});
            });
        });
    } catch (err) {
        console.error("Script error:", err);
    }
}).catch((err) => { console.error("Fetch error:", err); });
```

## More Details

see https://github.com/eclipse/thingweb.node-wot/
