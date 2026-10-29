# EtherNet/IP binding for node-wot: analysis

Status: the client binding is implemented, see "Implementation status" below. Sections 1 to 8 are the analysis it is based on and are partly outdated.

## Implementation status

Branch `eip-plugfest-merge`. The package is `@node-wot/binding-eip` (version `1.0.0-SNAPSHOT.0`). It is in the root `tsconfig.json` references and in the client list of the root `README.md`. It is not part of the default servient of `packages/cli`, which keeps it opt-in like Modbus and M-Bus. There is no usage README other than this document (usage of browsing is in section 10).

**Implemented**

| Area                     | State                                                                                                                                                                                                                  | Code                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| URI parsing              | Scheme, host, IPv6 literal, port, route path (also multi-hop with embedded IPs), percent-encoded tag path, `?offset=`. Endpoints without a tag path for browsing.                                                      | `eip-address.ts`                                 |
| CIP and encapsulation    | In-house layer over `net`, no new dependency. Register session, Unconnected Send with route path, one request at a time, timeouts, reconnect after a failure. One session per host, port and route path.               | `eip-protocol.ts`, `eip-session.ts`              |
| Read and write           | Read Tag and Read Tag Fragmented, Write Tag and Write Tag Fragmented, switching to the fragmented services when needed. Structure writes read the tag first, take the structure handle and keep bytes no field covers. | `eip-connection.ts`                              |
| Value codec              | All primitive types, the 88-byte `STRING`, structures with nesting, BOOL bits, array members, arrays with `eipv:dimensions` and `eipv:elementCount`, arrays of structures with `eipv:byteSize`.                        | `eip-codec.ts`                                   |
| Form validation          | The rules of the binding schema, plus rejection of `eipv:scale`, `eipv:offset`, `ExecutePCCC` and unsupported operations. Invalid forms never reach the controller.                                                    | `eip-form-validation.ts`                         |
| Client                   | `readResource`, `writeResource`, `subscribeResource` (serialized polling that survives read errors) and `unlinkResource`. `invokeResource` rejects. `setSecurity` accepts no scheme.                                   | `eip-client.ts`, `eip-client-factory.ts`         |
| Data mapping             | `eipv:scale` and `eipv:offset` are replaced by `map:valueMapping` in core, together with `enum`, `enumRange` and `bitExtract` (section 9).                                                                             | `packages/core`, `test/eip-data-mapping-test.ts` |
| Browse and TD generation | `WoT.requestThingDescription("eip://host/1,0/")` and `browseController(uri, options)`. Controller-scope tags, structures, arrays, read-only tags by external access, filter, skipped-tag report (section 10).          | `eip-symbols.ts`, `eip-browse.ts`                |
| Discovery                | `discoverControllers()`: ListIdentity broadcast on every local IPv4 interface, identity of each device (section 10).                                                                                                   | `eip-discovery.ts`                               |
| Examples                 | `examples/eip-binding/`: `eip-client.js` (read and observe), `eip-browse.js`, `eip-discover.js` and the sample TD `Rockwell.td.jsonld`.                                                                                | `examples/eip-binding`                           |

**Tests.** 209 tests in `packages/binding-eip/test`, all passing, and ESLint is clean. They run against an in-process fake controller (`fake-eip-server.ts`), through a real `Servient` where it matters. Replies recorded from a real controller are used for the browse decoders (`eip-browse-fixtures.ts`).

**Checked on hardware.** The controller of the sample TD (1756-L81E/B, firmware 30.11): reading and observing the four sample tags, browsing and consuming the generated TD, and discovery. Details and open points are in section 10.7. Writes, CompactLogix and large controllers were not checked on hardware.

**Not implemented**

-   PCCC families (MicroLogix, SLC500, PLC5) and `eipv:service: ExecutePCCC`. Micro800 and Omron are rejected when browsing. A form for them is not rejected by a controller check, because `eipv:controller` is not evaluated when reading and writing.
-   Actions, events and `invokeaction`: there is no mapping in the binding.
-   Batching with the Multiple Service Packet and connected messaging (Forward Open). Every request is an Unconnected Send.
-   Browsing program-scoped tags. They can be read and written when the TD lists them by hand.
-   Preferring the live structure of the controller over the one in the form, which the binding spec asks for.
-   Bit access in a tag path such as `Tag.3`. It is rejected. Use `bitExtract` on the whole tag.
-   64-bit integers beyond 2^53: reading and writing them fails with a `RangeError` instead of losing precision.
-   CIP Security. A TD with `nosec` is the only supported description.
-   Registration in the default servient of `packages/cli`.

**Decisions of section 8 as implemented**

1.  In-house CIP layer, no `st-ethernet-ip`.
2.  PCCC is excluded, Omron is rejected when browsing.
3.  64-bit integers: a documented limit of 2^53 with an error.
4.  Observe emits every poll.
5.  Package name `@node-wot/binding-eip`.

This document records the analysis of the W3C EtherNet/IP binding template, the sample Thing Description and the existing node-wot code base, as the basis for implementing an EtherNet/IP protocol client binding.

Sources:

-   Binding template: <https://github.com/w3c/wot-binding-templates/tree/main/bindings/protocols/ethernetip> (`index.html` and `ethernetip.schema.json`, analyzed at commit `709b68b`)
-   Sample TD: <https://github.com/OPCFoundation/UA-EdgeTranslator/blob/main/Samples/Rockwell.td.jsonld>
-   node-wot: this repository, mainly `packages/core` and `packages/binding-modbus`

## 1. The binding spec

The spec is an Editor's Draft and was changed shortly before this analysis (array support was merged). The vocabulary may still change, so the implementation should target a pinned revision. The namespace `https://www.w3.org/2026/wot/eip` (prefix `eipv`) is provisional.

**Scope:** explicit (non-cyclic) tag read/write for Logix 5000 controllers over CIP. Out of scope: implicit I/O, Assembly objects, CIP Safety/Motion/Sync, arbitrary class/instance/attribute paths, actions and events, discovery. PCCC families (MicroLogix, SLC500, PLC5) are only partly specified.

### URI scheme

`eip://host[:port]/route-path/tag-path[?offset=N]`

