# Content negotiation

How a `contentType` on an OPC UA form decides what crosses the wire and what a WoT application
receives. Background: issue #1400, core issue #1409 and PR #1572.

## What each contentType means

| contentType                                                  | what the application sees                                                                         | notes                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| omitted, i.e. `application/json`                             | the bare value: `42.5`, `"hello"`, `[1,2,3]`                                                      | the default fixed by W3C WoT TD 1.1 §5.3.4.2                   |
| `application/opcua+json;type=Value`                          | the bare value                                                                                    | same as above, stated explicitly                               |
| `application/opcua+json;type=Variant`                        | value and OPC UA type: `{"Type":11,"Body":42.5}`                                                  | lossless, see [opcua-json-encoding.md](opcua-json-encoding.md) |
| `application/opcua+json;type=DataValue` (the default `type`) | value, status code and timestamps                                                                 | lossless                                                       |
| `application/opcua+octet-stream`                             | OPC UA Binary                                                                                     | for consumers that are themselves OPC UA clients               |
| `application/octet-stream`                                   | the raw bytes of a single ByteString; base64 through `value()`, the bytes through `arrayBuffer()` | images, files. Any other OPC UA type is refused                |

Anything else is refused with an error naming the form, rather than handed to a codec that knows
nothing about OPC UA.

Every `application/opcua+json` form also takes `;version=1.04|1.05` (default `1.04`) and, for
1.05, `;mode=compact|verbose` (default `compact`). Writes accept either edition whatever the form
says. See [opcua-json-encoding.md](opcua-json-encoding.md).

## Payloads by example

The same three values, as they appear on the wire. This is also what a write must send, except for
the bare value, where the binding takes the type from the server.

**A ByteString** holding `DE AD BE EF`:

| contentType                                        | payload                                                       |
| -------------------------------------------------- | ------------------------------------------------------------- |
| `application/json`                                 | `"3q2+7w=="`                                                  |
| `application/opcua+json;type=Variant`              | `{"Type":15,"Body":"3q2+7w=="}`                               |
| `application/opcua+json;type=Variant;version=1.05` | `{"UaType":15,"Value":"3q2+7w=="}`                            |
| `application/opcua+json;type=DataValue`            | `{"Value":{"Type":15,"Body":"3q2+7w=="},"SourceTimestamp":…}` |
| `application/octet-stream`                         | the four bytes themselves; `value()` reports `"3q2+7w=="`     |

**An array of ByteStrings**, `[01 02]` and `[03]`:

| contentType                                        | payload                                                                                   |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `application/json`                                 | `["AQI=","Aw=="]` — reads fine, but writing it back stores the base64 text, not the bytes |
| `application/opcua+json;type=Variant`              | `{"Type":15,"Body":["AQI=","Aw=="]}` — round-trips                                        |
| `application/opcua+json;type=Variant;version=1.05` | `{"UaType":15,"Value":["AQI=","Aw=="]}`                                                   |
| `application/octet-stream`                         | refused: a raw octet stream cannot frame several byte strings                             |

**An ExtensionObject** (an `Argument` structure):

| contentType                                        | payload                                                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `application/json`                                 | `{"Name":"Arg1","DataType":{"Id":6},"ValueRank":-1,…}` — the fields only, with no type identity |
| `application/opcua+json;type=Variant`              | `{"Type":22,"Body":{"TypeId":{"Id":296},"Body":{"Name":"Arg1",…}}}`                             |
| `application/opcua+json;type=Variant;version=1.05` | `{"UaType":22,"Value":{"UaTypeId":"i=296","UaBody":{"Name":"Arg1",…}}}`                         |
| `application/octet-stream`                         | refused: not a ByteString                                                                       |

Note what the structure's identity costs: the bare value has no `TypeId`, so the server cannot tell
which structure it is being handed. That is why writing a structure back currently fails, and why
the envelope forms are the ones to use for structures. 1.05 states the identity as a plain NodeId
string (`"i=296"`) instead of an object.

## Where each conversion happens

