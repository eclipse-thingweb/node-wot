# MQTT Protocol Binding of node-wot

W3C Web of Things (WoT) Protocol Binding for [MQTT](https://en.wikipedia.org/wiki/MQTT).
This package uses [mqtt](https://www.npmjs.com/package/mqtt) as a low level library for MQTT.
W3C WoT Binding Template for MQTT can be found [here](https://w3c.github.io/wot-binding-templates/bindings/protocols/mqtt/index.html).

## Protocol specifier

The protocol prefix handled by this binding is `mqtt://` or `mqtts://`.

## Getting Started

In the following examples it is shown how to use the MQTT binding of node-wot.

### Prerequisites

-   `npm install @node-wot/core`
-   `npm install @node-wot/binding-mqtt`

### MQTT Thing Example I

An MQTT Thing frequently publishes counter values (as an Event Affordance) to the topic `/MQTT-Test/events/counterEvent` of the MQTT broker running behind the address `test.mosquitto.org:1883`.
In addition, the Thing subscribes to the `resetCounter` topic (via its action handler) as a WoT Action Affordance so that
it can handle requests to reset the counter value.

```js
Servient = require("@node-wot/core").Servient;
MqttBrokerServer = require("@node-wot/binding-mqtt").MqttBrokerServer;

// create Servient add MQTT binding
let servient = new Servient();
servient.addServer(new MqttBrokerServer("mqtt://test.mosquitto.org"));

servient.start().then((WoT) => {
    var counter = 0;

    WoT.produce({
        title: "MQTT-Test",
        id: "urn:dev:wot:mqtt:counter",
        actions: {
            resetCounter: {
                description: "Reset counter",
            },
        },
        events: {
            counterEvent: {
                description: "Counter Value",
                data: {
                    type: "integer",
                },
            },
        },
    })
        .then((thing) => {
            thing.setActionHandler("resetCounter", async () => {
                console.log("Resetting counter");
                counter = 0;
            });

            thing.expose().then(() => {
                console.info(thing.title + " ready");

                setInterval(() => {
                    ++counter;
                    thing.emitEvent("counterEvent", counter);
                    console.info("New count ", counter);
                }, 1000);
            });
        })
        .catch((e) => {
            console.log(e);
        });
});
```

#### Sample Thing Description for MQTT Clients

The Thing Description corresponding to the previous example is shown below:

```js
{
    "@context": "https://www.w3.org/2019/wot/td/v1",
    "title": "MQTT-Test",
    "id": "urn:dev:wot:mqtt:counter",
    "actions" : {
        "resetCounter": {
            "description": "Reset counter"
            "forms": [
                {"href": "mqtt://test.mosquitto.org:1883/MQTT-Test/actions/resetCounter"}
            ]
        }
    },
    "events": {
        "counterEvent": {
            "description": "Counter Value",
            "data": {
                "type": "integer"
            },
            "forms": [
                {"href": "mqtt://test.mosquitto.org:1883/MQTT-Test/events/counterEvent"}
            ]
        }
    }
}
```

### MQTT Client Example II

This example takes the Thing Description of the previous example and subscribes to the `counterEvent` and resets the counter every 20s via the `resetCounter` action.

```js
Servient = require("@node-wot/core").Servient;
MqttClientFactory = require("@node-wot/binding-mqtt").MqttClientFactory;

Helpers = require("@node-wot/core").Helpers;

// create Servient and add MQTT binding
let servient = new Servient();
servient.addClientFactory(new MqttClientFactory(null));

// Thing Description can be also fetched
let td = `{
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
        "counterEvent": {
            "description": "Counter Value",
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

            source.subscribeEvent(
                "counterEvent",
                (x) => console.info("value:", x),
                (e) => console.error("Error: %s", e),
                () => console.info("Completed")
            );
            console.info("Subscribed");

            source.invokeAction("resetCounter");

            setInterval(async () => {
                source
                    .invokeAction("resetCounter")
                    .then((res) => {})
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

There are example implementations provided in the [example/scripting folder](https://github.com/eclipse/thingweb.node-wot/tree/master/examples/scripts).

Please setup node-wot as described at the [node-wot main page](https://github.com/eclipse/thingweb.node-wot#as-a-standalone-application).

-   example-mqtt-publish.js: Shows when node-wot acts as a MQTT Client that publishes data (latest counter value) to a broker.
    At the same time, another client can invoke an action, such as `resetCounter`, by sending a publication message to the topic of this action.
    This other client does not have to be node-wot, any MQTT client can interact with this Thing.
    For node-wot clients, make sure to provide MQTT broker details (`host`, `port`, `username`, `password`, `clientId`) in the wot-servient.conf.json:

```js
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

See <https://github.com/eclipse/thingweb.node-wot/>
