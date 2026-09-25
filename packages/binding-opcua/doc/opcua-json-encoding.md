# OPC UA JSON, and which encoding this binding emits

OPC UA defines its own JSON encodings and its own media types. This page is the short version of
what they say, what the binding currently emits, and what changes when it moves to the 1.05 forms.

## OPC UA assigns media types itself

OPC 10000-6 §7.4.2, Table 80 (HTTP Content-Type header):

| Content-Type                                             | body encoding                  |
| -------------------------------------------------------- | ------------------------------ |
| `application/octet-stream`, `application/opcua+uabinary` | OPC UA Binary (§5.2)           |
| `application/soap+xml`                                   | OPC UA XML (§5.3)              |
| `application/json`                                       | OPC UA JSON **Compact** (§5.4) |

`application/opcua+uabinary` is noted there as not registered with IANA and kept for backward
compatibility.

Two consequences for this binding:

-   Writing `application/json` on an OPC UA form is citing Part 6, not inventing a convention.
-   The binding uses `application/opcua+octet-stream` for OPC UA Binary, while Part 6's own name is
    `application/opcua+uabinary`, and it deliberately gives `application/octet-stream` a different
    meaning from Table 80. Both are recorded in [decisions.md](decisions.md).

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

Measured with node-opcua 2.184.4:

| value         | 1.04 NonReversible                             | 1.04 Reversible (what `opcua+json` emits today)         | 1.05 Compact / Verbose                                 |
| ------------- | ---------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| Double 42.5   | `42.5`                                         | `{"Type":11,"Body":42.5}`                               | `{"UaType":11,"Value":42.5}`                           |
| Int64         | `"9007199254740993"`                           | `{"Type":8,"Body":"9007199254740993"}`                  | `{"UaType":8,"Value":"9007199254740993"}`              |
| ByteString    | `"3q2+7w=="`                                   | `{"Type":15,"Body":"3q2+7w=="}`                         | `{"UaType":15,"Value":"3q2+7w=="}`                     |
| NodeId        | `{"Id":"Some","IdType":1,"Namespace":1}`       | the same, wrapped                                       | `"ns=1;s=Some"` — a plain string                       |
| LocalizedText | `"Hello"`, locale lost                         | `{"Type":21,"Body":{"Text":"Hello","Locale":"en"}}`     | `{"UaType":21,"Value":{"Text":"Hello","Locale":"en"}}` |
| Double[2][3]  | `{"Type":11,"Body":[1..6],"Dimensions":[2,3]}` | the same                                                | `{"UaType":11,"Value":[1..6],"UaDimensions":[2,3]}`    |
| DataValue     | —                                              | `{"Value":{"Type":11,"Body":42.5},"SourceTimestamp":…}` | flat: `{"UaType":11,"Value":42.5,"SourceTimestamp":…}` |

So 1.05 renames the fields (`UaType`/`Value`/`UaTypeId`/`UaDimensions`), flattens DataValue, and
turns NodeId and QualifiedName into strings.

## What 1.05 fixes for a WoT consumer

Several limitations that look like OPC UA's are artefacts of the deprecated encoding:

| shortcoming today                                                     | in 1.05                                                                                                        |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| a LocalizedText arrives as `"Hello"`, locale lost                     | `{Locale, Text}` in both Compact and Verbose (§5.4.2.15)                                                       |
| an enumeration arrives as a bare number, the symbolic name nowhere    | Verbose encodes `"Suspended_3"` (§5.4.4); Compact keeps the number                                             |
| a NodeId is an object, so a TD cannot honestly say `"type": "string"` | a JSON string (§5.4.2.10); `"type": "string"` matches                                                          |
| a matrix arrives as a flat array plus `Dimensions`                    | still an object with dimensions: JSON Schema still cannot describe it, a deliberate trade by the working group |

Decoders can tell the two apart without being told, because the shapes differ: for LocalizedText,
NodeId, QualifiedName and matrices, Annex H gives the rule ("a JSON string is the current encoding,
a JSON object the deprecated one", and the reverse for matrices).

## The bare value has no 1.05 equivalent

`application/json` currently produces a bare value (`42.5`, `"hello"`) using the NonReversible
encoding. In 1.05 both Compact and Verbose carry the type, so there is no encoder that returns a
bare `42.5`.

OPC 10000-14 §7.2.5.4 answers the same question for PubSub: keep the envelope where the DataType
is abstract, omit it where the metadata already pins the type. A binding can follow that rule
rather than invent one: when the node's DataType is concrete, the bare value carries no less
information than the envelope.

This is why moving to 1.05 is not a one-line change of import, and why it is proposed as its own
step with its own decisions: how the edition is selected, what `application/json` then returns,
and what happens to Thing Descriptions written against the current output.
