/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0, or the W3C Software Notice and
 * Document License (2015-05-13) which is available at
 * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.
 *
 * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513
 ********************************************************************************/
import Ajv from "ajv/dist/core";
import { expect } from "chai";

import { ContentSerdes, createLoggers } from "@node-wot/core";

import { VariableIds, OPCUAServer } from "node-opcua";

import { OPCUAProtocolClient, OPCUAForm } from "../src/opcua-protocol-client";
import { OpcuaJSONCodec, schemaDataValue } from "../src/codec";
import { startServer } from "./fixture/basic-opcua-server";

const { debug } = createLoggers("binding-opcua", "opcua-protocol-client");

describe("OPCUA Client", function () {
    this.timeout(60000);

    let opcuaServer: OPCUAServer;
    let endpoint: string;
    before(async () => {
        opcuaServer = await startServer();
        endpoint = opcuaServer.getEndpointUrl();
        debug(`endpoint = ${endpoint}`);
    });
    before(() => {
        // ensure codec is loaded
        const codecSerDes = ContentSerdes.get();
        codecSerDes.addCodec(new OpcuaJSONCodec());
    });

    let client: OPCUAProtocolClient;
    before(async function () {
        client = new OPCUAProtocolClient();
    });
    after(async () => {
        await client.stop();
    });
    // server shall stop after client
    after(async () => {
        await opcuaServer.shutdown();
    });

    [
        // 0
        { contentType: "application/json", expected: "2022-01-31T10:45:00.000Z" },
        // 1
        {
            contentType: "application/opcua+json",
            expected: {
                SourceTimestamp: "*",
                Value: {
                    Type: 13,
                    Body: new Date("2022-01-31T10:45:00.000Z"),
                },
            },
        },
        // 2
        {
            contentType: "application/opcua+json;type=DataValue",
            expected: {
                SourceTimestamp: "*",
                Value: {
                    Type: 13,
                    Body: new Date("2022-01-31T10:45:00.000Z"),
                },
            },
        },
        // 3
        {
            contentType: "application/opcua+json;type=Variant",
            expected: {
                Type: 13,
                Body: new Date("2022-01-31T10:45:00.000Z"),
            },
        },
        // 4
        {
            contentType: "application/opcua+json;type=Value;dataType=DateTime",
            expected: new Date("2022-01-31T10:45:00.000Z"),
        },
    ].forEach(({ contentType, expected }, index) => {
        it(`Y1a-${index} should read a topic with contentType= ${contentType}`, async () => {
            const readForm: OPCUAForm = {
                href: endpoint,
                "opcua:nodeId": "ns=1;s=ManufacturingDate",
                contentType,
            };

            const content = await client.readResource(readForm);
            const content2 = { ...content, body: await content.toBuffer() };

            debug(`readResource returned: ${content2.body.toString("ascii")}`);

            const codecSerDes = ContentSerdes.get();
            const dataValue = codecSerDes.contentToValue(content2, schemaDataValue) as Record<string, unknown>;

            // (deal with always changing date )
            if (dataValue.SourceTimestamp != null) {
                expect(dataValue.SourceTimestamp).to.be.instanceOf(Date);
                dataValue.SourceTimestamp = "*";
            }
            debug(`${dataValue}`);
            expect(dataValue).to.eql(expected);
        });
        it(`Y1b-${index} should read a topic with contentType= ${contentType}`, async () => {
            const readForm: OPCUAForm = {
                href: endpoint + "?id=ns=1;s=ManufacturingDate",
                contentType,
            };

            const content = await client.readResource(readForm);
            const content2 = { ...content, body: await content.toBuffer() };

            debug(`readResource returned: ${content2.body.toString("ascii")}`);

            const codecSerDes = ContentSerdes.get();
            const dataValue = codecSerDes.contentToValue(content2, schemaDataValue) as Record<string, unknown>;

            // (deal with always changing date )
            if (dataValue.SourceTimestamp != null) {
                expect(dataValue.SourceTimestamp).to.be.instanceOf(Date);
                dataValue.SourceTimestamp = "*";
            }
            debug(`${dataValue}`);
            expect(dataValue).to.eql(expected);
        });
    });

    it("Y2 - should subscribe to a topic", async () => {
        const form: OPCUAForm = {
            href: endpoint,
            "opcua:nodeId": VariableIds.Server_ServerStatus_CurrentTime,
        };

        let counter = 0;
        const sub = await client.subscribeResource(form, async () => {
            counter++;
            if (counter > 3) {
                // await client.unlinkResource(form);
                sub.unsubscribe();
            }
        });
    });

    it("Y3 - should subscribe to many topics but establish the opcua connection once", async () => {
        const form: OPCUAForm = {
            href: endpoint,
            "opcua:nodeId": VariableIds.Server_ServerStatus_CurrentTime,
        };

        await new Promise<void>((resolve) => {
            let counter = 0;
            const onSubscribedValueChanged = async () => {
                counter++;
                if (counter > 3) {
                    await client.unlinkResource(form);
                    resolve();
                }
            };
            client.subscribeResource(form, onSubscribedValueChanged).catch((err) => {
                debug("Error in subscribeResource 1:", err);
            });
            client.subscribeResource(form, onSubscribedValueChanged).catch((err) => {
                debug("Error in subscribeResource 2:", err);
            });
            client.subscribeResource(form, onSubscribedValueChanged).catch((err) => {
                debug("Error in subscribeResource 3:", err);
            });
            client.subscribeResource(form, onSubscribedValueChanged).catch((err) => {
                debug("Error in subscribeResource 4:", err);
            });
        });
    });

    it("Y4 - invokeResource", async () => {
        const inputSchema = {
            type: "object",
            properties: {
                TargetTemperature: { type: "number" },
            },
            required: ["TargetTemperature"],
        };

        const form: OPCUAForm = {
            href: endpoint,
            "opcua:nodeId": { root: "i=84", path: "/Objects/1:MySensor" },
            "opcua:method": { root: "i=84", path: "/Objects/1:MySensor/2:MethodSet/1:SetTemperatureSetPoint" },
        };
        const contentType = "application/json";
        const contentSerDes = ContentSerdes.get();

        const value = { TargetTemperature: 25 }; // inputSchema
        const ajv = new Ajv({ strict: false });
        expect(ajv.compile(inputSchema)(value)).to.equal(true);

        const content = contentSerDes.valueToContent(value, schemaDataValue, contentType);

        const contentResult = await client.invokeResource(form, content);

        const contentResult2 = { ...contentResult, body: await contentResult.toBuffer() };
        const codecSerDes = ContentSerdes.get();
        const outputArguments = codecSerDes.contentToValue(contentResult2, schemaDataValue);
        debug(`Y4: outputArguments: ${outputArguments}`);

        if (outputArguments == null) {
            expect.fail("outputArguments is null");
        }
        outputArguments.should.eql({ PreviousSetPoint: 27 });
    });
});
