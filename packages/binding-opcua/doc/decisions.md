# Decisions

Each entry: what was decided, why, and what it costs. Newest first.

## D8 — An `opc.tcp` form takes `application/opcua+uabinary` only (replaces D2, D3, D5, D6, D7)

Asked for on PR #1574 by the maintainers: a WoT implementation decodes a payload from its
contentType alone, which `application/octet-stream` is too generic to allow, so an `opc.tcp` form
takes `application/opcua+uabinary` (OPC 10000-6 Table 80), the media type planned for WoT OPC UA
Binding 1.1. `application/json`, `application/opcua+json`, `application/opcua+octet-stream` and
`application/octet-stream` are refused with an error naming their replacement.

The payload is the OPC UA Binary DataValue, as in D7. Its `type` parameter picks what `value()`
returns, as OPC UA JSON: `Value` (the default, the decoded value), `Variant` (the value and its
OPC UA type) or `DataValue` (the Variant with Status and timestamps). The views keep what the value
alone loses: the timestamps of an observed value, a Bad or Uncertain status, the type of a value
and the choice of a Union. Action arguments take the view too, without status or timestamps. The
media type belongs to OPC UA alone, so the codec is registered without a URI scheme.

Each view fixes its JSON edition, so the `version` and `mode` parameters of D6 are gone. `Value`
is 1.04 NonReversible: 1.05 has no bare value, and its envelope flattens a matrix that
NonReversible nests (Annex H.8). `Variant` and `DataValue` are 1.05 Compact. A Variant or
DataValue that is written may use either edition, as D6 allowed: the shapes are distinguishable.

Cost: TDs that use the removed contentTypes, or omit `contentType` (which TD 1.1 §5.3.4.2 makes
`application/json`), get an error until they say `application/opcua+uabinary`. `OpcuaJSONCodec`,
`OpcuaBinaryCodec` and the JSON schemas are no longer exported. 1.05 Verbose and 1.04 Reversible
are no longer produced.

## D7 — `application/octet-stream` carries OPC UA Binary (replaces D4)

Replaced by D8: the payload stays the DataValue, under `application/opcua+uabinary`.

Asked for on PR #1574: on `opc.tcp` forms, `application/octet-stream` is OPC UA Binary, as OPC
10101 §6.5.3 and OPC 10000-6 Table 80 say, and `value()` returns what `application/json` returns.
A TD written to OPC 10101 now works.

The payload is the part of the service message that carries the value: the **DataValue** for read,
observe and write, and a DataValue holding **`KeyValuePair[]`** for action arguments, so the
argument names are kept. Each choice is a question in
[octet-stream-ua-binary-plan.md](octet-stream-ua-binary-plan.md), section 2, and the implementation
is a short series of commits that can be reverted as one range.

Cost: `arrayBuffer()` is no longer a raw file for a ByteString, and a structure from a companion
specification can only be read from it with the server's DataTypeDefinition. Writing a structure
is refused until question A3 is settled.

## D6 — The JSON edition is selected by a `version` parameter

Replaced by D8: the views of `application/opcua+uabinary` fix the edition.

`application/opcua+json;type=Variant;version=1.05`, with `version` defaulting to `1.04`, and
`mode=compact|verbose` for 1.05 (default `compact`). **Decoding accepts either edition regardless
of the parameter**: the shapes are distinguishable (`Type`/`Body` against `UaType`/`Value`, NodeId
as an object against a string) and OPC 10000-6 Annex H specifies that detection. Strict on output,
liberal on input.

Rejected: a binding-wide switch (the same TD would mean different things on different servients),
new flavour names `type=Compact|Verbose` (edition and shape are independent: Compact still has to
say whether status and timestamps are included), and redefining `application/json` as 1.05 Compact
per Table 80, which would break the bare-value default that TD 1.1 §5.3.4.2 fixes.

Cost: one more parameter to document, a second set of JSON schemas, and tests for both editions.
The default stays 1.04 until maintainers agree to flip it, so no existing TD changes meaning.

## D5 — `application/octet-stream` is handled by a codec scoped to `opc.tcp`

Replaced by D8: `application/opcua+uabinary` belongs to OPC UA alone, so its codec needs no scope.

Core keeps one codec per media type for the whole servient, and `application/octet-stream` belongs
to the generic `OctetstreamCodec`, which packs Modbus registers: a ByteString came back as a
garbled string, and such a write never reached the binding. Core PR #1572 (issue #1409, on top of
Daniel Peintner's #1412) lets a binding register a codec for its own URI scheme, which this binding
does in `src/factory.ts`.

Cost: the binding depends on a core version that supports the third argument of `addCodec`.
Bindings that register nothing keep the behaviour they always had.

## D4 — `application/octet-stream` carries one ByteString, not OPC UA Binary (withdrawn)

Withdrawn by D7 at the reviewers' request: it contradicted OPC 10101 §6.5.3 and OPC 10000-6
Table 80. Kept for the record.

OPC 10000-6 Table 80 maps `application/octet-stream` to OPC UA Binary, and OPC 10101 §6.5.3
inherits that. This binding deliberately differs: OPC UA Binary cannot be decoded without the
encoding rules of the data type, so a WoT consumer that asks for "bytes" and receives an OPC UA
Binary frame has nothing it can do with it. A ByteString, on the other hand, is exactly a sequence
of bytes: an image or a file arrives usable.

Every other OPC UA type is refused with an error naming the form and the actual type, rather than
being encoded in a form the consumer cannot read. An array of ByteStrings is refused too: a raw
octet stream has no framing for several values. OPC UA Binary stays available under its own media
type.

Cost: a TD written to OPC 10101 §6.5.3 gets an error instead of a byte stream. The error says what
to use instead. Raised on #1400.

## D3 — OPC UA Binary uses `application/opcua+octet-stream`

Replaced by D8, which uses the name of Table 80, `application/opcua+uabinary`.

The name OPC 10000-6 Table 80 gives is `application/opcua+uabinary`; this binding uses
`application/opcua+octet-stream`, which predates that finding.

Since D7, `application/octet-stream` carries OPC UA Binary too. The two differ in `value()`: the
bare value for `application/octet-stream`, the whole DataValue as JSON for
`application/opcua+octet-stream`, which is kept for backward compatibility and can be deprecated.
Table 80 keeps `application/opcua+uabinary` "only for backward compatibility" and prefers
`application/octet-stream`, so it is not added.

## D2 — The default contentType stays `application/json`

Replaced by D8: `application/json` is refused, and so is a form without `contentType`, rather than
read as something else.

W3C WoT TD 1.1 §5.3.4.2 fixes the default for a form at `application/json`, and a binding may not
redefine it. OPC 10101 §6.5.3 is conditional ("_if_ the default serialization of the OPC UA server
is used"), so it names the content type to use for pass-through, rather than setting a default.

Cost: a TD that omits `contentType` receives a JSON value rather than the server's own
serialization. Anyone wanting the latter asks for it explicitly.

## D1 — The type comes from the server, never from the Thing Description

The binding reads the node's DataType before a write and takes the type from the DataValue on a
read. A TD that says `"type": "number"` therefore writes an Int32 to an Int32 node and an Int64 to
an Int64 node, and `type` on a form is never consulted.

Cost: a write needs the node's DataType, which is read once and cached per node.
