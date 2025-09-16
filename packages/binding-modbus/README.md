# Modbus Client Protocol Binding of node-wot

## Overview

W3C Web of Things (WoT) Protocol Binding for [Modbus](https://en.wikipedia.org/wiki/Modbus) TCP [RFC](https://tools.ietf.org/html/draft-dube-modbus-applproto-00).
This package uses [modbus-serial](https://www.npmjs.com/package/modbus-serial) as a low-level client for Modbus TCP.
W3C WoT Binding Template for Modbus can be found [here](https://w3c.github.io/wot-binding-templates/bindings/protocols/modbus/index.html).

Current Maintainer(s): [@relu91](https://github.com/relu91) [@fillobotto](https://github.com/fillobotto)

## Protocol specifier

The protocol prefix handled by this binding is `modbus+tcp://`.

## Getting Started

In the following examples it is shown how to use the Modbus binding of node-wot.

### Prerequisites

-   `npm install @node-wot/core`
-   `npm install @node-wot/binding-modbus`

### Client Example

You can use a code like the following to use the binding. This specific code is interacting with one of the Eclipse Thingweb Test Things at <https://github.com/eclipse-thingweb/test-things/tree/main/things/elevator>.

```js
// Protocols and Servient
Servient = require("@node-wot/core").Servient;
ModbusClientFactory = require("@node-wot/binding-modbus").ModbusClientFactory;

// create Servient and add Modbus binding
let servient = new Servient();
servient.addClientFactory(new ModbusClientFactory());

async function main() {
    let td = {}; // see https://github.com/eclipse-thingweb/test-things/blob/main/things/elevator/modbus/js/modbus-elevator.td.json

    const WoT = await servient.start();
    const thing = await WoT.consume(td);

    const readData1 = await thing.readProperty("lightSwitch"); // coil
    const readData2 = await thing.readProperty("floorNumber"); // register

    const readValue1 = await readData1.value();
    console.log(readValue1);

    const readValue2 = await readData2.value();
    console.log(readValue2);
}

main();
```

## Binding Information

### New Form Fields for the Modbus Binding

**Note**: for further details please refer to the [documentation](https://github.com/eclipse-thingweb/node-wot/blob/master/packages/binding-modbus/src/modbus.ts).

#### modv:function

Specifies which Modbus function should be issued in the requested command. The list of the available functions is the following:

| Function ID |             Label             |
| ----------- | :---------------------------: |
| 1           |           readCoil            |
| 2           |       readDiscreteInput       |
| 3           |     readHoldingRegisters      |
| 4           |      readInputRegisters       |
| 5           |        writeSingleCoil        |
| 6           |  writeSingleHoldingRegister   |
| 15          |      writeMultipleCoils       |
| 16          | writeMultipleHoldingRegisters |

This list is from [the Modbus Binding Template](https://w3c.github.io/wot-binding-templates/bindings/protocols/modbus/#function).
Function IDs are used on the wire but the labels should be used in a TD as the values of `modv:function` property.

#### modv:entity

The Modbus resource the `modv:function` acts on. It can be filled with the following keywords: `Coil`, `DiscreteInput`, `InputRegister`, `HoldingRegister`. The client will then determine the right function code to be applied in the Modbus request. Furthermore, it can be used in multi-operation forms where `modv:function` cannot be used but the correct function is filled based on [the default assumptions](https://w3c.github.io/wot-binding-templates/bindings/protocols/modbus/#default-mappings). See the [example].

**Note** that when used in conjunction with `modv:function`, the value of `modv:entity` property is ignored.

#### modv:unitID

The physical bus address of the unit targeted by the Modbus request.

#### modv:address

This property defines the starting address of registers or coils that are meant to be written.

#### modv:quantity

This property defines the total amount of registers or coils that should be written, beginning with the register specified with the property `modv:address`.

#### modv:pollingTime

The polling time used for subscriptions. The client will issue a reading command every `modv:pollingTime` milliseconds. Note that the reading request timeout can be still controlled using `modv:timeout` property.

#### modv:timeout

Timeout in milliseconds of the Modbus request. Default to 1000 milliseconds

### URL format

The URL is used to transport all addressing information necessary to describe the MODBUS connection and register addresses. It has the following structure:

```
modbus+tcp:// <host> [ : <port> ] [/ <unitid> [ / <address> ] [&quantity=<quantity> ] ]
```

with the following meaning:

-   `<host>` is the hostname or IP address of the MODBUS slave
-   `<port>` is the optional TCP port number used to access the MODBUS slave. Default is 502
-   `<unitid>` is the MODBUS unit id of the MODBUS slave; same as [modv:unitID](#modv:unitID)
-   `<address>` is the starting address register number; see [modv:address](#modv:address)
-   `<quantity>` is the optional number of registers to access. Default is 1; see [modv:quantity](#modv:quantity)

When specified URL values override the corresponding `form` parameter.

### DataSchema

The MODBUS binding uses and provides plain binary data for reading and writing. Therefore in most cases, it will be associated with the content type `application/octet-stream`. Please refer to the description of this codec on how to decode and encode plain register values to/from JavaScript objects (See `OctetstreamCodec`). **Note** `array` and `object` schema are not supported.

Along with content type `application/octet-stream`, this protocol binding accepts also an optional `byteSeq` parameter. `byteSeq` specifies the endian-ness of the raw byte data being read/written by the MODBUS binding. It follows the notation `application/octet-stream;byteSeq=value`, where its value can be one of the following:

-   `BIG_ENDIAN`, which is the default value
-   `LITTLE_ENDIAN`
-   `BIG_ENDIAN_BYTE_SWAP`
-   `LITTLE_ENDIAN_BYTE_SWAP`

**Note**: the list above may be extended in the future.

In particular, the decimal numbers `9545` and `22880` will be encoded as follows:

-   `BIG_ENDIAN`: `25 49 59 60`
-   `LITTLE_ENDIAN`: `60 59 49 25`
-   `BIG_ENDIAN_BYTE_SWAP`: `49 25 60 59`
-   `LITTLE_ENDIAN_BYTE_SWAP`: `59 60 25 49`

For register resources, the payload is just the plain sequence of bytes read from or written to the registers. For coils and discrete inputs, the payload is a sequence of bytes, each corresponding to a single coil or discrete input. Each byte contains the value `0` or `1`. So the encoder and decoder should work on this series of bytes and does not have to take care about handling the individual bits. Mapping each coil or discrete input to a single property of type `boolean` works just fine.

Another parameter that can be used in conjunction with `application/octet-stream` is `length`. This parameter specifies the length of the payload in bytes. This is useful to indicate the actual length of the payload when reading or writing a sequence of registers. For example, when reading a property using `readHoldingRegisters`, the payload length can be used to specify the number of registers to be read. Notice that the payload length must always
be equal to the number of registers multiplied by the size of the register in bytes.

### Security

The protocol does not support security.

## Implementation notes

This implementation handles multiple requests to the same slave by serializing and combining them if possible. In the following, the terms **request** and **transaction** are used as follows to describe this:

-   A **request** is a read or write request to a resource as issued by a user of the node-wot API.
-   A **transaction** is a Modbus operation and may cover the data of multiple **requests**.

### Combination

When two **requests** of the same type are issued and these requests cover neighbored registers, then they are combined into a single **transaction** reading or writing the combined register range. Note that this algorithm is currently rather simple: New **requests** are just checked if they can be prepended or appended to an existing **transaction**. If not, a new **transaction** is created. When a **transaction** completes, all **requests** contained in this **transaction** are completed.

### Serialization

Multiple **transactions** to the same slave are serialized. This means that a new MODBUS **transaction** is only started when the previous **transaction** was finished. **Transactions** are held in a queue and executed in a first-come-first-serve manner.

### Combination using the node-wot API

To help the MODBUS binding to perform combination a user of the API should create several requests for neighbor registers and resolve them all together in a single call to `Promise.all()`, e.g. as follows:

```javascript
console.info("Creating promise vl1n");
let vl1n = pac3200Thing.readProperty("Voltage/L1N");
console.info("Creating promise vl2n");
let vl2n = pac3200Thing.readProperty("Voltage/L2N");
console.info("Creating promise vl3n");
let vl3n = pac3200Thing.readProperty("Voltage/L3N");

console.info("Resolving all promises");
Promise.all([vl1n, vl2n, vl3n])
    .then((values) => values.forEach((v) => console.info("Voltage = ", await v.value())))
    .catch((reason) => console.warn("Failed ", reason));
```

This procedure guarantees that the **requests** are all combined into a single **transaction** _before_ this **transaction** is executed. A similar approach can also be used to write multiple properties in a single **transaction**.

## Valid Form Examples

### Base read function form

Reads the 8th input register of the unit 1

```json
{
    "href": "modbus+tcp://127.0.0.1:60000/1/8",
    "contentType": "application/octet-stream;length=2",
    "op": ["readproperty"],
    "modv:function": "readInputRegister",
    "modv:timeout": 2000
}
```

### Write/read function form

Read and write the 8th holding register of the unit 1

```json
{
    "href": "modbus+tcp://127.0.0.1:60000/1/8",
    "contentType": "application/octet-stream;length=2",
    "op": ["readproperty", "writeproperty"],
    "modv:entity": "HoldingRegister"
}
```

### Subscribe form

Polls the 8th holding register of the unit 1 every second.

```json
{
    "href": "modbus+tcp://127.0.0.1:60000/1/8",
    "contentType": "application/octet-stream;length=2",
    "op": ["observeproperty"],
    "modv:entity": "HoldingRegister",
    "modv:pollingTime": 1000
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

See <https://github.com/eclipse-thingweb/node-wot/>.