-   Default port: 44818.
-   Default route path: `1,0` (backplane, slot 0).
-   The route path is a comma-separated list of CIP segments and may contain Ethernet hops with embedded IPs, for example `1,4,2,192.168.1.20,1,0`.
-   The tag path uses Logix symbolic syntax: `Tag`, `Program:Prog.Tag`, `Tag.Member`, `Tag[i]`, `Tag[i,j,k]`, `Tag.bit`.
-   `[`, `]`, `?`, `#` and `/` inside a tag path must be percent-encoded. A relative href containing `:` must start with `./`.
-   `?offset=` is a raw byte offset into the tag value.
-   A `base` URI must end with `/`, otherwise reference resolution replaces the route path.

### Vocabulary

Thing term: `eipv:controller` (`ControlLogix` default, `CompactLogix`, `Micro800`, `MicroLogix`, `SLC500`, `PLC5`, `Omron`).

Form terms:

| Term                                                    | Meaning                                                                                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `eipv:type`                                             | BOOL, SINT, INT, DINT, LINT, USINT, UINT, UDINT, ULINT, REAL, LREAL, BYTE, WORD, DWORD, LWORD, STRING (CIP codes `0xC1`-`0xD4`, `0xA0`) |
| `eipv:structureDefinition`                              | `eipv:typeName`, `eipv:fields[]`, `eipv:byteSize` (required for array elements)                                                         |
| field: `eipv:name`, `eipv:byteOffset`                   | required for every field                                                                                                                |
| field: `eipv:type` or nested `eipv:structureDefinition` | exactly one                                                                                                                             |
| field: `eipv:bitOffset`                                 | required for BOOL fields                                                                                                                |
| field: `eipv:dimensions`                                | array members (not BOOL or STRING)                                                                                                      |
| `eipv:service`                                          | ReadTag, ReadTagFragmented, WriteTag, WriteTagFragmented, ExecutePCCC                                                                   |
| `eipv:pollingTime`, `eipv:timeout`                      | milliseconds                                                                                                                            |
| `eipv:scale`, `eipv:offset`                             | `value = raw * scale + offset`; `scale` must not be 0                                                                                   |
| `eipv:dimensions`, `eipv:elementCount`                  | array transfer; `elementCount` requires `dimensions`                                                                                    |

### Operations

Only `readproperty`, `writeproperty` and `observeproperty` are mapped. Observe is realized by polling. `invokeaction`, `subscribeevent`, `unsubscribeevent` and Event affordances have no mapping.

| Operation         | Symbolic families                            | PCCC families                     |
| ----------------- | -------------------------------------------- | --------------------------------- |
| `readproperty`    | Read Tag `0x4C` (Read Tag Fragmented `0x52`) | Execute PCCC `0x4B`, class `0x67` |
| `writeproperty`   | Write Tag `0x4D` (Fragmented `0x53`)         | Execute PCCC                      |
| `observeproperty` | repeated read, interval `eipv:pollingTime`   | repeated read                     |

An implementation may batch reads with the Multiple Service Packet (`0x0A`).

### Payload rules

-   Values are little-endian.
-   A structure is exposed as a JSON object keyed by `eipv:name`; arrays are exposed as flat JSON arrays.
-   A structure write must preserve bytes that no field covers (padding), so the tag is read before it is written.
-   Layout follows the controller: natural alignment, packed BOOL bits, nested offsets relative to the nested start.
-   A live structure definition from the controller should be preferred over the embedded one.
-   A Form must not carry both `eipv:type` and `eipv:structureDefinition`.
-   Unsupported types must be rejected, not decoded as another type.
-   CIP Security is not yet mapped to WoT security schemes. `nosec` must not describe a CIP-Security-protected endpoint.

## 2. The sample TD (`Rockwell.td.jsonld`)

-   Four object Properties, each with `readproperty`, `observeproperty` and `writeproperty` forms.
-   `base` is `eip://192.168.178.122/1,0/`. Relative hrefs: `./Local:2:O`, `Production_Data`, `Previous_Shift_Production_Data`, `IO_Control`.
-   `eipv:controller` is absent, so `ControlLogix` applies.
-   Every form uses `eipv:structureDefinition` and `eipv:pollingTime: 1000`. There is no `eipv:type`.
-   Fields are DINT and REAL only: no BOOL bit offsets, nested structures or arrays. `UDT_Shift_Data` has 9 fields and is 36 bytes.
-   Field names must be matched literally, including the typos `Prodution_Count` and `OEE_Availablity`.
-   `uav:mapToType` is an OPC UA extension whose `uav` prefix is not declared in `@context`. It must be ignored.
-   The Property schemas are `type: object` without `properties`, so the field set comes only from `eipv:structureDefinition`.
-   The sample does not exercise `eipv:scale`, arrays, `?offset=`, PCCC or primitive tags.

## 3. How this fits node-wot

### Package

-   The root `workspaces` glob `packages/binding-*` picks up a new package automatically. Modbus and M-Bus are the templates (`src/`, `test/`, `tsconfig.json`, `package.json`, README).
-   Package version must be `1.0.0-SNAPSHOT.0` to satisfy `npm run check:versions`.
-   Registration points: root `tsconfig.json` `references` and the client list in the root `README.md`.
-   `packages/cli/src/cli-default-servient.ts` does not include Modbus or M-Bus. EtherNet/IP should be opt-in the same way.
-   Source files carry the Eclipse license header and must pass the repository ESLint rules (strict boolean expressions).

### Client contract

-   Factory: `ProtocolClientFactory` with scheme `eip`, modeled on `modbus-client-factory.ts`.
-   Client: `ProtocolClient` from `packages/core/src/protocol-interfaces.ts`.
    -   `readResource`, `writeResource`, `subscribeResource` and `unlinkResource` are implemented.
    -   `invokeResource` rejects (no action mapping).
    -   `requestThingDescription` browses the controller and returns its Thing Description (section 10).
    -   `setSecurity` accepts `nosec` only.
    -   `start`/`stop` manage sessions and subscriptions.

### Content handling

-   The client is not given the Property data schema, so Modbus's raw octet-stream approach does not fit.
-   Template: the OPC UA client (`packages/binding-opcua/src/opcua-protocol-client.ts`, `_dataValueToContent`). It decodes the wire bytes and returns JSON `Content`.
-   On write it parses incoming `Content` through `ContentSerdes` into a value, then encodes it.

### Href resolution

Core normalizes `base` into relative hrefs in `packages/core/src/serdes.ts`. Verified with `url-toolkit` and `new URL` in a temp directory:

