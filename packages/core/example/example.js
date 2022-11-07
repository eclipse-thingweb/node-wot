const { Servient } = require("@node-wot/core");
const { HttpClientFactory } = require("@node-wot/binding-http");
const { CoapClientFactory } = require("@node-wot/binding-coap");

// Note: This example is just for testing/demonstration purposes and
//       will eventually be removed/moved to the examples package.
async function discover() {
    const servient = new Servient();
    servient.addClientFactory(new HttpClientFactory());
    servient.addClientFactory(new CoapClientFactory());
    const wot = await servient.start();

    const httpUrl = "http://plugfest.thingweb.io:8083/smart-coffee-machine";
    const coapUrl = "coap://plugfest.thingweb.io:5683/smart-coffee-machine";

    for (const url of [httpUrl, coapUrl]) {
        console.log(await wot.discovery.direct(url));
    }

    // Alternative approach
    for (const url of [httpUrl, coapUrl]) {
        for await (const result of wot.discovery.directIterator(url)) {
            console.log(result);
        }
    }
}

discover();
