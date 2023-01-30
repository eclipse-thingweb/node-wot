# Modbus Client Protocol Binding of node-wot

## Overview

W3C Web of Things (WoT) Protocol Binding for [Modbus](https://en.wikipedia.org/wiki/Modbus) TCP [RFC](https://tools.ietf.org/html/draft-dube-modbus-applproto-00).
This package uses [modbus-serial](https://www.npmjs.com/package/modbus-serial) as a low level client for Modbus TCP.
W3C WoT Binding Template for Modbus can be found [here](https://w3c.github.io/wot-binding-templates/bindings/protocols/modbus/index.html).

## Protocol specifier

The protocol prefix handled by this binding is `modbus+tcp://`.

## Getting Started

### Run the Example App

The Binding example in the `./examples` directory provides a TD (`modbus-thing.jsonld`) and an app script (`modbus-example.js`) .
To execute the script use the pre-configure servient inside `./examples/servients` folder, as following:

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

**Remember** to correctly initialize your development environment as described inside the [repository readme](https://github.com/eclipse/thingweb.node-wot/blob/master/README.md),
before starting the example application. In particular, the optional step `sudo npm run link` must be executed.

## New Form Fields for the Modbus Binding

**Note**: for further details please refer to the [documentation](https://github.com/eclipse/thingweb.node-wot/blob/master/packages/binding-modbus/src/modbus.ts).

### modbus:function

Specifies which modbus function should be issue in the requested command. The list of the available function is the following:
| Function ID | Label
| ------------- |:--------------------:|
| 1 | readCoil |
| 2 | readDiscreteInput |
| 3 | readHoldingRegisters |
| 4 | readInputRegisters |
| 5 | writeSingleCoil |
| 6 | writeSingleHoldingRegister |
| 15 | writeMultipleCoils |
| 16 | writeMultipleHoldingRegisters |
The list is build from [wikipedia definition](https://en.wikipedia.org/wiki/Modbus) of modbus function names, it can be different in proprietary implementations of modbus protocol.
Function IDs or labels can be either used as values of `modbus:function` property.

### modbus:entity

A more user-friendly property to specify `modbus:function`. It can be filled with the following keywords: `Coil`, `DiscreteInput`, `InputRegister`, `HoldingRegister`. The client will then determine the right function code to be applied in the modbus request. Futhermore, it can be used in multi-operation forms whereas modbus:function cannot. See the [example]

**Notice** that when used in conjunction with `modbus:function`, the value of `modbus:function` property is ignored.

### modbus:unitID

The physical bus address of the unit targeted by the mobus request.

### modbus:address

This property defines the starting address of registers or coils that are meant to be written.

### modbus:quantity

This property defines the total amount of registers or coils that should be written, beginning with the register specified with the property 'modbus:address'.

### modbus:pollingTime

The polling time used for subscriptions. The client will issue a reading command every modbus:pollingTime milliseconds. Note that the reading request timeout can be still controlled using modbus:timeout property.

### modbus:timeout

Timeout in milliseconds of the modbus request. Default to 1000 milliseconds

## URL format

The URL is used to transport all addressing information necessary to describe the MODBUS connection and register addresses. It has the following structure:

```
modbus+tcp:// <host> [ : <port> ] [/ <unitid> [ / <address> ] [&quantity=<quantity> ] ]
```

with the following meaning:

-   `<host>` is the host name or IP address of the MODBUS slave
-   `<port>` is the optional TCP port number used to access the MODBUS slave. Default is 502
-   `<unitid>` is the MODBUS unit id of the MODBUS slave; same as [modbus:unitID](#modbus:unitID)
-   `<address>` is the starting address register number; see [modbus:address](#modbus:address)
-   `<quantity>` is the optional number of registers to access. Default is 1; see [modbus:quantity](#modbus:quantity)

When specified URL values override the corresponding `form` parameter.

## DataSchema

The MODBUS binding uses and provides plain binary data for reading and writing. Therefore in most cases it will be associated with the content type `application/octet-stream`. Please refer to the description of this codec on how to decode and encode plain register values to/from JavaScript objects (See `OctetstreamCodec`). **Note** `array` and `object` schema are not supported.

Along with content type `application/octet-stream`, this protocol binding accepts also an optional `byteSeq` parameter. `byteSeq` specifies the endian-ness of the raw byte data being read/written by the MODBUS binding. It follows the notation `application/octet-stream;byteSeq=value`, where its value can be one of the following:

-   `BIG_ENDIAN`, which is the default value
-   `LITTLE_ENDIAN`
-   `BIG_ENDIAN_BYTE_SWAP`
-   `LITTLE_ENDIAN_BYTE_SWAP`

**Note**: the list may be extended in the future.

In particular, the decimal numbers `9545` and `22880` will be encoded as follows:

-   `BIG_ENDIAN`: `25 49 59 60`
-   `LITTLE_ENDIAN`: `60 59 49 25`
-   `BIG_ENDIAN_BYTE_SWAP`: `49 25 60 59`
-   `LITTLE_ENDIAN_BYTE_SWAP`: `59 60 25 49`

For register properties the payload is just the plain sequence of bytes read from or written to the registers. For coils and discrete inputs, the payload is a sequence of bytes, each corresponding to a single coil or discrete input. Each byte contains the value `0` or `1`. So the encoder / decoder should work on this series of bytes and does not have to take care about handling the individual bits. Mapping each coil or discrete input to a single property of type `boolean` works just fine!

Another parameter that can be used in conjunction with `application/octet-stream` is `length`. This parameter specifies the length of the payload in bytes. This is useful to indicate the actual length of the payload when reading or writing a sequence of registers. For example, when reading a property using `readHoldingRegisters`, the payload length can be used to specify the number of registers to be read. Notice that the payload length must always
be equal to the number of registers multiplied by the registers size in bytes.

## Security

The protocol does not support security.

# Implementation notes

This implementation handles multiple requests to the same slave by serializing and combining them if possible. In the following, the terms **request** and **transaction** are used as follows to describe this:

-   A **request** is a read or write request to a resource as issued by a user of the node-wot API.
-   A **transaction** is a MODBUS operation and may cover the data of multiple **requests**.

## Combination

When two **requests** of the same type are issued and these requests cover neighboured registers, then they are combined into a single **transaction** reading or writing the combined register range. Note that this algorithm is currently rather simple: New **requests** are just checked if they can be prepended or appended to an existing **transaction**. If not, a new **transcation** is created. When a **transcation** completes, all **requests** contained in this **transaction** are completed.

## Serialization

Multiple **transactions** to the same slave are serialized. This means that a new MODBUS **transaction** is only started when the previous **transaction** was finished. **Transactions** are held in a queue and executed in a first-come-first-serve manner.

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
    .then((values) => values.forEach((v) => console.info("Voltage = ", v)))
    .catch((reason) => console.warn("Failed ", reason));
```

This procedure guarantees that the **requests** are all combined into a single **transaction** _before_ this **transaction** is executed. A similar approach can also be used to write multiple properties in a single **transaction**.

## Valid Form Examples

### Base read function form

Reads the 8th input register of the unit 1

```json
{
    "href": "modbus://127.0.0.1:60000",
    "contentType": "application/octet-stream;length=2",
    "op": ["readproperty"],
    "modbus:function": "readInputRegister",
    "modbus:address": 8,
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
    "op": ["readproperty", "writeproperty"],
    "modbus:entity": "HoldingRegister",
    "modbus:address": 8,
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
    "modbus:address": 8,
    "modbus:unitID": 1,
    "modbus:pollingTime: 1000
}
```

## TODOs

-   [x] TEST
-   [ ] (Modbus Server Protocol Binding)
-   [x] Connection pooling
-   [ ] More sophisticated algorithm for combining requests. Some ideas
    -   Not only append or prepend requests to transactions, but also combine transactions which become neighboured later on
    -   Impose some limit to the overall number of registers. The MODBUS protocol has such a limit and devices may define even lower values
-   [ ] When a connection times out, re-connection does not work (see `connectionTimeout` in modbus-client.ts)
-   [x] When a Modbus device is not reachable, scripts using binding-modbus stop working - corresponding error handling is necessary

## More Details

See <https://github.com/eclipse/thingweb.node-wot/>