| base                                           | href                          | resolved                                                             |
| ---------------------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `eip://192.168.178.122/1,0/`                   | `./Local:2:O`                 | `eip://192.168.178.122/1,0/Local:2:O`                                |
| `eip://192.168.178.122/1,0/`                   | `Production_Data`             | `eip://192.168.178.122/1,0/Production_Data`                          |
| `eip://10.0.0.1:44819/1,4,2,192.168.1.20,1,0/` | `Recipe%5B3%5D.SetPoint`      | `eip://10.0.0.1:44819/1,4,2,192.168.1.20,1,0/Recipe%5B3%5D.SetPoint` |
| `eip://[::1]/1,0/`                             | `./Program:Packaging.Counter` | `eip://[::1]/1,0/Program:Packaging.Counter`                          |
| `eip://h/1,0` (no trailing slash)              | `MotorSpeed`                  | `eip://h/MotorSpeed` (route is lost)                                 |

-   `new URL` parses host, port and path of these URIs correctly. IPv6 hostnames keep their brackets.
-   A tag href with a colon and no `./` (for example `Program:X.Y`) matches the "already absolute" regex in `serdes.ts` and is not resolved. The spec already tells authors to use `./`.

### Modbus polling pitfalls to avoid

Seen in `packages/binding-modbus/src/modbus-client.ts`:

-   `setInterval` lets slow reads overlap.
-   The first read error clears the interval.
-   A duplicate subscription calls `reject` but does not return.
-   `stop()` does not clear subscriptions.

## 4. Design implications

1.  **Connection key.** Modbus keys connections by `host:port`. EtherNet/IP must also key by route path: the same IP with a different route is a different controller. One TCP/EIP session per endpoint can be shared, with a serialized request queue, timeouts from `eipv:timeout` and reconnect handling.
2.  **Parsing the href.** Split the route from the tag on the raw (still percent-encoded) pathname, then percent-decode the tag. Splitting after decoding breaks a `%2F` inside a tag name.
3.  **Structure writes.** Logix returns structure type `0xA0 0x02` plus a 2-byte structure handle on read, and the handle is needed on write. A structure write is read, merge fields, write.
4.  **Fragmented services.** ReadTag/WriteTag may switch to the fragmented variants when a value does not fit in one message.
5.  **Codec work.** Natural alignment, packed BOOL bits, nested offsets, arrays with a `byteSize` stride, scale/offset per element, `?offset=` byte offsets.
6.  **Batching.** The sample polls four tags per second on one controller, a natural fit for the Multiple Service Packet. Defer past v1.
7.  **Library choice (open).** The spec needs arbitrary multi-hop routes, structure handles, element-count ranges and byte offsets.
    -   `libplctag` is not on npm; it is what the reference .NET implementation (UA Edge Translator) uses.
    -   `st-ethernet-ip` (MIT) and `ethernet-ip` (MIT) exist on npm. From memory they take a slot number rather than a full route path; this has not been verified.
    -   Leaning toward a small in-house CIP layer over `net` (session registration, unconnected send, the four tag services, symbolic and array segments). No new runtime dependency, full control over routing, and it can sit behind an internal interface that tests can fake. Downside: more code to own.

## 5. Spec gaps and judgment calls

-   **Omitted route ambiguity.** With the route optional, `eip://host/MotorSpeed` could mean a route or a tag. A heuristic is needed, for example treating the first segment as a route only if it matches `^\d+(,[^/]+)*$`.
-   **64-bit types.** LINT, ULINT and LWORD exceed 2^53 and JSON has no BigInt. Options: lossy number, string, or a documented limit.
-   **STRING fields.** The default layout is 88 bytes (`LEN` DINT, 82-byte `DATA`, padding). A custom-length string cannot be declared as a field, so the size must be inferred from offsets or the structure's `byteSize`.
-   **Observe semantics.** Emit every poll (as Modbus does) or only on change; the spec leaves this open.
-   **Default polling interval.** Not specified.
-   **Form validation.** The client should enforce the rules the schema expresses:
    -   not both `eipv:type` and `eipv:structureDefinition`
    -   `eipv:elementCount` requires `eipv:dimensions`
    -   `eipv:scale` is not 0
    -   a read service is not combined with `writeproperty`, and a write service only with `writeproperty`
    -   BOOL and STRING are not used as array elements
-   **Context URI.** Older implementations identify the binding as `https://www.w3.org/2019/wot/eip`. Do not gate behavior on the `@context` value.

## 6. Suggested v1 scope

-   Logix symbolic families (ControlLogix, CompactLogix, Micro800).
-   Primitives, structures (including nested), arrays, scale/offset, `?offset=`, read/write/observe, fragmented services.
-   Reject PCCC families (and probably Omron) with a clear error.
-   Reject unsupported types and invalid forms.

## 7. Testing strategy

-   Pure codec unit tests: alignment, bits, nesting, arrays, padding preservation, scale/offset. Use the sample TD as a fixture.
-   Href and route-path parsing tests, including the cases in section 3.
-   `parseTD` test that the sample TD normalizes and resolves.
-   Client tests against a minimal in-process fake EtherNet/IP server, the same approach as `packages/binding-modbus/test/test-modbus-server.ts`.

## 8. Open decisions

1.  In-house CIP layer or `st-ethernet-ip`?
2.  Is excluding PCCC and Omron from v1 acceptable?
3.  Representation of 64-bit integers.
4.  Observe: emit every poll or only on change?
5.  Package name: the folder is `binding-eip`; npm name `@node-wot/binding-eip` or `@node-wot/binding-ethernetip`?

## 9. Using data-mapping terms from user stories 3, 4 and 5

This section records what was found when the data-mapping vocabulary of the WoT TD analysis (user stories 2 to 5, `planning/work-items/analysis/data-mapping` in the `wot-thing-description` working copy) was applied to this binding. The `map:` and `octv:` prefixes are working prefixes with placeholder namespaces. node-wot does not process the JSON-LD `@context`, it matches the keys literally.

Status: implemented on the local branch `eip-plugfest-merge` (merge of `glc-plugfest` into `eip-binding`, plus the commits on top). Everything was tested against the in-process fake controller only, not against a real PLC.

### 9.1 Summary

