# Modbus Client Protocol Binding
 
W3C Web of Things (WoT) Protocol Binding for Modbus TCP [RFC](https://tools.ietf.org/html/draft-dube-modbus-applproto-00). This package uses [modbus-serial](https://www.npmjs.com/package/modbus-serial) as a low level client for Modbus TCP. 

## Protocol specifier

The protocol prefix handled by this binding is `modbus+tcp:`. This is currently a non-standard prefix.
 
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
**Rember** to correctly initialize your dev environment as described inside the [repository readme](https://github.com/eclipse/thingweb.node-wot/blob/master/README.md), before to start the example application. In particular, the optional step `sudo npm run link` must be executed.
 
## New Form Fields for the Modbus Binding
**Note**: for further details please refer to the [documentation](https://github.com/eclipse/thingweb.node-wot/blob/master/packages/binding-modbus/src/modbus.ts).
 
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

## URL format

The URL is used to transport all addressing information necessary to describe the MODBUS connection and register addresses. It has the following structure:

```
modbus+tcp:// <host> [ : <port> ] [/ <unitid> [ ?offset=<offset> [&length=<length> ] ] ]
```

with the following meaning:

* `<host>` is the host name or IP address of the MODBUS slave
* `<port>` is the optional TCP port number used to access the MODBUS slave. Default is 502
* `<unitid>` is the MODBUS unit id of the MODBUS slave; same as [modbus:unitID](#modbus:unitID)  
* `<offset>` is the starting offset register number; the first parameter of [modbus:range](#modbus:range)   
* `<length>` is the optional number of registers to access. Default is 1; see [modbus:range](#modbus:range)

When specified URL values override the corresponding `form` parameter.
 
## DataSchema
The MODBUS binding uses and provides plain binary data for reading and writing. Therefore in most cases it will be associated with the content type `application/octet-stream`. Please refer to the description of this codec on how to decode and encode plain register values to/from JavaScript objects (See `OctetstreamCodec`). **Note** `array` and `object` schema are not supported.

For register properties the payload is just the plain sequence of bytes read from or written to the registers. For coils and discrete inputs, the payload is a sequence of bytes, each corresponding to a single coil or discrete input. Each byte contains the value `0` or `1`. So the encoder / decoder should work on this series of bytes and does not have to take care about handling the individual bits. Mapping each coil or discrete input to a single property of type `boolean` works just fine!

## Security 
The protocol does not support security.

# Implementation notes

This implementation handles multiple requests to the same slave by serializing and combining them if possible. In the following, the terms __request__ and __transaction__ are used as follows to describe this:

* A __request__ is a read or write request to a resource as issued by a user of the node-wot API.
* A __transaction__ is a MODBUS operation and may cover the data of multiple __requests__.

## Combination

When two __requests__ of the same type are issued and these requests cover neighboured registers, then they are combined into a single __transaction__ reading or writing the combined register range. Note that this algorithm is currently rather simple: New __requests__ are just checked if they can be prepended or appended to an existing __transaction__. If not, a new __transcation__ is created. When a __transcation__ completes, all __requests__ contained in this __transaction__ are completed.

## Serialization

Multiple __transactions__ to the same slave are serialized. This means that a new MODBUS __transaction__ is only started when the previous __transaction__ was finished. __Transactions__ are held in a queue and executed in a first-come-first-serve manner.

## Combination using the node-wot API

To help the MODBUS binding to perform combination a user of the API should create several requests for neighboured registers and resolve them alltogether in a single call to `Promise.all()`, e.g. as follows:

```javascript
    console.info("Creating promise vl1n");
    let vl1n = pac3200.properties["Voltage/L1N"].read();
    console.info("Creating promise vl2n");
    let vl2n = pac3200.properties["Voltage/L2N"].read();
    console.info("Creating promise vl3n");
    let vl3n = pac3200.properties["Voltage/L3N"].read();

    console.info("Resolving all promises");
    Promise.all([vl1n, vl2n, vl3n])
      .then(values => values.forEach(v => console.info('Voltage = ', v)))
      .catch(reason => console.warn('Failed ', reason));
```

This procedure guarantees that the __requests__ are all combined into a single __transaction__ *before* this __transaction__ is executed. A similar approach can also be used to write multiple properties in a single __transaction__.

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
 
## TODOs
 
- [x] TEST
- [ ] (Modbus Server Protocol Binding)
- [x] Connection pooling
- [ ] More sophisticated algorithm for combining requests. Some ideas
    * Not only append or prepend requests to transactions, but also combine transactions which become neighboured later on
    * Impose some limit to the overall number of registers. The MODBUS protocol has such a limit and devices may define even lower values 
- [ ] When a connection times out, re-connection does not work (see `connectionTimeout` in modbus-client.ts)
- [x] When a Modbus device is not reachable, scripts using binding-modbus stop working - corresponding error handling is necessary

