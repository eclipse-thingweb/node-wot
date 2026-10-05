/********************************************************************************
 * Copyright (c) 2026 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0 or the W3C Software Notice and
 * Document License (2015-05-13) which is available at
 * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.
 *
 * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513
 ********************************************************************************/

import { expect } from "chai";
import { ContentCodec, ContentDecodingContext, ContentSerdes } from "../src/content-serdes";
import { Content } from "../src/content";
import { InteractionOutput } from "../src/interaction-output";
import { Readable } from "stream";
import { csvBindingOptionsFromForm } from "../src/csv-binding";

describe("CSV codec", () => {
    it("should decode a TOA5-style payload into object rows", () => {
        const csv = [
            '"TOA5","CR1000","CR1000","12345","CR1000.Std.32.07","CPU:weather.CR1X","1234","Weather"',
            '"TIMESTAMP","RECORD","AirTemp_C","RH","WindSpeed_ms"',
            '"TS","RN","Deg C","%","m/s"',
            '"","","Avg","Avg","Avg"',
            '"2026-06-25 10:00:00",1,23.4,56.2,4.8',
        ].join("\n");

        expect(ContentSerdes.get().isSupported("text/csv")).to.equal(true);

        const value = ContentSerdes.get().contentToValue(
            { type: "text/csv", body: Buffer.from(csv) },
            { type: "array" },
            undefined,
            {
                form: {
                    "csvv:rowRepresentation": "object",
                    "csvv:headerRow": 1,
                    "csvv:metadataRows": [0, 2, 3],
                },
            }
        );

        expect(value).to.deep.equal([
            {
                TIMESTAMP: "2026-06-25 10:00:00",
                RECORD: "1",
                AirTemp_C: "23.4",
                RH: "56.2",
                WindSpeed_ms: "4.8",
            },
        ]);
    });

    it("should forward decoding context to non-CSV codecs", () => {
        let receivedContext: ContentDecodingContext | undefined;
        const codec: ContentCodec = {
            getMediaType: () => "application/x-context-test",
            bytesToValue(_bytes, _schema, _parameters, context) {
                receivedContext = context;
                return "decoded";
            },
            valueToBytes: () => Buffer.alloc(0),
        };
        ContentSerdes.get().addCodec(codec);

        const context: ContentDecodingContext = { form: { "test:option": "value" } };
        const value = ContentSerdes.get().contentToValue(
            { type: "application/x-context-test", body: Buffer.alloc(0) },
            { type: "string" },
            undefined,
            context
        );

        expect(value).to.equal("decoded");
        expect(receivedContext).to.equal(context);
    });

    it("should pass CSV form terms to the codec", async () => {
        const output = new InteractionOutput(
            new Content(
                "text/csv",
                Readable.from([
                    '"TOA5","CR1000","CR1000","12345","CR1000.Std.32.07","CPU:weather.CR1X","1234","Weather"',
                    '"TIMESTAMP","RECORD","AirTemp_C","RH","WindSpeed_ms"',
                    '"TS","RN","Deg C","%","m/s"',
                    '"","","Avg","Avg","Avg"',
                    '"2026-06-25 10:00:00",1,23.4,56.2,4.8',
                ].join("\n"))
            ),
            {
                href: "file:///tmp/toa5-weather.csv",
                contentType: "text/csv",
                "csvv:rowRepresentation": "object",
                "csvv:headerRow": 1,
                "csvv:metadataRows": [0, 2, 3],
            },
            { type: "array" }
        );

        expect(await output.value()).to.deep.equal([
            {
                TIMESTAMP: "2026-06-25 10:00:00",
                RECORD: "1",
                AirTemp_C: "23.4",
                RH: "56.2",
                WindSpeed_ms: "4.8",
            },
        ]);
    });

    it("should apply CSV defaults and validate form terms", () => {
        const options = csvBindingOptionsFromForm({
            "csvv:rowRepresentation": "object",
        });

        expect(options.delimiter).to.equal(",");
        expect(options.quoteChar).to.equal('"');
        expect(options.escapeChar).to.equal('"');
        expect(options.encoding).to.equal("utf8");
        expect(options.decimalSeparator).to.equal(".");
        expect(options.metadataRows).to.deep.equal([]);

        expect(() =>
            csvBindingOptionsFromForm({
                "csvv:rowRepresentation": "object",
                "csvv:delimiter": "||",
            })
        ).to.throw("csvv:delimiter must be a single character");
    });

    it("should select one CSV cell with the ordered from-wire mapping", async () => {
        const output = new InteractionOutput(
            new Content("text/csv", Readable.from('"AirTemp_C"\n23.4\n')),
            {
                href: "file:///tmp/toa5-weather.csv",
                contentType: "text/csv",
                "csvv:rowRepresentation": "object",
                "csvv:headerRow": 0,
                "map:valueMapping": {
                    "map:fromWire": [{ "map:proc": "pick", "jsonv:path": "/0/AirTemp_C" }],
                },
            },
            { type: "string" }
        );

        expect(await output.value()).to.equal("23.4");
    });

    it("should coerce a selected CSV cell to a number", async () => {
        const output = new InteractionOutput(
            new Content("text/csv", Readable.from('"AirTemp_C"\n23.4\n')),
            {
                href: "file:///tmp/toa5-weather.csv",
                contentType: "text/csv",
                "csvv:rowRepresentation": "object",
                "csvv:headerRow": 0,
                "map:valueMapping": {
                    "map:fromWire": [
                        { "map:proc": "pick", "jsonv:path": "/0/AirTemp_C" },
                        { "map:proc": "coerce", "map:type": "number" },
                    ],
                },
            },
            { type: "number" }
        );

        expect(await output.value()).to.equal(23.4);
    });

    it("should apply explicit decimal and missing-value coercion rules", async () => {
        const decimalOutput = new InteractionOutput(
            new Content("text/csv", Readable.from('"value"\n"23,4"\n')),
            {
                href: "file:///tmp/toa5-weather.csv",
                contentType: "text/csv",
                "csvv:rowRepresentation": "object",
                "csvv:headerRow": 0,
                "map:valueMapping": {
                    "map:fromWire": [
                        { "map:proc": "pick", "jsonv:path": "/0/value" },
                        { "map:proc": "coerce", "map:type": "number", "map:decimalSeparator": "," },
                    ],
                },
            },
            { type: "number" }
        );
        expect(await decimalOutput.value()).to.equal(23.4);

        const missingOutput = new InteractionOutput(
            new Content("text/csv", Readable.from('"value"\nNAN\n')),
            {
                href: "file:///tmp/toa5-weather.csv",
                contentType: "text/csv",
                "csvv:rowRepresentation": "object",
                "csvv:headerRow": 0,
                "map:valueMapping": {
                    "map:fromWire": [
                        { "map:proc": "pick", "jsonv:path": "/0/value" },
                        {
                            "map:proc": "coerce",
                            "map:type": "number",
                            "map:sentinels": ["NAN"],
                            "map:sentinelValue": null,
                        },
                    ],
                },
            },
            { type: "null" }
        );
        expect(await missingOutput.value()).to.equal(null);
    });

    it("should record every CSV row into a time series", async () => {
        const output = new InteractionOutput(
            new Content("text/csv", Readable.from('"TIMESTAMP","WindSpeed_ms"\n"10:00",4.8\n"10:01",4.6\n')),
            {
                href: "file:///tmp/toa5-weather.csv",
                contentType: "text/csv",
                "csvv:rowRepresentation": "object",
                "csvv:headerRow": 0,
                "map:valueMapping": {
                    "map:fromWire": [
                        {
                            "map:proc": "record",
                            "map:fields": {
                                timestamp: [{ "map:proc": "pick", "jsonv:path": "/TIMESTAMP" }],
                                value: [
                                    { "map:proc": "pick", "jsonv:path": "/WindSpeed_ms" },
                                    { "map:proc": "coerce", "map:type": "number" },
                                ],
                            },
                        },
                    ],
                },
            },
            {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        timestamp: { type: "string" },
                        value: { type: "number" },
                    },
                    required: ["timestamp", "value"],
                },
            }
        );

        expect(await output.value()).to.deep.equal([
            { timestamp: "10:00", value: 4.8 },
            { timestamp: "10:01", value: 4.6 },
        ]);
    });
});