| EIP term                                        | User-story term                                                       | Result                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------- |
| `eipv:scale`, `eipv:offset`                     | `map:proc` `mul`, `add`, `round` (US3)                                | Replaced. The EIP terms are removed and rejected.         |
| `eipv:bitOffset` (BOOL field)                   | `octv:mask`, `octv:shift`, `octv:fieldType: boolean` via `bitExtract` | Not replaced. See 9.4.                                    |
| `eipv:byteOffset` (field)                       | `octv:byteOffset` (form level)                                        | Not replaced. See 9.5.                                    |
| `eipv:name` (field)                             | `octv:fieldName` or `map:name`                                        | Not replaced. Different role.                             |
| `eipv:type`                                     | none in US2 to 5 (US6 "More Detailed Types")                          | Kept.                                                     |
| `eipv:structureDefinition`, `eipv:fields`       | none (open follow-up of the analysis)                                 | Kept.                                                     |
| `eipv:dimensions`, `eipv:elementCount`          | `jsonv:index` with `at`/`setAt` selects one element only              | Kept.                                                     |
| `eipv:pollingTime`, `eipv:timeout`              | none (timing is out of scope of US5)                                  | Kept. Not data mapping.                                   |
| `eipv:service`, `eipv:controller`, `?offset=`   | none                                                                  | Kept.                                                     |
| enum conversion (not an EIP term)               | `map:proc` `enum`, `enumRange` (US4)                                  | Used as is. The binding defines no enum terms of its own. |
| bit fields of a whole integer tag (no EIP term) | `bitExtract` with `octv:fields` (US5)                                 | Used as is. Fills a gap, see 9.3.                         |

### 9.2 What works with EIP forms

The mapping pipeline runs in core, on the value that the client returns. The EIP client returns decoded JSON, so every `map:` operation applies to it without changes in the binding. The write direction runs in `ConsumedThing.writeProperty` before the value reaches the client.

| Term                                                                      | Direction | Use with EIP                                                                      |
| ------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------- |
| `mul`, `add`, `round` (`floor`, `ceil`, `nearest`, `towardZero`), `clamp` | both      | Scaling of numeric tags, replaces `eipv:scale` and `eipv:offset`.                 |
| `enum` with `map:name`                                                    | both      | Convert one UDT member such as `Mode` between wire code and application label.    |
| `enumRange` with `map:canonical`                                          | both      | Classification of a numeric tag. A write needs a canonical value per symbol.      |
| `bitExtract` with `octv:fields` (optionally with `map:name`)              | read only | Split an unsigned integer tag, or one member of a structure, into named booleans. |
| `pick`, `record`, `coerce`                                                | read only | Available, not needed for EIP so far.                                             |

Verified by tests (all through a real `Servient` and the fake controller):

-   `bitExtract` on a `DWORD` status word returns named booleans.
-   `enum` with `map:name` converts a structure member on read, and back to the wire value on write.
-   `mul` and `add` scale an `INT` tag on read. The inverse `add`, `mul`, `round` writes the raw integer.
-   A form with `map:fromWire` and without `map:toWire` is refused for writing, and no request reaches the controller.

### 9.3 Replacing `eipv:scale` and `eipv:offset`

The two EIP terms express `value = raw * scale + offset` and, on write, the inverse rounded to the wire type. As `map` terms:

```json
"map:valueMapping": {
    "map:fromWire": [
        { "map:proc": "mul", "map:value": 0.1 },
        { "map:proc": "add", "map:value": 5 }
    ],
    "map:toWire": [
        { "map:proc": "add", "map:value": -5 },
        { "map:proc": "mul", "map:value": 10 },
        { "map:proc": "round", "map:mode": "nearest" }
    ]
}
```

The behaviour differs from the EIP terms in these places:

1.  **Explicit write direction.** US3 requires `map:toWire` to be written out, because the inverse of a read mapping is not always unique. The EIP terms derived it implicitly. A form with a read mapping and no `map:toWire` now fails on write instead of writing the unmapped value.
2.  **Rounding is a separate step.** EIP rounded to the nearest value of an integer wire type and did not round `REAL` or `LREAL`. A `map` pipeline does not know the wire type, so the author adds `round` for integer tags only. Without it a fractional value fails with a `RangeError` in the codec, which is a safe failure.
3.  **Rounding mode.** `nearest` is half to even, as in US3. The former EIP code used `Math.round`, which rounds halves up. The results differ on exact halves, for example 2.5 gives 2 instead of 3.
4.  **Zero scale.** EIP rejected `eipv:scale = 0`. US3 does not say whether `mul` by 0 is allowed, so a writable form can lose the raw value without an error.
5.  **Arrays.** EIP applied scale and offset to every element of an array tag. The numeric operations act on one scalar. There is no operation that applies a step to each element of an array, so arrays of scaled values cannot be expressed yet.
6.  **Non-finite values.** US3 treats NaN and infinity as invalid and the implementation rejects them. A `REAL` tag can hold them.
7.  **Structure members.** EIP did not allow scale and offset on structures. With `map:name` on the numeric operations, one member of a structure can now be scaled. This is an improvement, but it required adding `map:name` to the numeric operations, which US3 does not define (only US4 does).

Because the EIP spec is still a draft, a TD written for the draft that uses `eipv:scale` or `eipv:offset` is rejected by this implementation with `eipv:scale is not supported, use map:valueMapping with the mul and add operations`. The forms cannot be silently accepted, because ignoring them would produce unscaled values.

The EIP spec states that these two terms have the same semantics as in the Modbus binding. US3 found no arithmetic terms in the reviewed Modbus binding. This should be checked before the correspondence is cited.

### 9.4 `eipv:bitOffset` and `bitExtract`

A BOOL field of a structure with `eipv:bitOffset = n` corresponds to `octv:mask = 2^n`, `octv:shift = n` and `octv:fieldType: boolean` for a byte at the field's offset. It is not replaced, for these reasons:

-   `bitExtract` works on one integer, either the whole value or one member selected with `map:name`. A UDT with BOOL fields spread over several bytes needs one `bitExtract` per integer, and the structure decoding then has to hand it an integer, which the structure definition does not do.
-   The write direction conflicts. US5 `bitCompose` needs the complete field list, because omitted bits are composed as zero. EIP requires that bytes no field covers are preserved, which means reading the tag first. `bitCompose` is not implemented.
-   `bitExtract` requires a non-negative safe integer. Use unsigned types (`UDINT`, `DWORD`), a signed `DINT` with the top bit set is rejected.

`bitExtract` is useful where EIP has no mechanism: an integer tag whose bits are flags. The binding rejects bit access such as `Tag.3`, so a `DWORD` status word is read as a whole and split with `octv:fields`.

### 9.5 Replacing `eipv:byteOffset` with `octv:byteOffset`

