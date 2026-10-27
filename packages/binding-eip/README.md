# EtherNet/IP binding for node-wot: analysis

Status: analysis only, no code yet.

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

| Term                                                    | Meaning                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `eipv:type`                                             | BOOL, SINT, INT, DINT, LINT, USINT, UINT, UDINT, ULINT, REAL, LREAL, BYTE, WORD, DWORD, LWORD, STRING (CIP codes `0xC1`-`0xD4`, `0xA0`) |
| `eipv:structureDefinition`                              | `eipv:typeName`, `eipv:fields[]`, `eipv:byteSize` (required for array elements)                                          |
| field: `eipv:name`, `eipv:byteOffset`                   | required for every field                                                                                                 |
| field: `eipv:type` or nested `eipv:structureDefinition` | exactly one                                                                                                              |
| field: `eipv:bitOffset`                                 | required for BOOL fields                                                                                                 |
| field: `eipv:dimensions`                                | array members (not BOOL or STRING)                                                                                       |
| `eipv:service`                                          | ReadTag, ReadTagFragmented, WriteTag, WriteTagFragmented, ExecutePCCC                                                    |
| `eipv:pollingTime`, `eipv:timeout`                      | milliseconds                                                                                                             |
| `eipv:scale`, `eipv:offset`                             | `value = raw * scale + offset`; `scale` must not be 0                                                                    |
| `eipv:dimensions`, `eipv:elementCount`                  | array transfer; `elementCount` requires `dimensions`                                                                     |

### Operations

Only `readproperty`, `writeproperty` and `observeproperty` are mapped. Observe is realized by polling. `invokeaction`, `subscribeevent`, `unsubscribeevent` and Event affordances have no mapping.

| Operation                    | Symbolic families                            | PCCC families                       |
| ---------------------------- | -------------------------------------------- | ----------------------------------- |
| `readproperty`               | Read Tag `0x4C` (Read Tag Fragmented `0x52`) | Execute PCCC `0x4B`, class `0x67`   |
| `writeproperty`              | Write Tag `0x4D` (Fragmented `0x53`)         | Execute PCCC                        |
| `observeproperty`            | repeated read, interval `eipv:pollingTime`   | repeated read                       |

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
    -   `requestThingDescription` is not implemented.
    -   `setSecurity` accepts `nosec` only.
    -   `start`/`stop` manage sessions and subscriptions.

### Content handling

-   The client is not given the Property data schema, so Modbus's raw octet-stream approach does not fit.
-   Template: the OPC UA client (`packages/binding-opcua/src/opcua-protocol-client.ts`, `_dataValueToContent`). It decodes the wire bytes and returns JSON `Content`.
-   On write it parses incoming `Content` through `ContentSerdes` into a value, then encodes it.

### Href resolution

Core normalizes `base` into relative hrefs in `packages/core/src/serdes.ts`. Verified with `url-toolkit` and `new URL` in a temp directory:

| base                                           | href                              | resolved                                                             |
| ---------------------------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| `eip://192.168.178.122/1,0/`                   | `./Local:2:O`                     | `eip://192.168.178.122/1,0/Local:2:O`                                |
| `eip://192.168.178.122/1,0/`                   | `Production_Data`                 | `eip://192.168.178.122/1,0/Production_Data`                          |
| `eip://10.0.0.1:44819/1,4,2,192.168.1.20,1,0/` | `Recipe%5B3%5D.SetPoint`          | `eip://10.0.0.1:44819/1,4,2,192.168.1.20,1,0/Recipe%5B3%5D.SetPoint` |
| `eip://[::1]/1,0/`                             | `./Program:Packaging.Counter`     | `eip://[::1]/1,0/Program:Packaging.Counter`                          |
| `eip://h/1,0` (no trailing slash)              | `MotorSpeed`                      | `eip://h/MotorSpeed` (route is lost)                                 |

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
