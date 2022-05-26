const { Servient } = require("@node-wot/core");
const { HttpClientFactory } = require("@node-wot/binding-http");

// Note: This example is just for testing/demonstration purposes and
//       will eventually be moved to the examples package.
async function discover() {
    const servient = new Servient();
    servient.addClientFactory(new HttpClientFactory());
    const wot = await servient.start();
    for await (const td of wot.discover({
        url: "http://plugfest.thingweb.io:8083/smart-coffee-machine",
        method: "direct",
    })) {
        console.log(td);
    }
}

discover();