Replacing the term is mechanically small, but the two terms apply at different levels, and it is not recommended.

-   `eipv:byteOffset` is required on every field of `eipv:fields`. It is the position of the field inside its enclosing structure. For a nested structure it is relative to the start of the nested structure, and for an array member it anchors the first element.
-   `octv:byteOffset` is defined as a form-level term, together with `octv:byteLength` and `octv:byteOrder`, that identifies the byte range holding the value. node-wot reads only `form["octv:byteOffset"]`, only for octet-stream content, and rejects values other than 0. `octv:` defines nothing for the field of a structure. That is the third open follow-up in `US2345-general.md`.

Impact of a rename:

| Area                                                                     | Occurrences |
| ------------------------------------------------------------------------ | ----------- |
| Binding source (`eip-codec.ts`, `eip-form-validation.ts`, `eip-form.ts`) | 7           |
| Binding tests                                                            | about 35    |
| `examples/eip-binding/Rockwell.td.jsonld`                                | 23          |
| This document                                                            | 1           |

-   Core is not affected. It does not read keys inside `eipv:structureDefinition`.
-   The W3C EIP schema requires `eipv:byteOffset` on every field and the UA Edge Translator writes its TDs that way. After a rename the sample TD and TDs from that tool are invalid for this binding, unless both terms are accepted.
-   `octv:` has no type or signedness term. Each field still needs `eipv:type`, so a field mixes `eipv:name`, `eipv:type` and `octv:byteOffset`. `octv:byteLength` repeats what `eipv:type` implies. `octv:byteOrder` is pointless, because CIP is little-endian only.
-   Nested-relative offsets and array stride would have to be defined for `octv:`.
-   A form-level `octv:byteOffset` on an EIP form is currently ignored without an error. The core returns early for non-octet-stream content before it reaches its offset check.

A form-level `octv:byteOffset` corresponds to `?offset=` in the EIP href, the raw byte offset into the tag value. The client supports that offset already. Reading the form term as well would be a small change, but the draft specifies the query form, and the core would have to accept non-zero values.

Recommendation: keep `eipv:byteOffset`. If alignment with `octv:` is wanted, accept both terms on fields with `eipv:` winning on conflict, after the multi-field follow-up is decided. Alternatively map only the form-level `octv:byteOffset` to `?offset=`.

### 9.6 Gaps in the data-mapping vocabulary that EIP exposes

-   **Per-element operations on arrays.** The numeric operations take a scalar. Arrays of scaled values, which EIP could express before, cannot be expressed now.
-   **Multiple typed fields at independent offsets.** `eipv:structureDefinition` is a concrete use case for the open follow-up in `US2345-general.md`. `octv:` has no typed fields (`octv:fieldType` is only `boolean` or `integer`, and only for bit fields), so REAL, DINT or STRING members cannot be described.
-   **Write counterpart of `bitExtract`.** `bitCompose` is not implemented and needs a policy for bits that are not listed.
-   **Length-prefixed strings.** The Logix `STRING` structure (`LEN` and `DATA`) needs a bytes-to-string operation that the analyzed stories do not define.
-   **`map:name` on numeric operations.** Added in this implementation. US3 should define it, as US4 does for `enum`.

### 9.7 Conclusions and open items

-   Replace now: `eipv:scale` and `eipv:offset` by `mul`, `add`, `round` and the explicit `map:toWire`. Done on `eip-plugfest-merge`.
-   Keep: all structure terms (`eipv:structureDefinition`, `eipv:fields`, `eipv:name`, `eipv:byteOffset`, `eipv:bitOffset`, `eipv:byteSize`, `eipv:dimensions`), `eipv:type`, and the transport terms.
-   Reuse as is: `enum`, `enumRange` and `bitExtract`.
-   Not verified on hardware: all of the above ran only against the fake controller.
-   Open: whether to accept both `eipv:` and `octv:` offsets on fields, and whether `?offset=` should also be expressible as a form-level `octv:byteOffset`.
-   Sections 1 to 8 above describe the state before the data-mapping work and are partly outdated. Section 1 still lists `eipv:scale` and `eipv:offset` as part of the EIP vocabulary, which is accurate for the W3C draft but not for this implementation.

## 10. Browsing a controller and generating a Thing Description

Status: implemented in `src/eip-symbols.ts`, `src/eip-browse.ts` and `src/eip-discovery.ts`, and checked against the controller of the sample TD (section 10.7). The goal is to point the binding at an `eip://` endpoint, read the tag database of the controller and get a TD that `WoT.consume` accepts.

Usage:

```js
const td = await WoT.requestThingDescription("eip://192.168.100.218/1,0/");
const thing = await WoT.consume(td);

// with options and the list of tags that could not be expressed
const { thingDescription, skipped } = await browseController("eip://192.168.100.218/1,0/", { filter: /^IO_/ });

// find controllers on the network
const controllers = await discoverControllers();
```

`examples/eip-binding/eip-browse.js` runs the first two against a controller.

Sources:

-   UA-EdgeTranslator, `ProtocolDrivers/Rockwell/RockwellProtocolDriver.cs` on `main` (the browse and discovery logic) and its README (analyzed 2026-10).
-   pycomm3 (`logix_driver.py`, MIT) for the CIP wire layouts, because the C# driver hides them behind libplctag and the libplctag sources were not reachable during this analysis.
-   The identity and `ListIdentity` layouts come from memory of the EtherNet/IP specification. They were confirmed against the controller (section 10.7).

The layouts below were checked against the controller where section 10.7 says so.

### 10.1 What UA-EdgeTranslator does

The driver implements two operations, which its UI chains: **Discover** (button, lists endpoints) and **Create** (browse one endpoint, save the TD, onboard it).

**`Discover()`: find controllers on the network**

-   Sends an EtherNet/IP `ListIdentity` (command `0x63`, a 24-byte header with all other fields zero) as a UDP broadcast to port 44818.
-   Binds the socket to one local IPv4 interface so the broadcast leaves on the PLC network, not on a Docker, WSL or VPN adapter. The interface is `ROCKWELL_LOCAL_IP` if set, otherwise the first interface that is up, not loopback or tunnel, and has an IPv4 default gateway. The broadcast address is computed from the interface mask.
-   Collects replies for 5 seconds, ignores replies that are not command `0x63` and replies from its own address, and turns each sender into the base URI `eip://<ip>/1,0/`.
-   Needs host networking when run in a container, as its README states.
-   It does not parse the identity in the reply (product name, vendor, revision). The controller family is hard-coded to ControlLogix.