The binding owns the OPC UA side of both directions. Core owns the media-type side: it decodes
what a read returned, and encodes what a write sends. Since PR #1572 a binding can register a
codec for its own URI scheme, so `application/octet-stream` on an `opc.tcp://` form no longer
reaches the codec that packs Modbus registers:

```ts
// src/factory.ts
contentSerdes.addCodec(new OpcuaByteStringCodec(), false, "opc.tcp");
```

```mermaid
flowchart TD
    A["core needs a codec for<br/>media type + form href"] --> B["scheme = ContentSerdes.schemeOf(form.href)"]
    B --> C{"codec registered for<br/>media type AND scheme?"}
    C -- yes --> D["the binding's codec<br/>e.g. OpcuaByteStringCodec for opc.tcp"]
    C -- no --> E{"codec for media type only?"}
    E -- yes --> F["the generic codec, unchanged<br/>e.g. OctetstreamCodec for modbus://"]
    E -- no --> G["unsupported media type"]
```

## Read

The server supplies the type; the TD does not have to.

```mermaid
sequenceDiagram
    autonumber
    participant App as Application
    participant CT as ConsumedThing
    participant B as binding-opcua
    participant Srv as OPC UA server
    participant IO as InteractionOutput
    participant CS as ContentSerdes
    App->>CT: readProperty("temperature")
    CT->>B: readResource(form)
    B->>Srv: Read
    Srv-->>B: DataValue { Double 42.5 }
    Note over B: resolveContentFormat(form.contentType)<br/>encodeDataValue(...)
    B-->>CT: Content("application/json", "42.5")
    CT-->>App: InteractionOutput
    App->>IO: value()
    IO->>CS: contentToValue(bytes, schema, scheme "opc.tcp")
    CS-->>IO: 42.5
    Note over IO: validated against the TD schema
    IO-->>App: 42.5
```

## Write

The binding asks the server for the node's DataType before building the Variant, so a TD that
says `"number"` still writes an Int32 to an Int32 node and an Int64 to an Int64 node.

```mermaid
sequenceDiagram
    autonumber
    participant App as Application
    participant CT as ConsumedThing
    participant CS as ContentSerdes
    participant B as binding-opcua
    participant Srv as OPC UA server
    App->>CT: writeProperty("setpoint", 42.5)
    CT->>CS: valueToContent(42.5, schema, contentType, scheme "opc.tcp")
    CS-->>CT: Content
    CT->>B: writeResource(form, content)
    B->>Srv: read the node's DataType
    Srv-->>B: Double
    Note over B: resolveContentFormat + decodeToDataValue<br/>Int64 from a string, ByteString from base64
    B->>Srv: Write
    Srv-->>B: Good
    B-->>App: done
```

## `application/octet-stream`

The one case where the bytes are the payload rather than a JSON encoding of it. Core hands the
value to the binding's own codec because the form's scheme is `opc.tcp`; before PR #1572 it reached
the codec that packs Modbus registers, which is the whole of issue #1400.

```mermaid
sequenceDiagram
    autonumber
    actor App as Application
    participant CT as ConsumedThing
    participant CS as ContentSerdes
    participant BS as OpcuaByteStringCodec
    participant B as binding-opcua
    participant Srv as OPC UA server
    participant IO as InteractionOutput
    Note over BS: the binding's own codec,<br/>registered for the opc.tcp scheme only
    Note over App,Srv: Write
    App->>CT: writeProperty("image", Buffer DE AD BE EF)
    CT->>CS: valueToContent(Buffer, "application/octet-stream",<br/>scheme "opc.tcp")
    CS->>BS: valueToBytes
    BS-->>CT: the raw bytes DE AD BE EF
    CT->>B: writeResource(form, Content)
    Note over B: the target must be a ByteString,<br/>checked against the server
    B->>Srv: Write ByteString DE AD BE EF
    Srv-->>B: Good
    B-->>App: done
    Note over App,IO: Read
    App->>CT: readProperty("image")
    CT->>B: readResource(form)
    B->>Srv: Read
    Srv-->>B: DataValue { ByteString DE AD BE EF }
    B-->>CT: Content("application/octet-stream", DE AD BE EF)
    App->>IO: value()
    IO->>CS: contentToValue(bytes, scheme "opc.tcp")
    CS->>BS: bytesToValue
    BS-->>IO: "3q2+7w=="
    IO-->>App: "3q2+7w=="
    Note over App: value() reports base64,<br/>arrayBuffer() returns the raw DE AD BE EF
```

