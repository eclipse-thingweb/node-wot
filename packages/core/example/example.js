const { Servient } = require("@node-wot/core");

async function discover() {
    const servient = new Servient();
    const wot = await servient.start();
    for await(const td of wot.discover({url: "http://plugfest.thingweb.io:8083/smart-coffee-machine", method: "direct"})) {
        console.log(td);
    }
}

discover();
