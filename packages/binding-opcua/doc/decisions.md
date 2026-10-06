# Decisions

Each entry: what was decided, why, and what it costs. Newest first.

## D6 — The JSON edition is selected by a `version` parameter

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

Core keeps one codec per media type for the whole servient, and `application/octet-stream` belongs
to the generic `OctetstreamCodec`, which packs Modbus registers: a ByteString came back as a
garbled string, and such a write never reached the binding. Core PR #1572 (issue #1409, on top of
Daniel Peintner's #1412) lets a binding register a codec for its own URI scheme, which this binding
does in `src/factory.ts`.

Cost: the binding depends on a core version that supports the third argument of `addCodec`.
Bindings that register nothing keep the behaviour they always had.

## D4 — `application/octet-stream` carries one ByteString, not OPC UA Binary

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

The name OPC 10000-6 Table 80 gives is `application/opcua+uabinary`; this binding uses
`application/opcua+octet-stream`, which predates that finding.

Open: the spec's name should be accepted, at least as an alias, and preferred in the
documentation.

## D2 — The default contentType stays `application/json`

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
