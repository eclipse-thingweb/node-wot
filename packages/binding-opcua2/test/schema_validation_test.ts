import { expect } from "chai";
import { DataType, DataValue, StatusCodes, VariantArrayType } from "node-opcua-client";
import { opcuaJsonEncodeDataValue } from "node-opcua-json";
import { schemaDataValueValidate, schemaDataValueJSONValidate } from "../src/codec";

const data = {
    uint32: new DataValue({
        statusCode: StatusCodes.Good,
        value: {
            dataType: DataType.UInt32,
            value: 42,
        },
    }),

    "string array": new DataValue({
        sourcePicoseconds: 10,
        sourceTimestamp: new Date(1909, 12, 31),
        statusCode: StatusCodes.BadAggregateInvalidInputs,
        value: {
            dataType: DataType.String,
            value: ["Hello", "World"],
        },
    }),
    "current time": new DataValue({
        sourcePicoseconds: 10,
        sourceTimestamp: new Date(1909, 12, 31),
        statusCode: StatusCodes.BadAggregateInvalidInputs,
        value: {
            dataType: DataType.DateTime,
            value: [new Date(2019, 11, 23)],
        },
    }),

    matrix: new DataValue({
        serverPicoseconds: 10,
        serverTimestamp: new Date(1909, 12, 31),
        statusCode: StatusCodes.BadAggregateInvalidInputs,
        value: {
            dataType: DataType.UInt64,
            arrayType: VariantArrayType.Matrix,
            dimensions: [2, 3],
            value: [1, 2, 3, 4, 5, 6],
        },
    }),
    null: new DataValue({}),
};

describe("schemas", () => {
    describe("schemaDataValue", () => {
        Object.entries(data).forEach(([name, obj1]) => {
            it("(experimental) " + name, () => {
                const validate = schemaDataValueValidate;

                const obj1 = new DataValue({}).toJSON();
                const isValid = validate(obj1);
                if (!isValid) {
                    console.log(isValid);
                    console.log(validate.errors);
                    console.log(obj1);
                }
                // console.log(obj1);
                expect(isValid).equal(true);
            });
        });
    });
    describe("schemaDataValueJSON", () => {
        const validate = schemaDataValueJSONValidate;

        Object.entries(data).forEach(([name, obj1]) => {
            it("DataValue " + name, () => {
                const dataValueJSON = JSON.parse(JSON.stringify(opcuaJsonEncodeDataValue(obj1, true)));

                const isValid = validate(dataValueJSON);
                if (!isValid) {
                    console.log(isValid);
                    console.log(validate.errors);
                    console.log(dataValueJSON);
                }

                expect(isValid).eql(true);
            });
        });
    });
});