**`BrowseAndGenerateTD(assetName, endpoint)`: read the tag database**

1.  Parses the endpoint into gateway and route path, writes `eipv:controller: ControlLogix` into the TD and normalizes `base` to end with `/`.
2.  Reads the pseudo tag `@tags` through libplctag. libplctag turns this into the Symbol Object tag list (class `0x6B`) and repacks every entry as: instance id, type word, element length, three array dimensions, name length, name. The driver decodes that buffer entry by entry.
3.  Drops entries that are not data tags: names starting with `Program:`, `Task:`, `Map:`, `Cxn:` and `__`.
4.  For each remaining tag, looks at the type word:
    -   Bit 15 set and bit 12 clear: a structure. The low 12 bits are the template (UDT) id. The driver reads the pseudo tag `@udt/<id>` and decodes the template: member count, structure size, then per member an info word, a type word and an offset, then the type name and the member names.
    -   Otherwise an atomic type. The low byte is mapped to `eipv:type`. An unsupported code (for example `DATE_AND_TIME`) makes the driver log a warning and skip the tag. This matches the binding rule that an unsupported type must not be decoded as another one.
5.  Builds a structure definition recursively. A nested UDT member becomes a nested `eipv:structureDefinition`. Definitions are cached by template id for the duration of one browse, so tags that share a UDT cause one template read.
6.  Array tags: the number of dimensions is in bits 13 and 14 of the type word and the sizes come from the three dimension values. Arrays of BOOL and STRING are skipped. Array members of a structure: bit 13 (`0x2000`) of the member type word is set and the info word holds the element count.
7.  BOOL members of a structure: the info word is the bit number, which becomes `eipv:bitOffset`.
8.  Emits one Property per tag: `readproperty`, `observeproperty` and `writeproperty` forms, `eipv:pollingTime` 1000, `observable: true`, `readOnly: false`, a data schema derived from the type (integer bounds from the CIP type, `array` with `minItems` and `maxItems` for arrays, `object` for structures), and the structure definition with `eipv:byteSize` set from the template. It also adds OPC UA terms (`uav:mapToType`), which are specific to that product and which the node-wot binding ignores.

**Use of the browse result.** UA-EdgeTranslator stores the TD and then connects. When it later creates a tag from a form it prefers the controller's live structure over the one in the form: it reads the template of the tag again and warns if the embedded definition has a different layout. That is the behaviour the binding spec asks for in section 1 and the node-wot client does not do yet.

**Gaps seen in the C# driver**

-   Program-scoped tags are not enumerated. `Program:<name>` entries are dropped and the driver never reads `Program:<name>.@tags`. Such tags only work when written by hand, where the driver does read the program's list for the live structure.
-   Every property is writable. The controller reports external access per tag (read/write, read-only, none) on newer firmware, and the driver ignores it.
-   Skipped tags are only logged, so the user cannot tell which tags are missing.
-   No filter. A controller with thousands of tags yields thousands of observable properties, each polling every second.
-   A tag with a custom string type (a UDT named `STRING20` with `LEN` and `DATA`) becomes a plain structure, because the driver has no special case for strings.
-   libplctag is a native dependency. It is the reason for the allow-list and ARM64 library loading fixes in that repository. node-wot does not need it, see below.

A second route exists for offline use: UA-WoTGenerator converts a Studio 5000 tag export (CSV) into a Thing Model with placeholders. It needs no PLC but also no live structure layout, because offsets are resolved at runtime by the driver. It is not a candidate for node-wot.

### 10.2 What the CIP layer needs for this

The in-house layer already has what is required to send arbitrary CIP requests: `EipSession.request` takes any request buffer and returns the parsed reply, and `eip-protocol.ts` has the encoders for the tag services. What is missing are class and instance path segments, the paging of partial replies for services other than Read Tag, and the decoders below.

| Step                | CIP                                                    | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tag list            | Get Instance Attribute List `0x55`, class `0x6B`       | Path: class `0x6B`, instance = first instance to return (0 at the start). Data: attribute count, then attribute ids. libplctag asks for 1 (name), 2 (type), 7 (element length), 8 (dimensions). pycomm3 asks for 1, 2, 3, 5, 6, 8 and 10 (external access). The binding asks for 1, 2, 7, 8 and 10, and falls back to 1, 2, 7 and 8 when the controller rejects attribute 10 (status `0x14`). Replies carry the requested attributes in order, and the name is a 16-bit length plus bytes. |
| Tag list paging     | status `0x06`                                          | Not an error. Parse the entries that arrived and ask again with instance = last instance + 1. Status 0 ends the list.                                                                                                                                                                                                                                                                                                                                                                      |
| Program tags        | same, with a symbolic segment `Program:<name>` first   | The program names come from the controller list (entries named `Program:<name>`).                                                                                                                                                                                                                                                                                                                                                                                                          |
| Type word           | bits of the symbol type                                | Bit 15 structure, bit 12 system, bits 13 and 14 number of dimensions, bits 0 to 11 template id for a structure, low byte CIP type code for an atomic tag.                                                                                                                                                                                                                                                                                                                                  |
| Template attributes | Get Attribute List `0x03`, class `0x6C`, instance = id | Attributes 4 (definition size in 32-bit words), 5 (structure size in bytes), 2 (member count), 1 (structure handle). The reply holds attribute id, status and value for each.                                                                                                                                                                                                                                                                                                              |
| Template body       | Read Tag `0x4C` on class `0x6C`, instance = id         | Data: 32-bit offset and 16-bit byte count. The count is derived from the definition size (`size * 4 - 23`; `- 21` also works, `size * 4` fails). Page with status `0x06` until status 0.                                                                                                                                                                                                                                                                                                   |
| Template layout     | in the body                                            | One 8-byte record per member (16-bit info, 16-bit type, 32-bit offset), then null-terminated strings: the type name (followed by `;` and other text), then each member name. Info is the bit number of a BOOL, else the element count of an array member.                                                                                                                                                                                                                                  |
| Identity            | Get Attributes All `0x01`, class `0x01`, instance 1    | Vendor, device type, product code, revision, serial number and product name (for example `1756-L83E/B`). The revision decides whether external access can be requested. The product name decides the `eipv:controller` value.                                                                                                                                                                                                                                                              |
| Discovery           | `ListIdentity` `0x63`, UDP or TCP encapsulation        | The reply data is an item count, then item `0x000C` holding protocol version, a socket address in big-endian order, vendor, device type, product code, revision, status, serial number, a product name as a short string and a state byte. Over TCP the command needs no registered session, so it also identifies one known host.                                                                                                                                                         |

