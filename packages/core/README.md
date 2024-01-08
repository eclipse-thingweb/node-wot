# Core of node-wot

The core of node-wot is the entry point allowing to attach dedicated bindings such as:

-   [HTTP](https://github.com/eclipse-thingweb/node-wot/blob/master/packages/binding-http)
-   [CoAP](https://github.com/eclipse-thingweb/node-wot/blob/master/packages/binding-coap)
-   ...

or to create user-specific bindings.

Current Maintainer(s): [@danielpeintner](https://github.com/danielpeintner) [@relu91](https://github.com/relu91) [@JKRhb](https://github.com/JKRhb)

### Prerequisites

-   `npm install @node-wot/core`

### Examples

see binding examples such as

-   https://github.com/eclipse-thingweb/node-wot/blob/master/packages/binding-http
-   https://github.com/eclipse-thingweb/node-wot/blob/master/packages/binding-coap

## Codecs

### Octet-Stream

The octet-stream codec enables deserialization and serialization of binary data. To encode and decode sequences of bytes, the octet-stream codec uses the following content type parameters:
| Parameter | Description | Default |
| --- | --- | --- |
| `length` | Number of bytes produced during serialization or consumed during deserialization | |
| `signed` | Signedness of the data type, `true` or `false` | `true` |
| `byteSeq` | Endianness, enum of `BIG_ENDIAN`, `LITTLE_ENDIAN`, `BIG_ENDIAN_BYTE_SWAP`, `LITTLE_ENDIAN_BYTE_SWAP` | `BIG_ENDIAN` |

Additionally, the octet-stream codec supports the data schema terms below for addressing bit-fields:
| Term | Description | Default |
| --- | --- | --- |
| `ex:bitLength` | Number of bits produced during serialization or consumed during deserialization | |
| `ex:bitOffset` | Offset in bits from the beginning of the byte sequence | `0` |

With the help of the terms and parameters above, the octet-stream codec can be used to serialize and deserialize objects containing bit-fields and sequences of bytes, like in the following example.

#### Example

To serialize the object `{ flag1: true, numberProperty: 99, stringProperty: "Web" }` to a sequence of bytes, the content type `application/octet-stream;length=4;signed=false;`, along with the following data schema can be used:

```json
{
    "type": "object",
    "properties": {
        "flag1": { "type": "boolean", "ex:bitOffset": 0, "ex:bitLength": 1 },
        "numberProperty": { "type": "integer", "ex:bitOffset": 1, "ex:bitLength": 7 },
        "stringProperty": { "type": "string", "ex:bitOffset": 8, "ex:bitLength": 24 }
    }
}
```

## More Details

See <https://github.com/eclipse-thingweb/node-wot/>
