import * as WoT from 'wot-typescript-definitions';
import Servient, { ConsumedThing } from '../../../packages/core';
import * as TD from '../../../packages/td-tools';
import { MqttClientFactory } from '../../../packages/binding-mqtt/src/mqtt';
import HttpServer from '../../../packages/binding-http/src/http-server';
import * as mqtt from 'mqtt';



// setup simple MQTT test publisher--> requires internet access to mqtt://test.mosquitto.org
let client = mqtt.connect("mqtt://test.mosquitto.org:1883");
client.on('connect', () => {                 
    setInterval( function() {
        let temperature = Math.random() * 30;
        temperature = temperature.toFixed(2);
        client.publish('/wot/temperature', temperature.toString(), { qos: 0, retain: false});
    }, 1000);
    console.info(`MQTT publisher started`);
});



// sample TD containing different topics from different brokers
let td = 
`{
    "name": "Node MCU MQTT Parking Sensor",
    "id": "urn:dev:wot:com:siemens:parking",
    "events": {
        "lightSensor": {
            "type": "int",
            "forms": [
                {"href": "mqtt://192.168.1.187:1883/lightSensor", "mqtt:qos":  0, "mqtt:retain" : false}
            ]
        },
        "parkingStatus": {
            "type": "boolean",
            "forms": [
                {"href": "mqtt://192.168.1.187:1883/parkingStatus",  "mqtt:qos":  0, "mqtt:retain" : false}
            ]
        },
        "temperature": {
            "type": "int",
            "forms": [
                {"href": "mqtt://test.mosquitto.org:1883/wot/temperature",  "mqtt:qos":  0, "mqtt:retain" : false}
            ]
        } 
    } 
}`;

let servient = new Servient();
servient.addClientFactory(new MqttClientFactory());
servient.start().then(wotFactory => {
    let thing = wotFactory.consume(td);    
    thing.events.lightSensor.subscribe(data => {
			console.info("lightSensor:", data);
	});

    thing.events.parkingStatus.subscribe(data => {
			console.info("parkingStatus:", data);
    });
    
    thing.events.temperature.subscribe(data => {
        console.info("temperature:", data);
    });
    
});