Notes:

-   The session sends everything with Unconnected Send, whose messages are small (about 500 bytes). Tag list replies then page often. Hundreds of tags are fine. For many thousands, a Forward Open connection with a large packet size (what pycomm3 and libplctag use) would cut round trips. It is an optimization behind the same `EipSession` interface and not needed for the first version.
-   The 32-bit form of the instance segment is rarely needed (instance ids stay below 65536 on common controllers). Verify its encoding before relying on it, because pycomm3 and the CIP specification as remembered do not agree.
-   The route path is the same as for tag access, so the existing session keying by host, port and route applies.

### 10.3 Mapping controller data to the binding vocabulary

| Controller data                                                         | Generated TD                                                                                                                                                                            |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic type code `0xC1` to `0xD4`                                       | `eipv:type`, with a data schema of `boolean`, `integer` (bounds from the type) or `number`. The 64-bit types stay as `integer`, the codec rejects values beyond 2^53 (open decision 3). |
| Array tag (dimension count in the type word, sizes in attribute 8)      | `eipv:dimensions`, `type: array` with `items`, `minItems` and `maxItems`. BOOL and STRING arrays are not generated.                                                                     |
| Structure tag                                                           | `eipv:structureDefinition` from the template, `eipv:byteSize` from the structure size, `type: object`.                                                                                  |
| Member with a nested structure                                          | A nested `eipv:structureDefinition`, resolved recursively with a template cache.                                                                                                        |
| BOOL member                                                             | `eipv:type: eipv:BOOL` with `eipv:byteOffset` of the host byte and `eipv:bitOffset` from the info word.                                                                                 |
| Array member (`0x2000` set in the member type)                          | `eipv:dimensions` on the field.                                                                                                                                                         |
| Hidden members (`ZZZZZZZZZZ...` host bytes, names starting with `__`)   | Not listed as fields. Their bytes are preserved on write, because the codec already keeps bytes that no field covers.                                                                   |
| Template `STRING` (named `STRING`, or `ASCIISTRING82` on some firmware) | `eipv:type: eipv:STRING`, as the codec expects the 88-byte layout.                                                                                                                      |
| Other string templates (`LEN` and `DATA[n]`)                            | Open. Either skip with a reason, or generate a structure with `LEN` and an array `DATA`. Section 5 already notes that a custom string length cannot be declared as a field type.        |
| Unsupported atomic type (time and date types, string types)             | Skipped with a recorded reason, never decoded as another type.                                                                                                                          |
| External access (attribute 10)                                          | Read-only tag: `readOnly: true`, ops `readproperty` and `observeproperty`. No access: tag skipped. Without the attribute: writable, as in UA-EdgeTranslator.                            |
| Entry names `Program:`, `Task:`, `Routine:`, `Map:`, `Cxn:`, `__`       | Not data tags. `Program:` is used for program scope, the rest is dropped. System tags (bit 12) are dropped.                                                                             |
| Route path and host                                                     | `base` is `eip://host[:port]/route/` with the trailing `/`.                                                                                                                             |
| Tag name                                                                | Property key is the tag name. `href` is relative and starts with `./` when the name contains `:`. `[`, `]`, `?`, `#` and `/` are percent-encoded (section 1).                           |
| Product name from the identity                                          | `eipv:controller`. `1756` maps to ControlLogix, `1769` and `5069` to CompactLogix, `2080` to Micro800 (family detection should be checked against real product names).                  |
| Constants                                                               | `eipv:pollingTime` 1000, `securityDefinitions` `nosec`. A browse cannot tell whether the endpoint is protected by CIP Security, so the user has to know.                                |

Every generated form should pass `validateEipForm` before it is emitted. A form that fails is skipped and reported, not emitted. This keeps the result consumable and makes the generator and the client agree on one set of rules.

### 10.4 Where this fits in node-wot

There are three possible entry points. They are not exclusive.

1.  **`EipClient.requestThingDescription(uri)`.** The method already exists and throws "Method not implemented". The core `WoT.requestThingDescription(url)` picks the client by scheme, calls this method, parses the content and runs `isThingDescription` on it. So `WoT.requestThingDescription("eip://host/1,0/")` followed by `WoT.consume(td)` works without any change in core, and the HTTP, CoAP and file bindings use the same hook. The content type is `application/td+json`, which core already has a codec for.
2.  **An exported browse function**, for example `browseController(options)`, returning the TD and a list of skipped tags with reasons. `requestThingDescription` takes only a URI, so everything that needs options (title, program scope, tag filter, polling time, timeout, read-only handling) needs this entry point. Entry point 1 calls it with defaults. The function is also what an example script or a future CLI command would use.
3.  **Discovery of controllers.** `WoT.discover()` in core throws "not implemented", and `ProtocolClient` has no discovery hook. Adding one is a change in `packages/core` that affects every binding, so it is out of scope here. Export a plain function from the binding instead, for example `discoverControllers({ localAddress, timeout })`, returning host, port, product name, vendor, revision and the base URI.

Proposed files in `packages/binding-eip/src`:

-   `eip-symbols.ts` (new): the pure encoders and decoders (class and instance paths, symbol list request and reply, template attributes and body, identity). The `ListIdentity` reply is decoded in `eip-discovery.ts`.
-   `eip-address.ts`: `parseEipEndpoint` for `eip://host[:port][/route/]` without a tag path, and `eipEndpointUri` for the reverse. `parseEipHref` keeps rejecting an href without a tag path. Both share the URL parsing.
-   `eip-browse.ts` (new): `EipBrowser` over an `EipSession` that pages the lists, builds structure definitions with a template cache, and a pure `buildThingDescription` that maps the result to a TD (section 10.3). Keeping the mapping pure makes it testable without a socket.
-   `eip-discovery.ts` (new): a `dgram` based `ListIdentity` broadcast. Binds to a chosen local interface and computes the subnet broadcast address from `os.networkInterfaces()`, as UA-EdgeTranslator does. Reply parsing is a pure function. It also needs a unicast mode, which makes it testable on 127.0.0.1.
-   `eip.ts` and the factory: export the new functions. `EipClient` owns the session map, so `requestThingDescription` reuses the session for that endpoint.

