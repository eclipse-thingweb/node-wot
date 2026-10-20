# `application/octet-stream` as OPC UA Binary: plan

Status: proposal, being implemented on this PR. Follows the request in
[#1574 (comment)](https://github.com/eclipse-thingweb/node-wot/pull/1574#issuecomment-6191632180).
The binding uses node-opcua 2.187.10, which contains node-opcua#1835 (appendix A).

## 1. The request

The principle, from the review: a form's `contentType` says what is exchanged over the protocol,
not what a library produces after decoding. On `opc.tcp` that is always OPC UA Binary.

-   Keep `application/json`, `application/opcua+json` and `application/opcua+octet-stream` as they are,
    for backward compatibility only. They are not what is on the wire.
-   Change `application/octet-stream` on `opc.tcp` forms:
    -   the payload is the value in **OPC UA Binary** (OPC 10000-6 §5.2);
    -   `value()` returns **the same result as `application/json`**.
-   Goal: a TD written to OPC 10101 works. OPC 10101 §6.5.3 says: _"If the default serialization of
    the OPC UA server is used, the contentType should be assigned with the value
    `application/octet-stream`"_, and its §7.1.3 example uses it on an action form.
-   `octet-stream` no longer carries the raw bytes of a ByteString (decision D4 is withdrawn).

In short: `octet-stream` changes the bytes (`arrayBuffer()`), never the value (`value()`).

**What the request leaves open.** On `opc.tcp`, the wire carries whole service messages (a
`ReadResponse`, a `PublishResponse`, …), not a bare value. The payload of a form must be one part of
them, and neither OPC 10101 nor OPC 10000-6 says which part. The proposal is the **DataValue** for
properties and the **arguments** for actions (section 6). This is the main thing to confirm.

**On `application/opcua+uabinary`.** It is not new. OPC 10000-6 1.05,
[Table 80](https://reference.opcfoundation.org/Core/Part6/v105/docs/7.4.2), gives it the same
meaning as `application/octet-stream`, and says it _"is only specified for backward
compatibility"_ because it is not registered with IANA. Table 80 is about the HTTPS mapping, and
it prefers well-known media types. So `application/octet-stream` is the media type OPC 10000-6
prefers, not only the one OPC 10101 uses. This plan does not add `opcua+uabinary`.

## 2. Questions

Each question has a proposal, so the work can start now and change later. Details in section 6.

| Id  | Operation         | Question                               | Proposal                                       |
| --- | ----------------- | -------------------------------------- | ---------------------------------------------- |
| R1  | `readproperty`    | Is the payload the DataValue?          | yes, with the fields the server sent           |
| O1  | `observeproperty` | The same payload as R1?                | yes, one DataValue per notification            |
| W1  | `writeproperty`   | A DataValue with optional fields?      | yes; a bare value gives a value-only DataValue |
| W2  | `writeproperty`   | Write a structure with `octet-stream`? | yes, by value as JSON (A3); refused until then |
| A1  | `invokeaction`    | How are the arguments encoded?         | `KeyValuePair[]` (not what is on the wire)     |
| A2  | `invokeaction`    | StatusCode of the call in the output?  | no                                             |
| A3  | write and input   | How does a consumer pass a structure?  | OPC UA JSON 1.05, `nsu=`; the binding encodes  |

## 3. What each contentType means today

The JSON forms below stay only for backward compatibility. For reference, they are the **OPC UA JSON
encoding** of OPC 10000-6, which has two editions:

-   **1.04**: `Reversible` and `NonReversible`. Deprecated since 1.05, kept in Annex H.
-   **1.05**: `Compact` and `Verbose`. They replace 1.04 (§5.4).

| contentType on the form                                | Encoding                                           | Content                             |
| ------------------------------------------------------ | -------------------------------------------------- | ----------------------------------- |
| omitted, or `application/json`                         | 1.04 **NonReversible**                             | the bare value                      |
| `application/json;version=1.05`                        | 1.05 **Compact**, the `Value` field of the Variant | the bare value                      |
| `application/opcua+json;type=Variant`                  | 1.04 **Reversible**                                | value + OPC UA type                 |
| `…;type=Variant;version=1.05`                          | 1.05 **Compact** (or `;mode=verbose`)              | value + OPC UA type                 |
| `application/opcua+json` (`type=DataValue` by default) | 1.04 Reversible, or 1.05 with `;version=1.05`      | value, type, StatusCode, timestamps |
| `application/opcua+octet-stream`                       | OPC UA **Binary**, a DataValue                     | value, type, StatusCode, timestamps |
| `application/octet-stream`                             | the raw bytes of a ByteString, else refused        | -                                   |

A form without `contentType` means `application/json`: that default comes from W3C WoT TD 1.1
§5.3.4.2, not from the binding. Changing it for `opc.tcp` forms is out of scope here.

## 4. Examples: what is produced today, and what `octet-stream` would carry

Produced by the binding's own `encodeDataValue()` on this PR, for a value read with a
SourceTimestamp. The JSON lines are those of node-opcua 2.187.10, which contains
[node-opcua/node-opcua#1835](https://github.com/node-opcua/node-opcua/pull/1835) and aligns the JSON
encodings on Part 6 1.04 and 1.05; examples c and d say what node-opcua 2.184 gave instead. The last
line of each example is the **proposed** `application/octet-stream` payload: the UA Binary encoding
of the **DataValue** (section 6).

A DataValue starts with an encoding mask that says which fields follow: `0x01` Value, `0x02`
StatusCode, `0x04` SourceTimestamp, `0x08` ServerTimestamp, `0x10` and `0x20` the picoseconds. In
the examples the mask is `05`: Value and SourceTimestamp. The last 8 bytes are the SourceTimestamp.

### a. Scalar: a Double

```text
application/json                                  299.26
application/json;version=1.05                     299.26
application/opcua+json;type=Variant               {"Type":11,"Body":299.26}
application/opcua+json;type=Variant;version=1.05  {"UaType":11,"Value":299.26}
application/octet-stream (proposed), 18 bytes     05 0b 5c 8f c2 f5 28 b4 72 40 00 50 62 9a b0 5f dd 01
```

`05`: the mask. `0b`: a Variant of type 11 (Double), then the 8 bytes of the IEEE double, then the
SourceTimestamp.

### b. Array: Int32[3]

```text
application/json                                  [1,2,3]
application/json;version=1.05                     [1,2,3]
application/opcua+json;type=Variant               {"Type":6,"Body":[1,2,3]}
application/opcua+json;type=Variant;version=1.05  {"UaType":6,"Value":[1,2,3]}
application/octet-stream (proposed), 26 bytes     05 86 03 00 00 00 01 00 00 00 02 00 00 00 03 00 00 00 (timestamp)
```

`86`: type 6 (Int32) with the array bit (0x80), then the length 3, then three Int32.

### c. Matrix: Double[2][3]

```text
application/json                                  [[1,2,3],[4,5,6]]
application/json;version=1.05                     [1,2,3,4,5,6]
application/opcua+json;type=Variant               {"Type":11,"Body":[1,2,3,4,5,6],"Dimensions":[2,3]}
application/opcua+json;type=Variant;version=1.05  {"UaType":11,"Value":[1,2,3,4,5,6],"Dimensions":[2,3]}
application/octet-stream (proposed), 74 bytes     05 cb 06 00 00 00 (6 Doubles) 02 00 00 00 02 00 00 00 03 00 00 00 (timestamp)
```

`cb`: type 11 with the array bit and the dimensions bit (0x40), then 6 values, then the dimensions
`[2, 3]`.

`application/json` gives nested arrays, the outer array being the first dimension (OPC 10000-6
Annex H.8 and H.9), so a TD can describe the matrix as an array of arrays. `value()` with
`octet-stream` gives the same. With node-opcua 2.184, this line is the Reversible envelope
`{"Type":11,"Body":[…],"Dimensions":[2,3]}`, and the 1.05 line names the field `UaDimensions`
instead of `Dimensions` (Table 41).

`application/json;version=1.05` still loses the dimensions. That is the binding's doing, not
node-opcua's (appendix A).

### d. Structure: `RfidScanResult` (OPC UA for AutoID, namespace 2 on this server)

`RfidScanResult` (`i=3007`) is a concrete subtype of the abstract `ScanResult` (`i=3001`). It has
an optional field, `Location`, absent here. Its `ScanData` field is a union, here its third field,
`Epc`.

```text
application/json
{"CodeType":"EPC",
 "ScanData":{"PC":12288,"UId":"MAX7Y6wfNoHsiARo","XPC_W1":0,"XPC_W2":0},
 "Timestamp":"2026-10-19T10:00:00.000Z",
 "Sighting":[{"Antenna":1,"Strength":-48,"Timestamp":"2026-10-19T10:00:00.000Z","CurrentPowerLevel":30}]}

application/json;version=1.05
{"UaTypeId":"nsu=http://opcfoundation.org/UA/AutoID/;i=3007",
 "CodeType":"EPC",
 "ScanData":{"SwitchField":3,"Epc":{"PC":12288,"UId":"MAX7Y6wfNoHsiARo","XPC_W1":0,"XPC_W2":0}},
 "Timestamp":"2026-10-19T10:00:00.000Z",
 "Sighting":[ …as above… ]}

application/opcua+json;type=Variant
{"Type":22,"Body":{"TypeId":{"Id":3007,"Namespace":2},
                   "Body":{"CodeType":"EPC","ScanData":{"SwitchField":3,"Value":{ … }}, …}}}

application/opcua+json;type=Variant;version=1.05
{"UaType":22,"Value":{"UaTypeId":"nsu=http://opcfoundation.org/UA/AutoID/;i=3007","CodeType":"EPC", …}}

application/octet-stream (proposed), 88 bytes
05 16 01 02 93 13 01 45 00 00 00 00 00 00 00 03 00 00 00 45 50 43 03 00 00 00 …
```

The editions differ on the union (OPC 10000-6 1.05 §5.4.8, Annex H.10):

-   `application/json` (1.04 NonReversible) gives the selected value alone. It does not say which
    field was selected.
-   1.05 Compact gives `{"SwitchField":3,"Epc":{…}}`, 1.05 Verbose `{"Epc":{…}}`, and 1.04 Reversible
    `{"SwitchField":3,"Value":{…}}`.

A 1.05 Structure is its fields with `UaTypeId` among them (§5.4.2.16): `UaBody` only carries a UA
Binary or UA XML body. The 1.04 Reversible and 1.05 Compact forms also carry an `EncodingMask` when
an optional field is present.

With node-opcua 2.184, every edition writes the union as `{"SwitchField":3,"Value":{…}}`, the 1.05
forms wrap the fields in `"UaBody":{…}`, and they write `ns=2`.

Reading the binary:

| Bytes         | Meaning                                                                               |
| ------------- | ------------------------------------------------------------------------------------- |
| `05`          | DataValue mask: Value and SourceTimestamp                                             |
| `16`          | Variant of type 22, ExtensionObject                                                   |
| `01 02 93 13` | NodeId ns=2, i=5011: the **binary encoding** node, not the DataType (i=3007)          |
| `01`          | the body is binary                                                                    |
| `45 00 00 00` | body length: 69 bytes                                                                 |
| `00 00 00 00` | the EncodingMask of the optional fields: none present (`Location` absent)             |
| then          | the fields in order, without names: `CodeType` = "EPC", `ScanData` (SwitchField 3), … |

What this shows:

-   In JSON, the field names are there. In binary, the consumer needs the `RfidScanResult`
    DataTypeDefinition to read the 69 bytes, and only the server provides it (section 7).
-   In binary, `ns=2` is an index into **this** server's namespace table: UA Binary has no other
    form. On another server, AutoID can have another index.
-   The 1.05 JSON forms name the namespace by its URI (`nsu=`), so they do not depend on the
    server. This needs node-opcua#1835 **and** a binding that passes the session's namespace table
    to the encoder. Today the binding passes an empty table, and the 1.05 forms write `ns=2`
    (appendix A). The 1.04 Reversible form keeps the index.

## 5. What changes with the proposal

|                 | `application/octet-stream` today          | proposed                                          |
| --------------- | ----------------------------------------- | ------------------------------------------------- |
| `value()`       | refused, unless the value is a ByteString | the same as `application/json` (sections 3 and 4) |
| `arrayBuffer()` | the raw bytes of a ByteString             | the UA Binary **DataValue** (section 4)           |

Example: the TD from #1400 (a Double).

```json
"pumpSpeed": {
    "type": "number",
    "forms": [{
        "href": "opc.tcp://opcuademo.sterfive.com:26543?id=ns=1;s=PumpSpeed",
        "contentType": "application/octet-stream",
        "op": ["readproperty", "observeproperty"]
    }]
}
```

-   today: `value()` fails with "only supported when the value is a ByteString";
-   proposed: `value()` gives `299.26`, and `arrayBuffer()` gives
    `05 0b 5c 8f c2 f5 28 b4 72 40 (SourceTimestamp)`.

Because `value()` is the same as `application/json`, it also has the same limits. Appendix A lists
the ones left once node-opcua#1835 is in.

## 6. Per WoT operation: proposal and open questions

**Proposal for properties: the DataValue**, for read, observe and write. It is what the Read,
Publish and Write services carry, and it is the part of the message with the most information
(value, type, StatusCode, timestamps). Every field except the value is optional: the encoding mask
says which ones are present.

### 6.1 `readproperty`, OPC UA service Read

-   On the wire: `ReadResponse` → `results[]`, one **DataValue** per node.
-   Proposal: the payload is that **DataValue**, with the fields the server sent.
-   `value()` takes the value from it and returns what `application/json` returns. StatusCode and
    timestamps are only in `arrayBuffer()`.
-   **Question R1 — is the DataValue the payload?**
    -   Why open: OPC 10101 does not say which part of the `ReadResponse` the payload is. The other
        candidate is the Variant alone, which drops StatusCode and timestamps.

### 6.2 `observeproperty`, OPC UA services CreateMonitoredItems and Publish

-   On the wire: `PublishResponse` → `NotificationMessage` → `DataChangeNotification` →
    `MonitoredItemNotification`, holding one **DataValue** per change.
-   Proposal: the same as `readproperty`, one DataValue per notification. The timestamps tell when
    the value changed, which matters most here.
-   **Question O1 — the same payload as R1?** Proposal: yes, so that one form gives the same payload
    for read and observe.

### 6.3 `writeproperty`, OPC UA service Write

-   On the wire: `WriteRequest` → `WriteValue { nodeId, attributeId, indexRange, value: DataValue }`.
    The response carries a StatusCode only.
-   Proposal: the payload is a **DataValue whose fields are optional**. The binding writes the
    fields that are present, and nothing else.
    -   `writeProperty("speed", 42)`: the codec builds a DataValue with the value only (mask `01`):
        `01 0b 00 00 00 00 00 00 45 40` for a Double 42, 10 bytes. This works on every server.
    -   A consumer that sends its own DataValue bytes with a StatusCode or timestamps gets them
        written. A server that does not support it answers `Bad_WriteNotSupported` (OPC 10000-4,
        Write service), and the binding reports that error.
-   The codec sees only the JavaScript value and the TD schema, not the node's DataType. So it may
    encode `42` as a Double for an Int32 node. The binding then converts the value to the node's
    DataType before the Write, as it already does for `application/json`: the node receives Int32
    `42`.
-   **Question W1 — DataValue with optional fields?**
    -   Why open: OPC UA writes a DataValue, but the request only speaks of `value()`, which is
        about reading. Proposal: yes, so that a read can be written back as it is.
-   **Question W2 — can a structure be written with `octet-stream`?**
    -   Why open: to encode `RfidScanResult` in binary, the encoder needs the DataTypeDefinition (field
        order, field types) and this server's namespace index. The codec has neither; the binding has
        both through its session. Today the `application/json` path cannot write a structure from a
        companion specification either.
    -   Proposal: yes, by value, in the OPC UA JSON 1.05 form, and the binding encodes it (A3,
        section 6.7). Not in this PR: until the follow-up, a structure write is refused with a clear
        message.

#### Who encodes what on a write

A consumer can call `writeProperty` in two ways, and core treats them differently
(`ContentSerdes.valueToContent`):

-   **with a value**, `writeProperty("x", 21.5)`: core calls the `octet-stream` codec, which turns
    the value into bytes. The codec receives the value, the TD schema and the contentType parameters.
    It does **not** receive the form's `href`, so it does not know the server or the node, and it is
    synchronous, so it cannot ask the server anything. A value of built-in types (number, string,
    boolean, Buffer, arrays of them) becomes a UA Binary DataValue. A plain object cannot (section
    6.7): the codec hands it over as JSON.
-   **with bytes**, `writeProperty("x", readableStream)`: core passes the bytes to the binding as
    they are. The codec is not called.

The binding then receives the bytes. If they start with `{`, they are JSON (section 6.7); otherwise
they are a UA Binary DataValue, which it decodes. It reads the node's DataType (one Read, as it
already does today for `application/json`) and sends the Write.

#### Example 1: a temperature setpoint, a Float node

```json
"temperatureSetpoint": {
    "type": "number",
    "unit": "°C",
    "forms": [{
        "href": "opc.tcp://localhost:4840?id=ns=1;s=TemperatureSetpoint",
        "contentType": "application/octet-stream",
        "op": ["readproperty", "writeproperty"]
    }]
}
```

With a value (the usual case):

```js
await thing.writeProperty("temperatureSetpoint", 21.5);
```

1. The codec does not know the node is a Float. A JavaScript number becomes a Double: the payload
   is `01 0b 00 00 00 00 00 80 35 40` (mask `01`: value only; `0b`: Double; then 21.5).
2. The binding decodes it, reads the node's DataType (Float) and converts 21.5 to a Float.
3. The Write carries `WriteValue { nodeId, attributeId: Value, value }` with the DataValue
   `01 0a 00 00 ac 41` (`0a`: Float).
4. `Good`: `writeProperty` resolves. A bad StatusCode (for example `Bad_OutOfRange`,
   `Bad_TypeMismatch`, `Bad_UserAccessDenied`) makes it reject, with that StatusCode in the error.

So the payload (step 1) and what is on the wire (step 3) differ by the type. Refusing a Double
for a Float node instead would make `writeProperty(21.5)` fail on every Float node, so the binding
converts, as it does for `application/json`.

With bytes (a consumer that knows OPC UA):

```js
// Node's built-in ReadableStream is not recognised: core tests `instanceof` against this polyfill.
const { ReadableStream } = require("web-streams-polyfill");

const bytes = new Uint8Array([0x01, 0x0a, 0x00, 0x00, 0xac, 0x41]); // DataValue: Float 21.5
await thing.writeProperty(
    "temperatureSetpoint",
    new ReadableStream({
        start: (c) => {
            c.enqueue(bytes);
            c.close();
        },
    })
);
```

The type already matches, so these bytes are what goes on the wire. The consumer can also set a
SourceTimestamp (mask `05`); a server that refuses it answers `Bad_WriteNotSupported` (W1).

#### Example 2: an `RfidScanResult` (a structure of namespace 2)

In AutoID, an `RfidScanResult` is usually read-only (the result of a scan). It is used here as the
example of a structure from a companion specification.

The value is the 1.05 Compact form of the structure (section 6.7). The union says which field it
holds:

```js
await thing.writeProperty("lastScanResult", {
    CodeType: "EPC",
    ScanData: { SwitchField: 3, Epc: { PC: 12288, UId: "MAX7Y6wfNoHsiARo", XPC_W1: 0, XPC_W2: 0 } },
    Timestamp: "2026-10-19T10:00:00.000Z",
    Sighting: [{ Antenna: 1, Strength: -48, Timestamp: "2026-10-19T10:00:00.000Z", CurrentPowerLevel: 30 }],
});
```

The codec cannot encode this: it needs the DataTypeDefinition and this server's index for the
binary-encoding NodeId (`ns=2;i=5011`), and only the server has them. So the binding encodes it
(section 6.7):

1. The codec hands the object over as JSON: `{"CodeType":"EPC",…}`.
2. The binding reads the node's DataType: `RfidScanResult`, a concrete type, so `UaTypeId` is not
   needed.
3. It builds the ExtensionObject with the session's DataTypeDefinition and sends it in the Write: the
   bytes of section 4.d with the value-only mask `01`, 80 bytes.

Step 3 is not in this PR: until the follow-up, the binding refuses the write with a clear message.

The value read with `application/json` cannot be written back as it is: its `ScanData` is the
selected value alone, without `SwitchField`, so the binding cannot tell which field of the union it
is.

If the node's DataType were abstract (a variable typed `ScanResult`, for example), the consumer
names the subtype, by its namespace URI, with `UaTypeId` among the fields:

```js
await thing.writeProperty("lastScanResult", {
    UaTypeId: "nsu=http://opcfoundation.org/UA/AutoID/;i=3007",
    CodeType: "EPC",
    // …the other fields, as above
});
```

A consumer that sends its own UA Binary bytes for a structure still needs the DataTypeDefinition and
the server's index (section 7). The plan does not change that.

### 6.4 `invokeaction`, OPC UA service Call

-   On the wire: `CallMethodRequest { objectId, methodId, inputArguments: Variant[] }` →
    `CallMethodResult { statusCode, inputArgumentResults[], outputArguments: Variant[] }`. The
    arguments are Variants, not DataValues: there are no timestamps here.
-   In WoT, the action input is **one** value: an object whose keys are the argument names. In OPC UA,
    the arguments are an **array of Variants without names**, matched by position.
-   Today an action with `octet-stream` fails on its output with "Unsupported content type".
-   Proposal, input given by value: the input is a plain object, so the codec hands it over as JSON
    (section 6.7). The binding already handles that today: it takes each argument by name, in the
    method's order (`session.getArgumentDefinition`), and converts it to the argument's DataType. A
    structure argument (for example `Settings`, a `ScanSettings`, of the AutoID `Scan` method)
    follows A3.
-   Proposal, input given as bytes, and output: a DataValue (value only) holding an array of
    **`KeyValuePair`** (a standard structure of namespace 0: a name and a Variant). Every
    `octet-stream` payload is then a DataValue, whatever the operation. The output Content is
    tagged like a read (section 8), so that `value()` can decode a structure output, such as the
    `Results` of `Scan`.

    ```text
    input as bytes  KeyValuePair[ { Key: "CalibrationFactor", Value: Int32 3 } ]
    input by value  { "CalibrationFactor": 3 }, handed over as JSON
    output          KeyValuePair[ { Key: "CalibrationStatus", Value: Int32 0 } ]  →  value() { "CalibrationStatus": 0 }
    ```

    This is **not** what is on the wire: the Call service carries a `Variant[]`, without names. The
    binding converts between the two. It goes against the principle of section 1, which is why A1
    is a question.

-   **Question A1 — how are the arguments encoded?**

    -   Why open: OPC 10101 §7.1.3 uses `octet-stream` on an action but does not say what the bytes are.
        `Variant[]` is what is on the wire, but it needs the order of the arguments, and a JSON
        schema does not guarantee the order of its properties.

    | Option                            | On the wire | Names kept | Needs the server       | Defined by a spec                     |
    | --------------------------------- | ----------- | ---------- | ---------------------- | ------------------------------------- |
    | **`KeyValuePair[]`** (proposed)   | no          | yes        | no                     | the type yes, this use no             |
    | `Variant[]` in the method's order | yes         | no         | yes, to know the order | the Call service, not the WoT mapping |
    | refuse `octet-stream` on actions  | -           | -          | -                      | -                                     |

-   **Question A2 — should the StatusCode of the call be in the output?** Proposal: no. A bad
    StatusCode already makes `invokeAction()` fail, as it does today.

### 6.5 `subscribeevent`

Not implemented by this binding (OPC UA events are not mapped yet). Out of scope.

### 6.6 For every operation: a ByteString

The comment asks not to use `octet-stream` for raw ByteString content (D4), so a ByteString is
encoded like every other type: a type byte and a length, then the bytes, inside the DataValue:
`05 0f 04 00 00 00 de ad be ef (timestamp)`. `value()` is unchanged (`"3q2+7w=="`, base64, as with
JSON).

The consequence: a consumer that saves `arrayBuffer()` as a file gets extra bytes before and after,
and no contentType is left for "give me the file". A media type for files (`image/png`,
`application/pdf`, …) can come later, in its own PR.

### 6.7 For every write and action input: a structure

The codec cannot produce the UA Binary of a structure:

-   It needs the DataTypeDefinition (field order, field types) and this server's namespace index for
    the binary-encoding NodeId. Both are on the server, and the codec runs in core, synchronously,
    without knowing which server the form points to.
-   A plain object does not say which structure type it is: `{ "Low": 0, "High": 100 }` could be a
    `Range` or any other type with these fields. This holds for namespace 0 too.

**Proposal: the consumer gives a structure in the OPC UA JSON 1.05 form (OPC 10000-6 §5.4.2.16),
and the binding, which has the session, encodes it to UA Binary.**

-   The fields, `{"CodeType":"EPC",…}`, when the target DataType is concrete. The binding knows that
    type: the node's DataType for a write, the argument's DataType for an action.
-   The fields with `UaTypeId` among them, `{"UaTypeId":"nsu=<uri>;i=<id>","CodeType":"EPC",…}`,
    when the target DataType is abstract and the consumer must name the subtype. `nsu=` names the
    namespace by its URI, so the value does not depend on the server's namespace table. OPC
    10000-14 §7.2.5.4 gives the same rule for PubSub: name the type only where the DataType is
    abstract.
-   A union says which field it holds: `{"SwitchField":3,"Epc":{…}}` (Compact) or `{"Epc":{…}}`
    (Verbose), §5.4.8. An optional field is present when its name is; the `EncodingMask` of the
    Compact form is accepted but not required.

A value read with `application/json;version=1.05` is already in this form, `UaTypeId` included,
and can be written back as it is. A value read with `application/json` (1.04 NonReversible) cannot
always: that encoding drops the selected field of a union and the locale of a LocalizedText.

**The hand-off.** Whenever the value holds a plain object (a structure, or an action input), the
codec writes it as JSON instead of UA Binary. The binding tells the two apart by the first byte: `{`
(0x7B) sets bit 0x40, which no DataValue encoding mask uses, so a UA Binary DataValue never starts
with it. The codec does not need to know the operation. What goes on the wire stays UA Binary; only
the hand-off from core to the binding, inside the process, is JSON.

**What it needs:**

1. A binding function that decodes this JSON into an ExtensionObject, with node-opcua-json and the
   session's DataTypeDefinitions. The same function fixes `application/json` structure writes,
   which fail today.
2. node-opcua#1835, released in 2.187.10: its decoder reads the 1.05 union and
   optional-field forms and maps `nsu=`. For `UaTypeId`, the binding must also pass the session's
   namespace table to the decoder (appendix A).

-   **Question A3 — how does a consumer pass a structure, in a write or an action input?**

    -   Why open: OPC 10101 does not say, and UA Binary cannot be produced without the server.
    -   Proposal: the OPC UA JSON 1.05 form above. In this PR, the codec hands the JSON over and the
        binding refuses a structure with a clear message. The encoding comes in a follow-up PR,
        with a node-opcua release that contains #1835.

    | Option                                                     | Change in core | Hand-off in UA Binary | Shape defined by a spec    |
    | ---------------------------------------------------------- | -------------- | --------------------- | -------------------------- |
    | **OPC UA JSON 1.05, encoded by the binding** (proposed)    | no             | no, JSON              | yes, OPC 10000-6 §5.4.2.16 |
    | nested `KeyValuePair[]` (field name → Variant)             | no             | yes                   | no, a convention, as A1    |
    | core gives the form to the codec, definitions loaded first | yes            | yes                   | yes, UA Binary             |

## 7. Caveat: `arrayBuffer()` and structures from companion specifications

`value()` works for every structure: the binding decodes it with the DataTypeDefinition it fetched
through its OPC UA session (section 8). **`arrayBuffer()` is different: for a structure from a
companion specification (namespace ≠ 0), the bytes will probably be useless to a consumer as they
are.** This is a known limitation of `octet-stream`, not something this PR can fix:

-   The body of the ExtensionObject is the fields in order, **without names and without types**
    (section 4.d). Reading it needs the DataTypeDefinition of `RfidScanResult`.
-   That definition is on the OPC UA server. WoT gives the consumer **no access to it**: the TD does
    not carry it, and the binding's DataTypeDefinition manager is internal to the binding.
-   The header names the type by a **namespace index** (`ns=2`) that is only valid on that server.
-   The same holds the other way: a consumer cannot build these bytes to write such a structure. It
    can write it by value, as JSON (section 6.7).

So, for a structure:

| What the consumer uses   | Works?                                                                 |
| ------------------------ | ---------------------------------------------------------------------- |
| `value()`                | yes, the same JSON as `application/json`                               |
| `arrayBuffer()`          | only for a consumer that is itself an OPC UA client of the same server |
| `application/json` forms | yes, with field names, no OPC UA knowledge needed                      |
| writing by value         | yes, as OPC UA JSON 1.05 (section 6.7), after the follow-up PR         |

Structures of namespace 0 (for example `Argument`, `KeyValuePair`) can be read from `arrayBuffer()`
by any OPC UA stack. Writing one by value still goes through the binding (section 6.7): a plain
object does not say which type it is.

## 8. Reading structures: how the codec gets the definitions

`value()` for a structure must decode the UA Binary body, which needs the DataTypeDefinition of the
server it came from (section 7). node-opcua already fetches it through the session when it reads
the value. To pass it to the codec:

-   the binding sets the Content type to `application/octet-stream;uaconn=<id>`;
-   core already passes the parameters of the Content type to the codec's `bytesToValue()`
    (`ContentSerdes.contentToValue`), so core does not change;
-   the codec decodes with the definitions of connection `<id>`.

The binding tags the output of an action the same way, so that `value()` can decode a structure
output, such as the `Results` of the AutoID `Scan` method. It also adds `;uapart=arguments`, so
that the codec returns the `KeyValuePair[]` as an object keyed by argument name, as
`application/json` does.

This is internal to the binding. The form's `contentType` stays `application/octet-stream`.

## 9. Consequences

-   `octet-stream` works for every OPC UA type (today: ByteString only).
-   `value()` is the same as JSON, so the TD schema rules are the same too (for example, Int64 is a
    string).
-   The bytes from `arrayBuffer()` can only be read by an OPC UA stack, and a structure from a
    companion specification only with the definitions of the server it came from (section 7).
-   `octet-stream` and `opcua+octet-stream` then carry the same kind of payload, a DataValue. They
    differ in `value()`: the bare value for `octet-stream`, the whole DataValue as JSON for
    `opcua+octet-stream`. (`opcua+octet-stream` also drops the ServerTimestamp and the picoseconds
    today; `octet-stream` keeps what the server sent.) `opcua+octet-stream` can be deprecated later.
-   For a structure, or an action input given by value, the hand-off from core to the binding is
    JSON, not UA Binary (section 6.7). What goes on the wire is UA Binary in every case.
-   `application/opcua+uabinary` is not added (section 1).
-   The ByteString meaning of `octet-stream` was never released, so no existing user depends on it.

## 10. Implementation (a few commits on this PR, revertable as one range)

1. `src/codecs/opcua-ua-binary-codec.ts`: a new codec for `application/octet-stream`, registered for
   the `opc.tcp` scheme only, replacing `OpcuaByteStringCodec`.
    - `bytesToValue`: decode the DataValue, resolve structures (section 8), then build the value from
      its Variant with **the same function** as the `application/json` path. Same result by
      construction.
    - `valueToBytes`: for a value of built-in types (Buffer → ByteString, boolean, number, string,
      arrays of them), build a DataValue holding only the value. For a value that holds a plain
      object (a structure, or an action input), write it as JSON (section 6.7).
2. `src/opcua-content-negotiation.ts`: the `byteString` flavour becomes `uaBinary` (encode the
   DataValue; on write, a payload whose first byte is not a DataValue mask takes the JSON path, as
   `application/json` does; otherwise decode the DataValue, convert the value to the node's
   DataType, and keep the other fields that are present). A value that does not fit the DataType
   is refused, naming both types.
3. `src/ua-binary.ts`: what the codec and the binding share: UA Binary encoding and decoding, the
   per-session structure definitions behind `uaconn`, and `KeyValuePair[]` arguments.
4. `src/opcua-protocol-client.ts`: read, observe and the action output tag the Content (section 8);
   write converts to the node's DataType; the action input is JSON by value (as today) or
   `KeyValuePair[]` as bytes, and the output is `KeyValuePair[]`. A structure in a write or an
   action input is refused with a message that names the follow-up (A3).
5. `src/factory.ts`, `src/codec.ts`: register the new codec, remove the ByteString one.
6. `doc/decisions.md` (D7 added, D4 withdrawn, D3 updated) and `doc/content-negotiation.md`.

## 11. Tests

1. `octet-stream-e2e-test.ts` runs scenarios A to G from #1400 on a Double holding `42`. A has no
   `contentType`. B, C and D use `octet-stream` with the schema `type` on the affordance (B, the
   issue's TD), on the form (C), or on both (D). B and D return `42`, like A. C and E (no `type`
   anywhere) fail with "No schema type defined", like G (`opcua+json`, no `type`): core refuses
   before decoding, as a `type` on the form is not the schema of the affordance.
2. `octet-stream-shapes-test.ts`: a new assertion: for each shape, `value()` with `octet-stream`
   equals `value()` with `application/json`, including `RfidScanResult` from the AutoID nodeset
   (namespace ≠ 0). `arrayBuffer()` is a DataValue whose Variant has the expected type, with the
   server's SourceTimestamp.
3. `contenttype-write-test.ts`: writes round-trip for Int32, Int64 (2^53 + 1), Double, ByteString,
   String and arrays, with a value-only DataValue. A structure write is refused with a clear
   message, by value and as bytes.
4. `full-opcua-thing-test.ts`: an action called with `octet-stream` returns the same output as
   with `application/json`, including an output of `KeyValuePair[]` structures; the input can also
   be given as bytes, a DataValue holding `KeyValuePair[]`.
5. `opcua-ua-binary-codec-test.ts`: the codec writes a plain object as JSON and a value of
   built-in types as a value-only DataValue; no DataValue encoding mask can be taken for the first
   byte of that JSON.

To see the tests fail without the change: run them on the commit before it (the plan commit). B
and D are refused, and the new assertion fails for every shape except ByteString.

## Appendix A. JSON encoding: what node-opcua#1835 fixes, and what is left

`value()` with `octet-stream` is the same as `application/json`, so it has the same JSON issues.

**Fixed in node-opcua by [#1835](https://github.com/node-opcua/node-opcua/pull/1835)**, released in
2.187.10. The decoders still read what node-opcua wrote before; the encoders
change, and node-opcua's release notes mark these changes as breaking:

-   Matrix, `application/json` (1.04 NonReversible): the nested array `[[1,2,3],[4,5,6]]`
    (OPC 10000-6 Annex H.8 and H.9), instead of the Reversible envelope.
-   Matrix, 1.05: the field is `Dimensions` (1.05 Table 41), instead of `UaDimensions`.
-   Namespaces, 1.05: every NodeId, QualifiedName and ExpandedNodeId is written as `nsu=<uri>;…`
    when the encoder has the namespace table, inside structures too. A QualifiedName becomes a
    string (`"nsu=urn:acme;Pump"`) instead of `{"Name":…,"Uri":…}`. A URI the decoder cannot map no
    longer becomes a wrong node of namespace 0.
-   Structure, 1.05: its fields with `UaTypeId` among them, instead of
    `{"UaTypeId":…,"UaBody":{fields}}` (§5.4.2.16).
-   Union: 1.05 Compact `{"SwitchField":3,"Epc":…}`, 1.05 Verbose `{"Epc":…}`, 1.04 NonReversible
    the selected value alone (§5.4.8, Annex H.10). 1.04 Reversible keeps `{"SwitchField","Value"}`.
-   Structure with optional fields: an `EncodingMask` in 1.04 Reversible and 1.05 Compact.
-   DataValue: the status field is `Status`, not `StatusCode` (1.04 Table 31, 1.05 Table 42).
-   1.04 Reversible: the `TypeId` of a namespace-0 structure is its Default JSON encoding node
    (`Range`: `i=15375`, not `i=884`).

**Done in the binding, on node-opcua 2.187.10:**

-   Every JSON encoder and decoder gets the session's namespace table, so the 1.05 forms write
    `nsu=<uri>`. The codecs that decode in core, `opcua+json` and `octet-stream`, find it through
    `;uaconn=` (section 8). On write, `opcua+json` passes the consumer's JSON to the binding
    unchanged.
-   The JSON schemas of `src/codecs/opcua-data-schemas.ts` accept `Dimensions` beside
    `UaDimensions`, and `Status` beside `StatusCode`. A 1.05 status is an object, `{"Code":…}`
    (plus `"Symbol"` in Verbose), which the schema accepted only as an integer before.
-   Edition detection (`detectEdition()`, `is105()`) keeps `UaType` as the 1.05 marker.
-   The action tests call the methods of `MethodSet` on `MethodSet`: node-opcua 2.187 answers
    `BadMethodInvalid` for a method that is not a component of the object (OPC 10000-4 §5.12.2).

The matrix rows of `doc/opcua-json-encoding.md` and `doc/content-negotiation.md` show the new shapes.

**Not fixed by node-opcua#1835:**

-   Matrix, `application/json;version=1.05` gives a flat array, without the dimensions. The binding
    returns the `Value` field of the 1.05 Variant alone; it could nest the array as 1.04
    NonReversible does.
-   A matrix field inside a structure (1.05 Table 44): node-opcua keeps such a field as a
    one-dimensional array, so its dimensions are lost before any encoder runs.
-   Structure: `application/json` gives the fields alone, while `application/json;version=1.05`
    adds `UaTypeId` and writes a union with its `SwitchField`. The two editions disagree on "bare
    value" for a structure.
-   Writing a matrix back with `application/json` (a bare nested array) is not converted back to a
    matrix today, and nothing in this plan changes that.
