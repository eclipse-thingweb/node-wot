# MQTT Protocol Binding of node-wot

W3C Web of Things (WoT) Protocol Binding for [MQTT](https://en.wikipedia.org/wiki/MQTT).
This package uses [mqtt](https://www.npmjs.com/package/mqtt) as a low level library for MQTT.
W3C WoT Binding Template for MQTT can be found [here](https://w3c.github.io/wot-binding-templates/bindings/protocols/mqtt/index.html).

Current Maintainer(s): [@egekorkan](https://github.com/egekorkan) [@sebastiankb](https://github.com/sebastiankb) [@hasanheroglu](https://github.com/hasanheroglu)

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
const { Servient } = require("@node-wot/core");
const { MqttBrokerServer } = require("@node-wot/binding-mqtt");

// create Servient add MQTT binding
const servient = new Servient();
servient.addServer(new MqttBrokerServer({ uri: "mqtt://test.mosquitto.org" }));

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
const { Servient } = require("@node-wot/core");
const { MqttClientFactory } = require("@node-wot/binding-mqtt");

// create Servient and add MQTT binding
const servient = new Servient();
servient.addClientFactory(new MqttClientFactory(null));

// Thing Description can be also fetched
const td = `{
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

### MQTT Form Parameters: QoS and Retain

The MQTT binding supports Quality of Service (QoS) and message retention through form parameters. These parameters control how messages are delivered and stored by the broker.

#### Quality of Service (QoS)

QoS determines the guarantee level for message delivery:

-   `mqv:qos` = `"0"` (default): At most once - messages are delivered with no guarantee
-   `mqv:qos` = `"1"`: At least once - messages are guaranteed to be delivered at least once
-   `mqv:qos` = `"2"`: Exactly once - messages are guaranteed to be delivered exactly once

When a consumer reads or writes to a Thing, it will use the QoS level specified in the form. For example:

```js
{
    "properties": {
        "temperature": {
            "type": "number",
            "forms": [
                {
                    "href": "mqtt://broker.example.com/sensor/temperature",
                    "mqv:qos": "1"
                }
            ]
        }
    }
}
```

#### Message Retention

The `mqv:retain` parameter controls whether the broker retains the last message published to a topic:

-   `mqv:retain` = `true`: The broker stores the last message and sends it to new subscribers
-   `mqv:retain` = `false` (default): Messages are not retained

This is useful for properties that represent state, ensuring new consumers immediately receive the current value:

```js
{
    "properties": {
        "status": {
            "type": "string",
            "forms": [
                {
                    "href": "mqtt://broker.example.com/device/status",
                    "mqv:qos": "1",
                    "mqv:retain": true
                }
            ]
        }
    }
}
```

### Hosting your own MQTT Broker

Instead of connecting to an external MQTT broker, you can host your own MQTT broker within your node-wot application by setting the `selfHost` option to `true`. This is useful for testing, development, or when you want to run a self-contained application.

```js
const { Servient } = require("@node-wot/core");
const { MqttBrokerServer } = require("@node-wot/binding-mqtt");

// create Servient with self-hosted MQTT broker
const servient = new Servient();
servient.addServer(new MqttBrokerServer({ uri: "mqtt://localhost:1883", selfHost: true }));

servient.start().then((WoT) => {
    // Your Things will now use the self-hosted broker
    WoT.produce({
        title: "My Thing",
        // ... rest of Thing Description
    }).then((thing) => {
        thing.expose();
    });
});
```

#### Self-Hosted Broker with Authentication

You can also add authentication to your self-hosted broker by providing credentials:

```js
const servient = new Servient();
servient.addServer(
    new MqttBrokerServer({
        uri: "mqtt://localhost:1883",
        selfHost: true,
        selfHostAuthentication: [
            { username: "user1", password: "password1" },
            { username: "user2", password: "password2" },
        ],
    })
);
```

#### Self-Hosted Broker with TLS

For secure communication, you can enable TLS on your self-hosted broker:

```js
const fs = require("fs");

const servient = new Servient();
servient.addServer(
    new MqttBrokerServer({
        uri: "mqtts://localhost:8883",
        selfHost: true,
        key: fs.readFileSync("path/to/private-key.pem"),
        cert: fs.readFileSync("path/to/certificate.pem"),
    })
);
```

### More Examples

There are example implementations provided in the [example/scripting folder](https://github.com/eclipse-thingweb/node-wot/tree/master/examples/scripts).

Please setup node-wot as described at the [node-wot main page](https://github.com/eclipse-thingweb/node-wot#as-a-standalone-application).

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

-   example-mqtt-subscription.js: Shows how node-wot consumes a Thing Description to do MQTT subscription on the provided event (=latest counter value) as well as initiate the action (reset counter).

Start the script by the command `wot-servient -c mqtt-subscribe.js` or `node ../../packages/cli/dist/cli.js -c mqtt-subscribe.js`.

### More Details

See <https://github.com/eclipse-thingweb/node-wot/>