## What each OPC UA type does

Measured by reading a value, writing the same value back and comparing what the server holds
(`test/octet-stream-shapes-test.ts`, `test/contenttype-write-test.ts`). ✔ means the server ends up
with the value it started with.

| OPC UA value                                                | `application/json` read            | write back, bare value                     | write back, `Variant` / `DataValue` | `application/octet-stream`                 |
| ----------------------------------------------------------- | ---------------------------------- | ------------------------------------------ | ----------------------------------- | ------------------------------------------ |
| Double, Int32, Float, Byte, Boolean, String, Guid, DateTime | the plain value                    | ✔                                         | ✔                                  | refused, not a ByteString                  |
| Int64, UInt64                                               | a string, as JSON cannot hold 2^53 | ✔                                         | ✔                                  | refused                                    |
| Enumeration                                                 | the number                         | ✔                                         | ✔                                  | refused                                    |
| ByteString                                                  | base64                             | ✔                                         | ✔                                  | ✔ raw bytes                               |
| arrays of the above                                         | a JSON array                       | ✔                                         | ✔                                  | refused                                    |
| ByteString[]                                                | array of base64                    | ✘ the base64 text is stored, not the bytes | ✔                                  | refused: a raw stream cannot frame several |
| LocalizedText                                               | the text only                      | ✘ the locale is lost                       | ✔                                  | refused                                    |
| NodeId, QualifiedName                                       | an object                          | ✘ not converted back                       | ✔                                  | refused                                    |
| matrices (`Double[2][3]`)                                   | an envelope with `Dimensions`      | ✘                                          | ✔                                  | refused                                    |
| ExtensionObject, arrays and matrices of them                | the structure's fields             | ✘ a plain object is not an ExtensionObject | ✘ under investigation               | refused                                    |

These tests also print the whole matrix as a table, the quickest way to see what a change does to
every type at once. It is off by default so pipelines stay readable:

```sh
cd packages/binding-opcua && npm run test:verbose
```

Two conclusions worth keeping in mind:

-   **`opcua+json;type=Variant` and `type=DataValue` are the lossless forms.** Use them when a value
    must survive a round trip exactly.
-   **The bare value is lossy by construction for some types**, and several rows above are
    shortcomings of this binding rather than of OPC UA: most of them disappear with the 1.05
    encoding, which keeps the locale of a LocalizedText and writes a NodeId as a plain string. See
    [opcua-json-encoding.md](opcua-json-encoding.md).

## Things that are not this binding's to fix

-   **A read is validated against the TD schema by core**, after decoding. A TD that declares
    `"type": "number"` and asks for `type=DataValue` gets `Invalid value according to DataSchema`,
    because a DataValue is an object. A TD with no `type` gets `No schema type defined` before
    decoding even starts. See node-wot issues #1243 and #1265.

-   **`application/octet-stream` writes were impossible before PR #1572**, because core serializes a
    value before the binding is called.

The two schema errors in the first point happen in core, after the binding has done its part:

```mermaid
sequenceDiagram
    autonumber
    actor App as Application
    participant B as binding-opcua
    participant IO as InteractionOutput
    participant OJ as OpcuaJSONCodec
    App->>B: readProperty (via ConsumedThing)
    Note over B: DataValue to reversible JSON<br/>{"Value":{"Type":11,"Body":42},"SourceTimestamp":"..."}
    B-->>App: Content("application/opcua+json")
    App->>IO: value()
    alt the TD declares no type
        IO-->>App: error "No schema type defined" (issue 1243)
    else the TD declares a type
        IO->>OJ: bytesToValue
        OJ-->>IO: object { Value, SourceTimestamp }
        alt the TD type is "object"
            IO-->>App: the DataValue object
        else the TD type is "number"
            IO-->>App: error "Invalid value according to DataSchema" (issue 1265)
        end
    end
```
