# M-Bus Client Protocol Binding of node-wot

## Overview

W3C Web of Things (WoT) Protocol Binding for [Meter Bus](https://en.wikipedia.org/wiki/Meter-Bus) TCP.
This package uses [node-mbus](https://www.npmjs.com/package/node-mbus) as a low level client for M-Bus TCP.
This implementation only supports reading data (for WoT Consumer applications).

Current Maintainer(s): [@LennyHEVS](https://github.com/LennyHEVS)

## Protocol specifier

The protocol prefix handled by this binding is `mbus+tcp:`. This is currently a non-standard prefix.

## Disclaimer

This binding is currently experimental. Some errors might occur with the use of this binding.
The code was tested in a specific situation which might not correspond to your own using.

## New Form Fields for the M-Bus Binding

**Note**: for further details please refer to the [documentation](https://github.com/eclipse-thingweb/node-wot/blob/master/packages/binding-mbus/src/mbus.ts).

### mbus:unitID

The physical bus address of the unit targeted by the mbus request.

### mbus:offset

This property defines the id of the data that are meant to be read. Specifying an id of -1 will return informations about the targeted M-Bus client.

### mbus:timeout

Timeout in milliseconds of the mbus request. Default to 1000 milliseconds

## URL format

The URL is used to transport all addressing information necessary to describe the M-Bus connection and data addresses. It has the following structure:

```
mbus+tcp:// <host> [ : <port> ] [/ <unitid> [ ?offset=<offset> [&timeout=<timeout> ] ] ]
```

with the following meaning:

-   `<host>` is the host name or IP address of the M-Bus slave
-   `<port>` is the optional TCP port number used to access the M-Bus slave. Default is 805
-   `<unitid>` is the M-Bus unit id of the M-Bus slave; same as [mbus:unitID](#mbus:unitID)
-   `<offset>` is the id of the data; see [mbus:offset](#mbus:offset)
-   `<timeout>` is the optional timeout in milliseconds of the request. Default is 1000; see [mbus:timeout](#mbus:timeout)

When specified URL values override the corresponding `form` parameter.

## DataSchema

The M-Bus binding uses and provides JSON formed data for read-only. Therefore in most cases it will be associated with the content type `application/json`. Please refer to the description of this codec on how to decode and encode plain data to/from JavaScript objects (See `JsonCodec`).

The data in the payload is contained in the key `Value`. Its type can be any type supported in a JSON value and specified by the M-Bus Thing manufacturer. A verbose description of the data is contained in the key `Unit`.

Here's an example of a payload from a request on `offset=0` :

```json
{
    "id": 0,
    "Function": "Instantaneous value",
    "StorageNumber": 0,
    "Unit": "Fabrication number",
    "Value": 11490378,
    "Timestamp": "2018-02-24T22:17:01"
}
```

## Security

The protocol does not support security.

## Implementation notes

This implementation handles multiple requests to the same slave by combining them if possible. In the following, the terms **request** and **transaction** are used as follows to describe this:

-   A **request** is a read request to a resource as issued by a user of the node-wot API.
-   A **transaction** is a M-Bus operation and may cover the data of multiple **requests**.

## Combination

When two **requests** are made on the same unitID, then they are combined into a single **transaction**. Note that this algorithm is currently rather simple: New **requests** are just checked if they can be combined to an existing **transaction**. If not, a new **transcation** is created. When a **transcation** completes, all **requests** contained in this **transaction** are completed.

## Serialization

Multiple **transactions** to the same slave are serialized. This means that a new M-Bus **transaction** is only started when the previous **transaction** was finished. **Transactions** are held in a queue and executed in a first-come-first-serve manner.

## Valid Form Examples

### Base read function form

Reads the data with the id of 1 of the unit 2

```json
{
    "href": "mbus+tcp://127.0.0.1:8182",
    "contentType": "application/json",
    "op": ["readproperty"],
    "mbus:unitID": 2,
    "mbus:offset": 1,
    "mbus:timeout": 2000
}
```

## TODOs

-   [ ] TEST
-   [ ] (M-Bus Server Protocol Binding)

## More Details

See <https://github.com/eclipse-thingweb/node-wot/>
