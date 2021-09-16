# Eclipse Thingweb node-wot MQTT Binding

## Getting Started

In the following examples it is shown how to use the MQTT binding of node-wot.

### Prerequisites

-   `npm install @node-wot/core`
-   `npm install @node-wot/binding-mqtt`

### MQTT Client Example I

An MQTT client frequently publishes counter data on the topic /MQTT-Test/events/counterEvent to the MQTT broker running behind the address test.mosquitto.org:1883. In addition, the client subscribes the resetCounter topic as WoT action to reset the own counter.

```
Servient = require("@node-wot/core").Servient
MqttBrokerServer = require("@node-wot/binding-mqtt").MqttBrokerServer

// create Servient add MQTT binding
let servient = new Servient();
servient.addServer(new MqttBrokerServer("mqtt://test.mosquitto.org"));

servient.start().then((WoT) => {

	var counter  = 0;

	WoT.produce({
		title: "MQTT-Test",
		actions: {
			resetCounter: {
				description: "Reset counter"
			}
		},
		events: {
			counterEvent: {
				description: "Get counter"
			}
		}
	})
	.then((thing) => {

		thing.setActionHandler("resetCounter", () => {
			console.log("Resetting counter");
			counter = 0;
		});

		thing.expose().then(() => {
			console.info(thing.title + " ready");

			setInterval(() => {
				++counter;
				thing.emitEvent("counterEvent", counter);
				console.info("New count", counter);
			}, 1000);
		});
	})
	.catch((e) => {
		console.log(e)
	});
});
```

#### Sample Thing Description for MQTT Clients

The corresponding Thing Description of the previous example is shown here:

```
{
    "@context": "https://www.w3.org/2019/wot/td/v1",
    "title": "MQTT-Test",
    "id": "urn:dev:wot:mqtt:counter",
    "actions" : {
        "resetCounter": {
            "forms": [
                {"href": "mqtt://test.mosquitto.org:1883/MQTT-Test/actions/resetCounter"}
            ]
        }
    },
    "events": {
        "counterEvent": {
            "type": "integer",
            "forms": [
                {"href": "mqtt://test.mosquitto.org:1883/MQTT-Test/events/counterEvent"}
            ]
        }
    }
}
```

### MQTT Client Example II

This example takes the Thing Description of the previous example and subscribe to the counter event and reset the counter every 20s.

```
Servient = require("@node-wot/core").Servient
MqttClientFactory = require("@node-wot/binding-mqtt").MqttClientFactory

Helpers = require("@node-wot/core").Helpers

// create Servient and add MQTT binding
let servient = new Servient();
servient.addClientFactory(new MqttClientFactory(null));

// Thing Description can be also fetched
let td =
    `{
    "@context": "https://www.w3.org/2019/td/v1",
    "title": "MQTT-Test",
    "id": "urn:dev:wot:mqtt:counter",
    "actions" : {
        "resetCounter": {
            "forms": [
                {"href": "mqtt://test.mosquitto.org:1883/MQTT-Test/actions/resetCounter"}
            ]
        }
    },
    "events": {
        "counter": {
            "data": {
                "type": "integer"
            },
            "forms": [
                {"href": "mqtt://test.mosquitto.org:1883/MQTT-Test/events/counterEvent"}
            ]
        }
    }
}`;

try {
    servient.start().then((WoT) => {
        WoT.consume(JSON.parse(td)).then((source) => {
            console.info("=== TD ===");
            console.info(td);
            console.info("==========");

            source.subscribeEvent("counter",
                x => console.info("value:", x),
                e => console.error("Error: %s", e),
                () => console.info("Completed")
            );
            console.info("Subscribed");

            setInterval(async () => {
                source.invokeAction("resetCounter")
                    .then((res) => { })
                    .catch((err) => {
                        console.error("ResetCounter error:", err.message);
                    });
                console.info("Reset counter!");
            }, 20000);
        });
    });
} catch (err) {
    console.error("Script error:", err);
}

```

### More Examples

There are sample implementations provided in the [example/scripting folder](https://github.com/eclipse/thingweb.node-wot/tree/master/examples/scripts).

Please setup node-wot as described at the [node-wot main page](https://github.com/eclipse/thingweb.node-wot#as-a-standalone-application).

-   example-mqtt-publish.js: Shows when node-wot act as a MQTT Client that publish data (latest counter value) to a broker. In the same time the client setup an action (reset counter) that can be initated by another MQTT client by sending a publication message to this action based topic. Please note to provide MQTT broker details (host, port, [username], [password], [clientId]) in the wot-servient.conf.json:

```
{
    "mqtt" : {
        "host" : "mqtt://test.mosquitto.org",
        "username" : "username",
        "password" : "password",
        "clientId" : "uniqueId",
        "port": 1883
    }
}

```

Start the script by the command `wot-servient mqtt-publish.js` or `node ../../packages/cli/dist/cli.js mqtt-publish.js`.

-   example-mqtt-subscription.js: Shows how node-wot consumes a Thing Description to do MQTT subscription on the provided event (=latest counter value) as well as initat the action (reset counter).

Start the script by the command `wot-servient -c mqtt-subscribe.js` or `node ../../packages/cli/dist/cli.js -c mqtt-subscribe.js`.

### More Details

see https://github.com/eclipse/thingweb.node-wot/