No new runtime dependency is needed. `dgram` and `os` are Node built-ins, and the CIP layer is already in house.

A second use of the same code: `EipConnection` could resolve the live structure of a tag with the browser and a per-endpoint template cache, and compare it with the embedded definition as UA-EdgeTranslator does. That closes the "live definition should be preferred" item of section 1. It changes read and write behaviour, so it should be a separate step with its own tests, and probably opt-in.

### 10.5 Decisions

1.  **Scope of the first version: controller-scope tags only**, as in UA-EdgeTranslator. Program scope (one extra list per program, `Program:<name>.<tag>` hrefs) is a later step. Program tags still work when written by hand.
2.  **Default filtering: everything, with a filter option.** This matches UA-EdgeTranslator and the sample TD, which contains I/O module tags such as `Local:2:O`. Every generated property is observable, so a large controller makes a TD that polls thousands of tags once consumed. The filter option is how the caller prevents that.
3.  **Title and id: product name from the identity plus the host**, for example `1756-L83E/B @ 192.168.100.218`. The id is derived from host, port and route. The options function can override both.
4.  **Custom string types: skip and report.** Only the built-in `STRING` is generated, as `eipv:STRING`.
5.  **Skipped tags: return them and log them.** The options function returns the TD and a list of skipped tags with reasons. `requestThingDescription` logs a warning summary.
6.  **Controller families: ControlLogix and CompactLogix.** Micro800 and the PCCC families are rejected with a clear error, as in section 6.
7.  **Discovery: an exported function in the binding.** No change in core.

### 10.6 Testing strategy

-   **Real replies are recorded** from the Allen-Bradley PLC of the sample TD in `test/eip-browse-fixtures.ts`: identity, `ListIdentity`, both pages of the symbol list and the templates `AB:1756_DO:O:0`, `UDT_Shift_Data`, `IO_Control`, `TIMER` and `STRING`. The decoder tests use them. A BOOL, array or nested member in a user-defined type is not in the recording, because the sample project has none.
-   **Decoder unit tests** from those fixtures and from hand-built buffers: paging boundaries, an entry split across pages (must not happen, but a truncated entry has to fail cleanly), hidden members, BOOL bits, array members, nested definitions, unsupported types.
-   **Builder tests** (pure): the output for a given browse result, every form accepted by `validateEipForm`, the whole TD accepted by the core `isThingDescription`, and relative hrefs that resolve to the right absolute URI with `parseEipHref` (use the table in section 3).
-   **Fake controller.** `FakeEipServer` needs class and instance segments in `decodePath` and handlers for the tag list (with a small page size so paging is exercised) and the template services. Seed it from `Rockwell.td.jsonld` so the browse result can be compared with the hand-written fields (ignoring `uav:` terms).
-   **End-to-end:** `WoT.requestThingDescription("eip://127.0.0.1:<port>/1,0/")`, `WoT.consume`, then `readProperty` for each generated property, through a real `Servient`, as the existing servient test does.
-   **Discovery:** a local UDP responder with canned `ListIdentity` replies and a unicast target. The interface selection logic can be tested with injected interface lists.
-   **Hardware run** with the existing example: browse, save the TD, compare it with `Rockwell.td.jsonld`, consume it and read every property.

### 10.7 Verification against the controller

The controller of the sample TD (1756-L81E/B, firmware 30.11, route `1,0`, 15 symbols) was used for the checks below. The recorded replies are in `test/eip-browse-fixtures.ts`, and `examples/eip-binding/eip-browse.js` repeats the live run.

Confirmed:

-   **Tag list.** Attributes 1, 2, 7, 8 and 10 are accepted. The reply per entry is instance id, name (16-bit length and bytes), type word, element length, three 32-bit dimensions and one byte of external access. Without attribute 7 the element length is missing, so the entry layout follows the requested set. Paging with status `0x06` and the next start instance works (the controller list takes two pages over unconnected messaging).
-   **Type word.** Program, task, map and connection entries have bit 12 set. `Production_Data` is `0x861E`: bit 15 and template id 1566. Its element length is 36, the size of `UDT_Shift_Data`.
-   **Templates.** Attributes 4, 5, 2 and 1 come back in the requested order. Reading with `definition words * 4 - 23` returns the whole definition. `- 21` also works and returns two bytes more, and a count of `definition words * 4` fails with status `0xFF`. The body has bytes after the last member name, so the member names are read by count.
-   **Template members.** Info word, type word and 32-bit offset, as described. The array flag is bit 13 of the member type and the info word then holds the element count (`STRING.DATA` is `0x20C2` with 82). BOOL members have the bit number in the info word and the offset of the host byte (`TIMER.EN` is bit 7 of byte 3). The predefined `TIMER` lists a visible `Control` member that overlaps its bits, which is why predefined types hide `Control` and `CTL`. The type name of the string type is `STRING` on this firmware (not `ASCIISTRING82`, which is also accepted).
-   **Identity.** Get Attributes All on class `0x01` returns vendor, device type, product code, revision, status, serial number and product name, and goes to the CPU in slot 0 when sent over the route `1,0`.
-   **ListIdentity.** The UDP broadcast on every local interface found the controller, and the reply layout is as described. The state byte follows the product name.
-   **Generated TD.** The structure definitions for the four tags are identical to the hand-written ones in `Rockwell.td.jsonld` (names, types, offsets), and `WoT.consume` and `readProperty` work on all four properties.

Differences to the hand-written TD:

-   `Local:2:O`, `Production_Data` and `Previous_Shift_Production_Data` report external access 2 and are generated without `writeproperty`. Only `IO_Control` (external access 0) is writable. The mapping 0 = read/write, 2 = read only, 3 = none follows pycomm3 and the tag settings in Studio 5000. A write to one of the read-only tags was not tried against the controller, to confirm that it is rejected.
-   The TD has an `id`, a `title` and `eipv:controller`, which the hand-written one lacks.

Not verified:

-   BOOL members, array members and nested structures in user-defined types, and arrays of structures. The sample project has none, and the controller templates for these cases were not recorded. The `TIMER` and `STRING` templates cover BOOL bits and array members of predefined types. The other cases are tested only against templates built in the tests.
-   CompactLogix, and the default route `1,0` on it.
-   The time a browse takes on a controller with thousands of tags over unconnected messaging.
-   The 32-bit instance segment. Instances above 65535 are rejected with a clear error.
