# Eclipse Thingweb node-wot MQTT Binding

W3C Web of Things MQTT binding implementation on NodeJS

## License

Dual-licensed under both

* [Eclipse Public License v. 2.0](http://www.eclipse.org/legal/epl-2.0)
* [W3C Software Notice and Document License (2015-05-13)](https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document)

Pick one of these two licenses that fits your needs.
Please also see the additional [notices](NOTICE.md) and [how to contribute](CONTRIBUTING.md).

## Prerequisites

Setup node-wot as described at the [node-wot main page](./../../README.md).

## Run Samples

There are sample implementations provided in the [example/scripting folder](https://github.com/eclipse/thingweb.node-wot/tree/master/examples/scripts):

* example-mqtt-publish.js: Shows when node-wot act as a MQTT Client that publish data (latest counter value) to a broker. In the same time the client setup an action (reset counter) that can be initated by another MQTT client by sending a publication message to this action based topic. Please note to provide MQTT broker details (host, port, [username], [password], [clientId]) in the wot-servient.conf.json:


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

* example-mqtt-subscription.js: Shows how node-wot consumes a Thing Description to do MQTT subscription on the provided event (=latest counter value) as well as initat the action (reset counter).

Start the script by the command `wot-servient -c mqtt-subscribe.js` or `node ../../packages/cli/dist/cli.js -c mqtt-subscribe.js`.


## Sample Thing Description for MQTT Clients

An MQTT client frequently publishes counter data on the topic /MQTT-Test/events/counterEvent to the MQTT broker running behind the address test.mosquitto.org:1883.

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
