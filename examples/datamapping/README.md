# CSV Data-Mapping Example

This directory contains the first CSV payload-binding fixture for node-wot.

`toa5-weather.csv` is a TOA5-style CSV payload with metadata rows, a field-name row, units, aggregation qualifiers, and weather observations. `toa5-weather.td.json` describes four scalar values and one wind-speed time series. `toa5-weather.client.js` loads that TD, uses the file binding to read the CSV as `text/csv`, and loops over all five properties.

## Run

Build the core and file-binding packages, then run the client from the repository root:

```sh
npm run build --workspace packages/core
npm run build --workspace packages/binding-file
node examples/datamapping/toa5-weather.client.js
```

Expected output:

```text
timestamp: "2026-06-25 10:00:00"
airTemperature: 23.4
relativeHumidity: 56.2
windSpeed: 4.8
windSpeedSeries: [{"timestamp":"2026-06-25 10:00:00","value":4.8},{"timestamp":"2026-06-25 10:01:00","value":4.6}]
```

## Data-Mapping Pipeline

The current pipeline is:

```text
file bytes
	-> CSV text
	-> parsed CSV rows
	-> object rows
	-> selected cell
	-> coerced value
	-> DataSchema validation
	-> InteractionOutput.value()
```

For `airTemperature`, the intermediary formats are:

1. The file binding reads the CSV file as bytes and returns a `Content` object.
2. The CSV codec decodes the bytes as text, normally using UTF-8.
3. The CSV parser produces rows as arrays of strings.
4. `csvv:headerRow` and `csvv:metadataRows` identify the header and metadata rows. The remaining rows are converted into objects, for example:

	 ```json
	 [
			 {
					 "TIMESTAMP": "2026-06-25 10:00:00",
					 "RECORD": "1",
					 "AirTemp_C": "23.4",
					 "RH": "56.2",
					 "WindSpeed_ms": "4.8"
			 }
	 ]
	 ```

5. The `map:proc: "pick"` step with `jsonv:path: "/0/AirTemp_C"` selects the string `"23.4"`.
6. The `map:proc: "coerce"` step with `map:type: "number"` converts that string to the JavaScript number `23.4`.
7. The resulting value is validated against the property DataSchema before it is returned to the consumer.

The other properties use the same pipeline:

```text
/0/TIMESTAMP    -> "2026-06-25 10:00:00" -> string
/0/AirTemp_C    -> "23.4"                 -> 23.4
/0/RH           -> "56.2"                 -> 56.2
/0/WindSpeed_ms -> "4.8"                  -> 4.8
```

For `windSpeedSeries`, the CSV codec still decodes all rows. The `record` mapping applies nested `pick` and `coerce` pipelines to every row and produces one `{ "timestamp", "value" }` object per observation. CSV serialization and `toWire` mappings are not yet supported.

### node-wot Modules by Pipeline Stage

| Pipeline stage | Implementing module | Responsibility |
| --- | --- | --- |
| Open the local file and provide its bytes as `Content` | [`FileClient.readResource`](../../packages/binding-file/src/file-client.ts) | Resolves the `file:` form URI, opens a read stream, and applies the form's `contentType`. |
| Buffer the response and start `value()` processing | [`InteractionOutput.value()`](../../packages/core/src/interaction-output.ts) | Reads the content stream once for this interaction output, determines the media type, and starts decoding. |
| Select a decoder by media type | [`ContentSerdes.contentToValue()`](../../packages/core/src/content-serdes.ts) | Looks up the codec registered for `text/csv` and passes the bytes plus CSV options to it. |
| Decode CSV bytes into row values | [`CsvCodec.bytesToValue()`](../../packages/core/src/codecs/csv-codec.ts) | Decodes text, parses CSV records, removes configured header/metadata rows, and returns all data rows as arrays or header-keyed objects. |
| Normalize and validate form-level `csvv:*` settings | [`csvBindingOptionsFromForm()`](../../packages/core/src/csv-binding.ts) | Reads CSV terms from the form, applies defaults, and validates their values before codec use. |
| Select/coerce a scalar or project every row into a record | [`applyFromWireMapping()`](../../packages/core/src/data-mapping.ts) | Executes the ordered `map:fromWire` steps. `pick` selects a path, `coerce` converts a scalar, and `record` applies nested field pipelines to every array element. |
| Validate the mapped result against the TD DataSchema | [`InteractionOutput.value()`](../../packages/core/src/interaction-output.ts) | Runs AJV validation after mapping and returns the validated result. |

`InteractionOutput` caches the final value within that one output object, so
calling `value()` twice on the same result does not repeat its work. Separate
`readProperty()` calls create separate outputs and currently read and decode the
file independently; there is not yet a shared decoded-CSV cache across
properties.

## Storm Event Example

The larger `storm_data.csv` fixture contains 38 national weather service event
columns. The separate [storm-data.td.json](storm-data.td.json) describes every
column as a first-row property and adds `magnitudeSeries`, which applies
`record` to all rows using `BEGIN_DATE` as the timestamp and `MAGNITUDE` as the
value. Sparse event records preserve missing magnitudes as `null`.

Run it from the repository root after building core and the file binding:

```sh
node examples/datamapping/storm-data.client.js
```

## Row Representation, Selection, and Reuse

When mapping a large CSV, a consumer may want either one value from a selected
row or a collection such as a time series from every row. This raises three
related but separate questions: how each row is represented, which rows the
mapping uses, and whether the decoded CSV is reused across property reads.

`csvv:rowRepresentation` controls only the shape of an individual decoded row;
it does not select the number of rows:

- `array` represents a row by column position, for example
	`["1206990", "RUSSELL (ZONE)", "", ...]`. It is compact and works when
	column ordering is stable, but mappings depend on numeric indexes and are
	less self-describing.
- `object` represents a row by header or explicitly configured column names,
	for example `{ "EVENT_ID": "1206990", "CZ_NAME_STR": "RUSSELL (ZONE)" }`.
	It uses more memory, but mappings by column name are clearer and do not
	depend on column positions.

In both modes, the CSV codec currently decodes all data rows. A scalar mapping
such as `/0/MAGNITUDE` selects a field from the first row; the `record`
operation maps every row to produce a time series. For the storm archive and
similar datasets with many named columns, the recommended row representation is
`object`. Row selection should remain explicit in the generic mapping pipeline
rather than being implied by `rowRepresentation` or hidden inside CSV parsing.

There is currently no decoded-content cache shared between separate
`readProperty()` calls. As written, the storm client reads and parses the CSV
again for each property. That is acceptable for this demonstration, but it is
costly for a large file. The recommended runtime improvement is to reuse a
decoded row collection for forms referring to the same resource and decoding
configuration, or provide a batch/table read so several mappings can be
evaluated against one decode. Any cache needs an explicit invalidation policy
(for example file modification time or a bounded lifetime); consumers should
not be expected to implement this cache themselves.
