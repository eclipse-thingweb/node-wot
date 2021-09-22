/********************************************************************************
 * Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
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

import { ProtocolHelpers } from "@node-wot/core";
import { expect, should, assert } from "chai";
import { fail } from "assert";
import { Readable } from "stream";
import OpcuaCodec from "../src/codecs/opcua-codec";
import * as TD from "@node-wot/td-tools";
// should must be called to augment all variables
should();

import OpcuaClient from "../src/opcua-client";
import { OpcuaServer } from "./opcua-server";
import { DataType } from "node-opcua-client";

describe("OPCUA client test", function () {
    let server: OpcuaServer;
    let codec: OpcuaCodec;
    try {
        server = new OpcuaServer();
        codec = new OpcuaCodec();
    } catch (err) {
        console.log(err);
        throw new Error(err);
    }
    let client: OpcuaClient = new OpcuaClient();

    before(async function () {
        this.timeout(10000);
        try {
            await server.start();
        } catch (err) {
            return new Error(err);
        }
    });

    it("should read a property", async function () {
        // invoke with defaults
        let inputVector = {
            op: ["readProperty"],
            form: {
                href: "opc.tcp://localhost:5050/ns=1;b=9998FFAA",
                "opc:method": "READ",
            },
        };
        let res = await client.readResource(inputVector.form);
        let buffer = await ProtocolHelpers.readStreamFully(res.body);
        let val = JSON.parse(buffer.toString()).value.value;
        expect(val).to.equal(1);

        return;
    });

    it("should fail to read a property because of a wrong node", async function () {
        // invoke with defaults
        let inputVector = {
            op: ["readProperty"],
            form: {
                href: "opc.tcp://localhost:5050/ns=1;b=9998FFAA",
                "opc:method": "READ",
            },
        };
        try {
            let res = await client.readResource(inputVector.form);
        } catch (err) {
            expect(err.message).to.equal("Error: Error while reading property");
        }
        return;
    });

    it("should write a property", async function () {
        let value = 1;
        let schema: any = {
            "opc:dataType": "Double",
            constructor: {
                name: "ConsumedThingProperty",
            },
        };
        let payload = codec.valueToBytes(value, schema);

        // invoke with defaults
        let inputVector = {
            op: ["writeProperty"],
            form: {
                href: "opc.tcp://localhost:5050/ns=1;b=9998FFAA",
                "opc:method": "WRITE",
            },
        };
        /*
        let schema = {
            "opc:dataType": "Double"
        }
        let res = await client.writeResource(inputVector.form, { type: 'application/x.opcua-binary', body: Readable.from(Buffer.from(inputVector.payload)) });
        */
        let res = await client.writeResource(inputVector.form, {
            type: "application/x.opcua-binary",
            body: Readable.from(payload),
        });
        expect(res).to.equal(undefined);
        return;
    });

    it("should write a property with a string as nodeId", async function () {
        let value = "Ciao";
        let schema: any = {
            "opc:dataType": "String",
            constructor: {
                name: "ConsumedThingProperty",
            },
        };
        let payload = codec.valueToBytes(value, schema);

        // invoke with defaults
        let inputVector = {
            op: ["writeProperty"],
            form: {
                href: "opc.tcp://localhost:5050/ns=1;s=Case_Lamp_Variable",
                "opc:method": "WRITE",
            },
        };
        let res = await client.writeResource(inputVector.form, {
            type: "application/x.opcua-binary",
            body: Readable.from(payload),
        });
        expect(res).to.equal(undefined);
        return;
    });

    it("should write a property with a string with quotes as nodeId", async function () {
        let value = "Ciao";
        let schema: any = {
            "opc:dataType": "String",
            constructor: {
                name: "ConsumedThingProperty",
            },
        };
        let payload = codec.valueToBytes(value, schema);

        /*
        try {
            let res = await client.writeResource(inputVector.form, { type: 'application/x.opcua-binary', body: Readable.from(Buffer.from(inputVector.payload))});
        } catch(err) {
            expect(err.message).to.equal("Mandatory \"schema\" field missing in the TD");
        }
        try {
            let res = await client.writeResource(inputVector.form, { type: 'application/x.opcua-binary', body: Readable.from(Buffer.from(inputVector.payload))});
        */
        // invoke with defaults
        let inputVector = {
            op: ["writeProperty"],
            form: {
                href: 'opc.tcp://localhost:5050/ns=1;s="Case_Lamp_Variable"',
                "opc:method": "WRITE",
            },
        };
        let res = await client.writeResource(inputVector.form, {
            type: "application/x.opcua-binary",
            body: Readable.from(payload),
        });
        expect(res).to.equal(undefined);
        return;
    });

    it("should fail to write a property because of missing schema information", async function () {
        let value = 1;
        let schema: any = {
            "opc:wrongField": "Double",
            title: "test",
            constructor: {
                name: "ConsumedThingProperty",
            },
        };
        try {
            let payload = codec.valueToBytes(value, schema);
        } catch (err) {
            expect(err.message).to.equal('opc:dataType field not specified for property "test"');
        }

        return;
    });

    it("should invoke an action", async function () {
        // invoke with defaults
        let inputVector = {
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

        let res = await client.invokeResource(inputVector.form, {
            type: "application/x.opcua-binary",
            body: Readable.from(Buffer.from(inputVector.payload)),
        });
        let val = res.body.value;
        expect(val).to.equal(5);

        return;
    });

    it("should not receive a result by invoking an action because a wrong method", async function () {
        // invoke with defaults
        let inputVector = {
            op: ["invokeAction"],
            form: {
                href: "opc.tcp://localhost:5050/ns=1;b=9990FFAA;mns=1;mb=9997FFAA",
                "opc:method": "RANDOM_METHOD",
            },
            payload: JSON.stringify({ a: 10, c: 2 }),
        };
        let schema = {
            type: "object",
            properties: {
                a: { type: "number", "opc:dataType": "Double" },
                c: { type: "number", "opc:dataType": "Double" },
            },
        };
        let res = await client.invokeResource(inputVector.form, {
            type: "application/x.opcua-binary",
            body: Readable.from(Buffer.from(inputVector.payload)),
        });
        expect(res).to.equal(undefined);
        return;
    });

    it("should subscribe to a resource", async () => {
        // invoke with defaults
        let inputVector = {
            op: ["subscribeevent"],
            form: {
                href: "opc.tcp://localhost:5050/ns=1;b=9998FFAA",
                "opc:method": "SUBSCRIBE_PROPERTY",
            },
        };

        let times = 3;
        return new Promise(async function (resolve, reject) {
            let interval = setInterval(function () {
                server.forceValueChange();
            }, 1000);

            let res = await client.subscribeResource(inputVector.form, async (data) => {
                expect(data.body.value).to.greaterThan(0);
                times--;
                if (times === 0) {
                    clearInterval(interval);
                    resolve();
                }
            });
        });
    }).timeout(50000);

    it("should fail to subscribe to a resource because a wrong node", async function () {
        let inputVector = {
            op: ["subscribeevent"],
            form: {
                href: "opc.tcp://localhost:5050/ns=1;s=wrongNode",
                "opc:method": "SUBSCRIBE_PROPERTY",
            },
        };
        try {
            let res = await client.subscribeResource(inputVector.form, () => {});
        } catch(err) {
            expect(err.message).to.equal("Error while subscribing property: BadNodeIdUnknown (0x80340000)");
            return;
        }
        fail("should not have succeeded");
    })

    it("should apply security", async function () {
        let metadata = [{ scheme: "nosec" }];
        let credentials = {
            username: "user",
            password: "test",
        };
        client.setSecurity(metadata, credentials);
        return;
    });

    after(async function () {
        try {
            await server.stop();
        } catch (err) {
            return new Error(err);
        }
    });

    it("should return the right opcua datatype", async function () {
        let value = "";
        let schema: any = {
            "opc:dataType": "Double",
            title: "test",
            constructor: {
                name: "ConsumedThingProperty",
            },
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
            let payload = JSON.parse(codec.valueToBytes(value, schema).toString());
            expect(payload.dataType).to.equal(DataType[type as any]);
        }

        return;
    });
});
