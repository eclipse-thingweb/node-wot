# OPC UA Client Protocol Binding
 
W3C Web of Things (WoT) Protocol Binding for OPC UA
 
## Getting Started
 
### Optional: OPC UA Server Simulator
 
If an OPC UA server is needed, the simulator provided [here](https://github.com/lukesmolo/wot-utils/tree/master/binding-opcua) can be used.
It is based on [node-opcua](https://github.com/node-opcua).
 
```bash
$ npm install node-opcua
$ node opcua-server.js
```

Depending on the Authorization method required, the `auth` global variable should be set accordingly in the `opcua-server.js` script.
Possible values are `null` for disabling the authorized connection to the server, `password` for  enabling the `username-password` authorization, and `certificate` for the authorization through certificates.
By default, `user` is set to **root** as well as the `password`. Feel free to modify them in the `isValidUser` function in the script according to your needs.

### Run the Example App
 
The Binding example in the `./examples` directory provides a TD (`opcua-thing.jsonld`) and an app script (`opcua-example.js`) .
 
Depending on which OPC UA server is used, the following might have to be changed:
* credentials for the OPC UA Thing (id `urn:dev:wot:org:eclipse:opcua-example`) have to be changed in `wot-servient.conf.json`. An example of how to configure them is already provided, both for the user/password and the certificate authentication.

Also parameters for the Client can be passed to the `wot-servient.conf.json`. For the available parameters, please take a look at the official repository of [node-opcua](https://github.com/node-opcua/node-opcua), while for creating the certificates needed by client and server just follow [this](https://github.com/node-opcua/node-opcua/blob/master/documentation/notes_on_certificates.md).
 
## New Form Fields for the OPC UA Binding
 
### href
 
The `href` field is actually not new, only new URIs with the scheme `opc.tcp` are now supported through the Binding.
The href contains: URI schema + IP address + port + NodeID
 
* URI schema: the schema for OPC UA is not registered with IANA; the Binding is using `opc.tcp`.
* IP address and port: IP address and port of the OPC UA server. The credentials for connecting to the server can be added into the `wot-servient.configuration.json`.
* NodeID: the NodeID of the node addressed by the given InteractionAffordance. The NodeID follows the [XML notation](https://documentation.unified-automation.com/uasdkhp/1.0.0/html/_l2_ua_node_ids.html), like several Graphical tools for exploring OPC UA devices. The NodeID is composed by the namespace index, the identifier type, and the node Identifier. If a method has to be addressed, since it requires to be attached to a device, both the DeviceId and the MethodId must be included to the NodeID. In particular, for convenience, the DeviceId comes before the MethodId. 

This is a valid `href` example for addressing a node:
`opc.tcp://localhost:5050/ns=1;s=mynode`

For a method, two nodes need to be given (one for the node on which to call the method, one for the method definition):
`opc.tcp://localhost:5050/ns=1;s=mydevice;mns=1;mb=9997FFAA`

where `ns=1;s=mydevice` is the nodeId of the Device, while `mns=1;mb=9997FFAA` is the nodeId of the method to apply.
 
### opc:method
 
The optional attribute `opc:method` specifies which kind of call should be used in the request.
For the state of this implementation, it is still not used.
These are the default values for this Binding:

* readproperty is set to `READ`
* writepropery is set to `WRITE`
* invokeaction is set to `CALL_METHOD`
 
## New DataSchema Fields for the OPC UA Binding
 
OPC UA uses custom Datatypes on the wire, which requires additional translations from the JSON model used at WoT application level.
To enable support for a proper Datatype translation, the DataSchema information has to be extended with the following terms, and the schema also be passed down to the Binding.
 
### opc:DataType

Among all the possible OPC UA Datatypes, at the moment all the ones supported by (node-wot)[https://github.com/node-opcua/node-opcua/blob/master/packages/node-opcua-variant/source/DataType_enum.ts] can be used. 
The binding needs to read the Dataschema in order to take the proper OPC UA Datatype and adjust the OPC UA request accordingly. For this reason, in order to make this work and for reading the Schema from inside the Binding, the `protocol.interface.ts` in the `thingweb.node-wot/packages/core` directory should be enhanced in order to pass the Affordance Schema to the Binding.

## Additional tools

A basic OPC UA server crawler and a basic OPC UA -> TD translator can be found [here](https://github.com/lukesmolo/wot-utils/tree/master/opcua-crawler)

## TODO
 
- [ ] Subscriptions implementation (EVENTS) with Sub/Pub protocol
- [ ] TEST
- [ ] (OPC UA Server Protocol Binding ?)
 
## Acknowledgments

Many thanks to [Matthias Kovatsch](https://github.com/mkovatsc) for his constant and precious help for this Binding.