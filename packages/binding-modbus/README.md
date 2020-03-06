# Modbus Client Protocol Binding
 
W3C Web of Things (WoT) Protocol Binding for Modbus TCP [RFC](https://tools.ietf.org/html/draft-dube-modbus-applproto-00). This package uses [modbus-serial](https://www.npmjs.com/package/modbus-serial) as a low level client for Modbus TCP. 
 
## Getting Started

### Run the Example App
 
The Binding example in the `./examples` directory provides a TD (`modbus-thing.jsonld`) and an app script (`modbus-example.js`) . To execute the script use the pre-configure servient inside `./examples/servients` folder, as following:
```bash
# first init the node package
cd examples/servients/modbus-cli
npm install

# then start the modbus server
npm run server

# finally start the script
cd ../../scripts
node ../servients/modbus-cli/dist/modbus-cli.js modbus-example.js
```
**Rember** to correctly initialize your dev environment  as described inside the [repository readme](../../README.md), before to start the example application.
 
## New Form Fields for the Modbus Binding
**Note**: for further details pleas refer to the [documentation](./src/modbus.ts) 
 
### modbus:function
Specifies which modbus function should be issue in the requested command. The list of the available function is the following:
| Function ID   | Label
| ------------- |:--------------------:| 
| 1             | readCoil             | 
| 2             | readDiscreteInput    |
| 3             | readHoldingRegisters |
| 4             | readInputRegisters   |
| 5             | writeSingleCoil      |
| 6             | writeSingleHoldingRegister      |
| 15            | writeMultipleCoils     |
| 16            | writeMultipleHoldingRegisters     |
The list is build from [wikipedia definition](https://en.wikipedia.org/wiki/Modbus) of modbus function names, it can be different in proprietary implementations of modbus protocol.
Function IDs or labels can be either used as values of `modbus:function` property.

### modbus:entity
A more user-friendly property to specify `modbus:function`. It can be filled with the following keywords: `Coil`, `DiscreteInput`, `InputRegister`, `HoldingRegister`. The client will then determine the right function code to be applied in the modbus request. Futhermore, it can be used in multi-operation forms whereas modbus:function cannot. See the [example] 

**Notice** that when used in conjunction with `modbus:function`, the value of `modbus:function` property is ignored. 

### modbus:unitID
The physical bus address of the unit targeted by the mobus request.
 
### modbus:range
This property defines how many registers or coils should be read or written. The value is a tuple where the first element is the starting address while the second represents the total amount of registers. For example in a reading command the tuple [2,3] indicate that the values of registers 2,3,4 should be returned as response.
 
### modbus:pollingTime
The polling time used for subscriptions. The client will issue a reading command every modbus:pollingTime milliseconds. Note that the reading request timeout can be still controlled using modbus:timeout property. 


### modbus:timeout
Timeout in milliseconds of the modbus request. Default to 1000 milliseconds

 
## DataSchema
Currently modbus protocol binding uses only `OctetstreamCodec` so `array` and `object` schema are not supported.

## Security 
The protocol does not support security.

## Valid Form Examples

### Base read function form
Reads the 8th input register of the unit 1
```json
{
    "href": "modbus://127.0.0.1:60000",
    "contentType": "application/octet-stream;length=2",
    "op": [
        "readproperty"
    ],
    "modbus:function": "readInputRegister",
    "modbus:range": [8],
    "modbus:unitID": 1,
    "modbus:timeout": 2000
}
```
### Write/read function form
Read and write the 8th holding register of the unit 1
```json
{
    "href": "modbus://127.0.0.1:60000",
    "contentType": "application/octet-stream;length=2",
    "op": [
        "readproperty",
        "writeproperty"
    ],
    "modbus:entity": "HoldingRegister",
    "modbus:range": [8],
    "modbus:unitID": 1
}
```
### Subscribe form
Polls the 8th holding register of the unit 1 every second.
```json
{
    "href": "modbus://127.0.0.1:60000",
    "contentType": "application/octet-stream;length=2",
    "op": [
        "observeproperty"
    ],
    "modbus:entity": "HoldingRegister",
    "modbus:range": [8],
    "modbus:unitID": 1,
    "modbus:pollingTime: 1000
}
```
 
## TODO
 
- [x] TEST
- [ ] (Modbus Server Protocol Binding)
- [ ] Connection pooling (?)
