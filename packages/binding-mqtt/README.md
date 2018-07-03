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

There are sample implementations provided in the [example/scripting folder](./examples/scripts):

* example-mqtt-publish.js: Shows when node-wot act as a MQTT Client that publish data (latest counter value) to a broker. In the same time the client setup an action (reset counter) that can be initated by another MQTT client by sending a publication message to this action based topic.

* example-mqtt-subscription.js: Shows how node-wot consumes a Thing Description to do MQTT subscription on the provided event (=latest counter value) as well as initat the action (reset counter).

## Sample Thing Description for MQTT Clients

```
{
    "name": "MQTT Counter",
    "id": "urn:dev:wot:mqtt:counter",
    "actions" : {
        "resetCounter": {
            "forms": [
                {"href": "mqtt://test.mosquitto.org:1883/Test/actions/resetCounter",  "mqtt:qos":  0, "mqtt:retain" : false}
            ]
        }
    }, 
    "events": {
        "temperature": {
            "type": "integer",
            "forms": [
                {"href": "mqtt://test.mosquitto.org:1883/Test/events/event1",  "mqtt:qos":  0, "mqtt:retain" : false}
            ]
        } 
    } 
}
```