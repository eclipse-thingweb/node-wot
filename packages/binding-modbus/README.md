# MODBUS binding for node-wot

This package implements a binding for the MODBUS/TCP protocol for node-wot.

## Protocol specifier

The protocol prefix handled by this binding is `modbus+tcp:`. This is currently a non-standard prefix.

## URL format

The URL is used to transport all addressing information necessary to describe the MODBUS registers to be accessed. It has the following structure:

```
modbus+tcp:// <host> [ : <port> ] / <unitid> / <type> / <offset> [ / <length> ]
```

with the following meaning:

* `<host>` is the host name or IP address of the MODBUS slave
* `<port>` is the optional TCP port number used to access the MODBUS slave. Default is 502
* `<unitid>` is the MODBUS unit id of the MODBUS slave
* `<type>` is the register type to access and can have any of the following values:
  * `in` denotes an input register
  * `hold` denotes a holding register
  * `coil` denotes a coil
  * `disc` denotes a discrete input    
* `<offset>` is the starting offset register number
* `<length>` is the optional number of registers to access. Default is 1

## Data encoding and decoding

The MODBUS binding uses and provides plain binary data for reading and writing. Therefore in most cases it will be associated with the content type `application/octet-stream`. Please refer to the description of this codec on how to decode and encode plain register values to/from JavaScript objects.

For register properties the payload is just the plain sequence of bytes read from or written to the registers. For coils and discrete inputs, the payload is a sequence of bytes, each corresponding to a single coil or discrete input. Each byte contains the value `0` or `1`. So the encoder / decoder should work on this series of bytes and does not have to take care about handling the individual bits. Mapping each coil or discrete input to a single property of type `boolean` works just fine!

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

This procedure guarantees that the __requests__ are all combined into a single __transaction__ *before* this __transaction__ is excecuted. A similar approach can also be used to write multiple properties in a single __transaction__.

# Open issues

* More sophisticated algorithm for combining requests. Some ideas
  * Not only append or prepend requests to transactions, but also combine transactions which become neighboured later on
  * Allow for some space between registers on read operations, as reading surplus registers might perform better than issuing two transactions
  * Impose some limit to the overall number of registers. The MODBUS protocol has such a limit and devices may define even lower values
* When a connection times out, re-connection does not work (see `connectionTimeout` in modbus-client.ts)
