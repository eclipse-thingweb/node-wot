# Modbus bitmap example (SIEMENS SENTRON PAC4220)

Reads the 32-bit "Limit Violations" word of a PAC4220 and exposes its bits as an object of named booleans, using the data-mapping pipeline (`map:valueMapping`, `bitExtract`). The analysis behind this is user story 5 ("Structured and Simple Data Mismatch") of the WoT data-mapping work, see [w3c/wot-thing-description#1930](https://github.com/w3c/wot-thing-description/issues/1930).

## Run

```sh
npm run build   # repository root
node examples/datamapping/modbus-bitmap/pac4220-limit-violations.js
```

The device address (`192.168.100.110:502`, unit ID `1`) is hard-coded in the `href` of each form in [pac4220.td.json](pac4220.td.json). The script is read-only.

It reads three properties:

| Property             | Purpose                                                                     |
| -------------------- | --------------------------------------------------------------------------- |
| `voltageL1N`         | `float32` at address 1; a plausible voltage confirms address and byte order |
| `limitViolationsRaw` | the unmapped 32-bit word at address 203 (printed in hex)                    |
| `limitViolations`    | the same word decoded into 17 booleans via `bitExtract`                     |

## Status

-   Runs without errors against a real PAC4220: `voltageL1N` returned about 220 V, `limitViolations` returned all 17 flags.
-   At that time the device reported no violations (raw word `0x00000000`), so **the bit-to-flag assignment is not yet verified on hardware**.
-   Only the `fromWire` (read) direction is implemented. There is no `bitCompose` or `toWire`, so all properties are `readOnly` and the forms only list `readproperty`.
-   The implementation is a prototype in `packages/core` (`data-mapping.ts`) and is not part of a released node-wot.

## How it works

1. The Modbus binding returns the raw register bytes.
2. Because the form has a `map:fromWire` pipeline and an `application/octet-stream` content type, the word is decoded as an **unsigned integer** (`octv:byteLength`, `octv:byteOrder` are translated to the content-type parameters `length` and `byteSeq`) instead of with the application schema.
3. `bitExtract` computes `(word & mask) >> shift` for each field and builds the object.
4. The result is validated against the property's DataSchema.

## Assumptions

-   **Register layout** (from the PAC4200 System Manual, Appendix A.2.1, as quoted in issue #1930): offset 203, 2 registers, `Unsigned long`. "Byte 3" is taken as the most significant byte: limits 0-7 are bits 24-31, limits 8-11 are bits 16-19, the limit logic flag is bit 0, logic results 1-4 are bits 1-4. If Siemens counts bytes in transmission order, the groups are swapped.
-   **Address:** the form uses `203` as the wire address, and `1` for the voltage. The PlugFest TD for this device also uses offset-style addresses (`/1`, `/3`, ...), and the voltage check supports this, but `203` itself is unconfirmed. Try `202` if a triggered limit does not change the raw word.
-   **Word and byte order:** the first register is the high word, bytes are big-endian (`big_abcd` in the PlugFest TD). The voltage reading supports this for `float32`; the 32-bit integer is assumed to follow the same order.
-   **PAC4200 map for PAC4220:** the register map is taken from the PAC4200 manual.
-   **Entity and function:** holding registers (read function 3), as in the PlugFest TD.
-   **JSON-LD:** node-wot does not process the `@context`. The `map:`, `octv:` and `modv:` keys are matched literally, and the namespace URIs are placeholders.

## Limitations

-   The PlugFest TD ([sentronpac4220.td.json](https://github.com/w3c/wot-testing/blob/main/events/2026.10.Dublin/TDs/Siemens/sentronpac4220.td.json)) cannot be consumed by the current node-wot Modbus client as it is: it uses `modv:dataType`, `modv:endianness` and `modv:function`, which the client ignores, and its forms have no `contentType`. Its relative hrefs (`/1`) replace the whole path of the `base` URL, which the client then rejects as malformed. This TD therefore uses absolute `modbus+tcp://host:port/unitId/address?quantity=N` hrefs.
-   The wire value is always decoded as an integer. Signed codes need `signed=true` in the content type. Float wire values are not supported with `map:fromWire`.
-   `octv:byteOffset` other than 0 is rejected.
-   `bitExtract` input must be a non-negative safe integer (up to 2^53 - 1).
-   32-bit values spanning two registers have only been tested with the first register as the high word.

## Next steps

-   Trigger a limit on the device and compare the raw word with the extracted flags to confirm the bit assignment.
-   Implement `toWire` / `bitCompose` if writes are needed (this requires a policy for bits that are not listed).
