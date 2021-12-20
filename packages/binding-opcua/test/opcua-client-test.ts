/********************************************************************************
 * Copyright (c) 2018 Contributors to the Eclipse Foundation
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

/**
 * Protocol test suite to test protocol implementations
 */

import { ProtocolHelpers, Content } from "@node-wot/core";
import * as TD from "@node-wot/td-tools";

import { expect, should, assert } from "chai";
import { fail } from "assert";
import { Readable } from "stream";
import { DataType, DataValue } from "node-opcua-client";

import OpcuaCodec from "../src/codecs/opcua-codec";
import OpcuaClient from "../src/opcua-client";
import { OpcuaServer } from "./opcua-server";

// should must be called to augment all variables
should();

describe("OPCUA client test", function () {
    this.timeout(20000);

    let server: OpcuaServer;
    let codec: OpcuaCodec;
    try {
        server = new OpcuaServer();
        codec = new OpcuaCodec();
    } catch (err) {
        console.log(err);
        throw new Error(err);
    }

    let client: OpcuaClient;
    before(async () => {
        await server.start();
        client = new OpcuaClient();
    });

    after(async () => {
        await client.stop();
        await server.stop();
    });

    async function getBody(content: Content): Promise<Record<string, unknown>> {
        const buffer = await ProtocolHelpers.readStreamFully(content.body);
        const val = JSON.parse(buffer.toString()).value.value;
        return val;
    }

    it("should read a property", async function () {
        // invoke with defaults
        const inputVector = {
            op: ["readProperty"],
            form: {
                href: "opc.tcp://localhost:5050/ns=1;s=9998FFAA",
                "opc:method": "READ",
            },
        };
        const content = await client.readResource(inputVector.form);
        const variant = await getBody(content);
        expect(variant).to.equal(1);
    });

    it("should fail to read a property because of a wrong node", async function () {
        // invoke with defaults
        const inputVector = {
            op: ["readProperty"],
            form: {
                href: "opc.tcp://localhost:5050/ns=1;s=WRONGNODE",
                "opc:method": "READ",
            },
        };
        let _err: Error;
        try {
            await client.readResource(inputVector.form);
        } catch (err) {
            _err = err as Error;
            return;
        }
        assert(_err, "expecting exception to be raised when reading wrong node");
        expect(_err.message).to.equal("Error: Error while reading property");
    });

    it("should write a property", async function () {
        const value = 1;

        const schema: TD.DataSchema = {
            type: "null",
            "opc:dataType": "Double",
        };
        const payload = codec.valueToBytes(value, schema);

        // invoke with defaults
        const inputVector = {
            op: ["writeProperty"],
            form: {
                href: "opc.tcp://localhost:5050/ns=1;s=9998FFAA",
                "opc:method": "WRITE",
            },
        };
        const res = await client.writeResource(inputVector.form, {
            type: "application/x.opcua-binary",
            body: Readable.from(payload),
        });
        expect(res).to.equal(undefined);
    });

    it("should write a property with a string as nodeId", async function () {
        const value = "Ciao";
        const schema: TD.DataSchema = {
            type: "null",
            "opc:dataType": "String",
        };
        const payload = codec.valueToBytes(value, schema);

        // invoke with defaults
        const inputVector = {
            op: ["writeProperty"],
            form: {
                href: "opc.tcp://localhost:5050/ns=1;s=Case_Lamp_Variable",
                "opc:method": "WRITE",
            },
        };
        const res = await client.writeResource(inputVector.form, {
            type: "application/x.opcua-binary",
            body: Readable.from(payload),
        });
        expect(res).to.equal(undefined);
    });

    it("should write a property with a string with quotes as nodeId", async function () {
        const value = "Ciao";
        const schema: TD.DataSchema = {
            type: "null",
            "opc:dataType": "String",
        };
        const payload = codec.valueToBytes(value, schema);

        // invoke with defaults
        const inputVector = {
            op: ["writeProperty"],
            form: {
                href: 'opc.tcp://localhost:5050/ns=1;s="Case_Lamp_Variable"',
                "opc:method": "WRITE",
            },
        };
        const res = await client.writeResource(inputVector.form, {
            type: "application/x.opcua-binary",
            body: Readable.from(payload),
        });
        expect(res).to.equal(undefined);
    });

    it("should fail to write a property because of missing schema information", async function () {
        const value = 1;
        const schema = {
            "opc:wrongField": "Double",
            title: "test",
        };
        try {
            const payload = codec.valueToBytes(value, schema as unknown as TD.DataSchema);
            payload.should.be.instanceOf(Buffer);
        } catch (err) {
            expect(err.message).to.equal('opc:dataType field not specified for property "test"');
        }
    });

    it("should invoke an action", async function () {
        // invoke with defaults
        const inputVector = {
            op: ["invokeAction"],
            form: {
                href: "opc.tcp://localhost:5050/ns=1;s=device;mns=1;ms=method",
                "opc:method": "CALL_METHOD",
            },
            payload: JSON.stringify({
                inputArguments: [
                    { dataType: 11, value: 10 },
                    { dataType: 11, value: 2 },
                ],
            }),
        };

        const result = await client.invokeResource(inputVector.form, {
            type: "application/x.opcua-binary",
            body: Readable.from(Buffer.from(inputVector.payload)),
        });

        const payload = await ProtocolHelpers.readStreamFully(result.body);
        console.log(" payload = ", payload.toString("ascii"));

        const returnValue = payload && payload.length ? JSON.parse(payload.toString("ascii"))[0] : null;

        expect(returnValue?.value).to.equal(5);
    });

    it("should raise an exception if an action is invoked with a wrong method", async function () {
        // invoke with defaults
        const inputVector = {
            op: ["invokeAction"],
            form: {
                href: "opc.tcp://localhost:5050/ns=1;s=9990FFAA;mns=1;ms=9997FFAA",
                "opc:method": "RANDOM_METHOD",
            },
            payload: JSON.stringify({ a: 10, c: 2 }),
        };

        try {
            await client.invokeResource(inputVector.form, {
                type: "application/x.opcua-binary",
                body: Readable.from(Buffer.from(inputVector.payload)),
            });
        } catch (err) {
            console.log("res = ", err.message);
            return;
        }
        assert(false, "expecting invokeResource to raise an exception because opc:method is incorrect");
    });

    it("should subscribe to a resource", async () => {
        // invoke with defaults
        const inputVector = {
            op: ["subscribeevent"],
            form: {
                href: "opc.tcp://localhost:5050/ns=1;s=9998FFAA",
                "opc:method": "SUBSCRIBE_PROPERTY",
            },
        };

        const dataCollected: DataValue[] = [];
        await new Promise<void>((resolve) => {
            (async () => {
                let times = 3;
                const interval = setInterval(() => {
                    server.forceValueChange();
                }, 1000);

                const subscription = await client.subscribeResource(inputVector.form, async (content: Content) => {
                    const body = JSON.parse((await ProtocolHelpers.readStreamFully(content.body)).toString("ascii"));
                    dataCollected.push(body);
                    console.log("[binding_http-test", "tick", body);
                    times--;
                    if (times === 0) {
                        clearInterval(interval);
                        subscription.unsubscribe();
                        resolve();
                    }
                });
            })();
        });
        console.log("dataCollected = ", dataCollected);
        expect(dataCollected.length).to.be.greaterThanOrEqual(3);
        expect(dataCollected[0].value.value).to.be.greaterThan(0);
        expect(dataCollected[1].value.value).to.be.greaterThan(0);
        expect(dataCollected[2].value.value).to.be.greaterThan(0);
    }).timeout(50000);

    it("should fail to subscribe to a resource because a wrong node", async function () {
        const inputVector = {
            op: ["subscribeevent"],
            form: {
                href: "opc.tcp://localhost:5050/ns=1;s=wrongNode",
                "opc:method": "SUBSCRIBE_PROPERTY",
            },
        };
        try {
            await client.subscribeResource(inputVector.form, () => {
                /** empty */
            });
        } catch (err) {
            expect(err.message).to.equal("Error while subscribing property: BadNodeIdUnknown (0x80340000)");
            return;
        }
        fail("should not have succeeded");
    });

    it("should apply security", async function () {
        const metadata = [{ scheme: "nosec" }];
        const credentials = {
            username: "user",
            password: "test",
        };
        client.setSecurity(metadata, credentials);
    });

    it("should return the right opcua datatype", async function () {
        const value = "";
        const schema: TD.DataSchema = {
            type: "null",
            "opc:dataType": "Double",
            title: "test",
        };
        const dataTypes = [
            "Null",
            "Boolean",
            "SByte",
            "Byte",
            "Int16",
            "UInt16",
            "Int32",
            "UInt32",
            "Int64",
            "UInt64",
            "Float",
            "Double",
            "String",
            "DateTime",
            "Guid",
            "ByteString",
            "XmlElement",
            "NodeId",
            "ExpandedNodeId",
            "StatusCode",
            "QualifiedName",
            "LocalizedText",
            "ExtensionObject",
            "DataValue",
            "Variant",
            "DiagnosticInfo",
        ];
        for (const type of dataTypes) {
            schema["opc:dataType"] = type;
            const payload = JSON.parse(codec.valueToBytes(value, schema).toString());
            expect(payload.dataType).to.equal(DataType[type as never]);
        }
    });
});
