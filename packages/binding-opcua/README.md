# OPC UA Client Protocol Binding

W3C Web of Things (WoT) Protocol Binding for OPC UA

## Getting Started

### Run the Example App

### Exploring the unit tests

A full example can be found it this unit test: packages\binding-opcua\test\full_opcua_thing_test.ts

### href

### opc:method

## New DataSchema Fields for the OPC UA Binding

### opc:DataType

## Additional tools

### basic opcua demo server

A basic demo OPCUA server can be started using the following command.

```
thingweb.node-wot> ts-node packages/binding-opcua/test/fixture/basic_opcua_server.ts
Server started opc.tcp://<YOURMACHINENAME>:7890
```

### awesome WoT - OPCUA tools

the [node-wot-opcua-tools](https://github.com/node-opcua/node-wot-opcua-tools) project provides
some useful application that are built on top of thingweb.node-wob and the OPCUA binding

ref: https://github.com/node-opcua/node-wot-opcua-tools
