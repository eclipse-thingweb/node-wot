# OPC UA JSON, and which encoding this binding emits

OPC UA defines its own JSON encodings and its own media types. This page is the short version of
what they say, and which edition each view of the binding uses.

## OPC UA assigns media types itself

OPC 10000-6 §7.4.2, Table 80 (HTTP Content-Type header):

| Content-Type                                             | body encoding                  |
| -------------------------------------------------------- | ------------------------------ |
| `application/octet-stream`, `application/opcua+uabinary` | OPC UA Binary (§5.2)           |
| `application/soap+xml`                                   | OPC UA XML (§5.3)              |
| `application/json`                                       | OPC UA JSON **Compact** (§5.4) |

`application/opcua+uabinary` is noted there as not registered with IANA and kept for backward
compatibility.

For this binding: an `opc.tcp` form takes `application/opcua+uabinary`, the Table 80 name planned
for WoT OPC UA Binding 1.1, so that the contentType alone says how to decode the payload. OPC UA JSON
is what `value()` returns, in the view the `type` parameter picks. See [decisions.md](decisions.md),
D8.

## Compact and Verbose replaced Reversible and NonReversible

OPC 10000-6 §3.1.6 and §3.1.8 define two JSON encodings, introduced in 1.05:

-   **Compact** omits optional fields and fields holding their default value.
-   **Verbose** omits nothing and adds descriptive text. Part 6 Note 1 says Verbose is for consumers
    that _"do not have access to schema information and rely on the self-describing nature"_ of the
    encoding, which describes a WoT consumer exactly.

§5.4.1: _"The CompactEncoding and VerboseEncoding replace the ReversibleEncoding and
NonReversibleEncoding."_ Annex H keeps the older pair as deprecated but normative, and notes they
are _"only used by older products implementing MQTT mapping for PubSub"_.

**The binding currently emits the deprecated pair** (`node-opcua-json/104`), pinned on purpose so
that the 2.184 upgrade changed no payload (PR #1565).

## The same values in both encodings

Measured with node-opcua 2.184.4, except the matrix row, which is node-opcua 2.187.10 (it
contains node-opcua#1835). With 2.187.10 and the session's namespace table, which the binding now
passes, 1.05 also names a namespace of index 1 or more by its URI: `"nsu=<uri>;s=Some"`.

| value         | 1.04 NonReversible                       | 1.04 Reversible (no longer emitted)                     | 1.05 Compact / Verbose                                 |
| ------------- | ---------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| Double 42.5   | `42.5`                                   | `{"Type":11,"Body":42.5}`                               | `{"UaType":11,"Value":42.5}`                           |
| Int64         | `"9007199254740993"`                     | `{"Type":8,"Body":"9007199254740993"}`                  | `{"UaType":8,"Value":"9007199254740993"}`              |
| ByteString    | `"3q2+7w=="`                             | `{"Type":15,"Body":"3q2+7w=="}`                         | `{"UaType":15,"Value":"3q2+7w=="}`                     |
| NodeId        | `{"Id":"Some","IdType":1,"Namespace":1}` | the same, wrapped                                       | `"ns=1;s=Some"` — a plain string                       |
| LocalizedText | `"Hello"`, locale lost                   | `{"Type":21,"Body":{"Text":"Hello","Locale":"en"}}`     | `{"UaType":21,"Value":{"Text":"Hello","Locale":"en"}}` |
| Double[2][3]  | `[[1,2,3],[4,5,6]]`                      | `{"Type":11,"Body":[1..6],"Dimensions":[2,3]}`          | `{"UaType":11,"Value":[1..6],"Dimensions":[2,3]}`      |
| DataValue     | —                                        | `{"Value":{"Type":11,"Body":42.5},"SourceTimestamp":…}` | flat: `{"UaType":11,"Value":42.5,"SourceTimestamp":…}` |

So 1.05 renames the fields (`UaType`/`Value`/`UaTypeId`), puts a structure's fields beside
`UaTypeId`, flattens DataValue, and
turns NodeId and QualifiedName into strings.

## What 1.05 fixes for a WoT consumer

Several limitations that look like OPC UA's are artefacts of the deprecated encoding:

| shortcoming in 1.04                                                   | in 1.05                                                                                                        |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| a LocalizedText arrives as `"Hello"`, locale lost                     | `{Locale, Text}` in both Compact and Verbose (§5.4.2.15)                                                       |
| an enumeration arrives as a bare number, the symbolic name nowhere    | Verbose encodes `"Suspended_3"` (§5.4.4); Compact keeps the number                                             |
| a NodeId is an object, so a TD cannot honestly say `"type": "string"` | a JSON string (§5.4.2.10); `"type": "string"` matches                                                          |
| a matrix arrives as nested arrays, with no type                       | still an object with dimensions: JSON Schema still cannot describe it, a deliberate trade by the working group |

Decoders can tell the two apart without being told, because the shapes differ: for LocalizedText,
NodeId, QualifiedName and matrices, Annex H gives the rule ("a JSON string is the current encoding,
a JSON object the deprecated one", and the reverse for matrices).

## The bare value has no 1.05 equivalent

The Value view (`application/opcua+uabinary`, the default) produces a bare value (`42.5`,
`"hello"`) using the NonReversible encoding, so that a matrix is nested arrays (Annex H.8). In 1.05
both Compact and Verbose carry the type, so there is no encoder that returns a bare `42.5`.

OPC 10000-14 §7.2.5.4 answers the same question for PubSub: keep the envelope where the DataType
is abstract, omit it where the metadata already pins the type. A binding can follow that rule
rather than invent one: when the node's DataType is concrete, the bare value carries no less
information than the envelope.

The Variant and DataValue views are 1.05 Compact: a NodeId arrives as a string, a LocalizedText
keeps its locale, and a structure keeps its `UaTypeId` and the choice of its Unions.

## Which edition each view uses

| contentType                                 | `value()`                       | edition            |
| ------------------------------------------- | ------------------------------- | ------------------ |
| `application/opcua+uabinary`                | the bare value                  | 1.04 NonReversible |
| `application/opcua+uabinary;type=Variant`   | value and OPC UA type           | 1.05 Compact       |
| `application/opcua+uabinary;type=DataValue` | value, type, Status, timestamps | 1.05 Compact       |

```jsonc
"forms": [
  {
    "href": "/?id=ns=1;s=Temperature",
    "contentType": "application/opcua+uabinary;type=Variant"
  }
]
```

The edition is no longer a parameter of the form (D8). **Decoding a written view accepts either
edition**: the field names identify it, which is the detection rule Part 6 Annex H defines for
exactly this purpose. Strict on what is produced, liberal in what is accepted.
