import { exist } from "should";

import { ContentSerdes, ProtocolHelpers } from "@node-wot/core";
import { ObjectSchema } from "@node-wot/td-tools";

import { DataValue } from "node-opcua-data-value";
import { DataType, VariantArrayType } from "node-opcua-variant";
import { coerceLocalizedText } from "node-opcua-data-model";

import { OpcuaBinaryCodec, OpcuaJSONCodec, theOpcuaBinaryCodec, theOpcuaJSONCodec } from "../src/codec";

const dataValue1 = new DataValue({});
const dataValue2 = new DataValue({
    serverTimestamp: new Date(Date.UTC(2021, 10, 11)),
    serverPicoseconds: 100,
    value: {
        dataType: DataType.String,
        arrayType: VariantArrayType.Array,
        value: ["hello", "world"],
    },
});
const dataValue3 = new DataValue({
    value: {
        dataType: DataType.LocalizedText,
        value: [coerceLocalizedText("a"), coerceLocalizedText("b")],
    },
});

describe("OPCUA Binary Serdes ", () => {
    [dataValue1, dataValue2, dataValue3].forEach((dataValue, index) => {
        const schema: ObjectSchema = { type: "object", properties: {} };
        it("should encode and decode a dataValue with application/opcua_binary codec " + index, () => {
            const payload = theOpcuaBinaryCodec.valueToBytes(dataValue, schema);
            const dataValueReloaded = theOpcuaBinaryCodec.bytesToValue(payload, schema);
            dataValue.toJSON().should.eql(dataValueReloaded.toJSON());
        });
        it("should encode and decode a dataValue with application/opcua_json codec " + index, () => {
            const payload = theOpcuaJSONCodec.valueToBytes(dataValue, schema);
            const dataValueReloaded = theOpcuaJSONCodec.bytesToValue(payload, schema);
            dataValue.toJSON().should.eql(dataValueReloaded.toJSON());
        });
    });

    const expected1 = [
        '{"Value":null}',
        '{"Value":{"Type":12,"Body":["hello","world"]},"ServerPicoseconds":100,"ServerTimestamp":"2021-11-11T00:00:00.000Z"}',
        '{"Value":{"Type":21,"Body":[{"Text":"a"},{"Text":"b"}]}}',
    ];
    [dataValue1, dataValue2, dataValue3].forEach((dataValue, index) => {
        it("should simplify  serialize deserialize with application/opcua-json;type=DataValue" + index, async () => {
            const serdes = ContentSerdes.get();
            serdes.addCodec(new OpcuaJSONCodec());
            serdes.addCodec(new OpcuaBinaryCodec());

            const schema: WoT.DataSchema = {};
            const contentType = "application/opcua-json;type=DataValue";
            exist(ContentSerdes.getMediaType(contentType));
            const payload = serdes.valueToContent(dataValue, schema, contentType);
            const body = await ProtocolHelpers.readStreamFully(payload.body);
            console.log(body.toString("ascii"));
            body.toString().should.eql(expected1[index]);
        });
        const expected2 = [
            "null",
            '{"Type":12,"Body":["hello","world"]}',
            '{"Type":21,"Body":[{"Text":"a"},{"Text":"b"}]}',
        ];
        it("should serialize deserialize with application/opcua-json;type=Variant" + index, async () => {
            const serdes = ContentSerdes.get();
            serdes.addCodec(new OpcuaJSONCodec());
            serdes.addCodec(new OpcuaBinaryCodec());

            const schema: WoT.DataSchema = {};
            const contentType = "application/opcua-json;type=Variant";
            exist(ContentSerdes.getMediaType(contentType));
            const payload = serdes.valueToContent(dataValue, schema, contentType);
            const body = await ProtocolHelpers.readStreamFully(payload.body);
            console.log(body.toString("ascii"));
            body.toString().should.eql(expected2[index]);
        });
    });
});
