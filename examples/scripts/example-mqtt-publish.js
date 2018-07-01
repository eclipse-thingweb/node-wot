
let servient_lib = require("../../packages/core/dist/servient");
let mqttBrokerServer_lib = require("../../packages/binding-mqtt/dist/mqtt-broker-server");
let mqttClientFactory_lib = require("../../packages/binding-mqtt/dist/mqtt-client-factory");

let servient = new servient_lib.default();
let broker = new mqttBrokerServer_lib.MqttBrokerServer("mqtt://test.mosquitto.org", "1883");

servient.addClientFactory(new mqttClientFactory_lib.default());
servient.addServer(broker);

servient.start().then(wotFactory => {
    let thing = wotFactory.produce({ name: "Test" });
    
    thing.addEvent("event1", {type: "number"});
    
    thing.expose();

    var counter = 0;

    setInterval( async () => {
        ++counter;
        thing.events.event1.emit(counter);
        console.info("Emitted change", counter);
    }, 5000);

});
