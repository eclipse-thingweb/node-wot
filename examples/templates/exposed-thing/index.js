//Where your concrete implementation is included
WotDevice = require("./dist/base.js").WotDevice

/*
This project supports the registration of the generated TD to a TD directory
Fill in the directory URI where the HTTP POST request to send the TD will be made
If you leave it empty, registration thread will never execute, otherwise it will try to register every 10 seconds 
*/
const TD_DIRECTORY = ""


Servient = require("@node-wot/core").Servient
//Importing the required bindings
HttpServer = require("@node-wot/binding-http").HttpServer
//CoapServer = require("@node-wot/binding-coap").CoapServer
//MqttBrokerServer = require("@node-wot/binding-mqtt").MqttBrokerServer

//Creating the instances of the binding servers
var httpServer = new HttpServer({port: 8080});
//var coapServer = new CoapServer({port: 5683});
//var mqttserver = new MqttBrokerServer("test.mosquitto.org"); //change it according to the broker address


//Building the servient object
var servient = new Servient();
//Adding different bindings to the server
servient.addServer(httpServer);
//servient.addServer(coapServer);
//servient.addServer(mqttServer);

servient.start().then((WoT) => {
    wotDevice = new WotDevice(WoT, TD_DIRECTORY); // you can change the wotDevice to something that makes more sense
});
