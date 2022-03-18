/********************************************************************************
 * Copyright (c) 2019 Contributors to the Eclipse Foundation
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

import { should } from "chai";
import * as chai from "chai";
import ModbusClient from "../src/modbus-client";
import { ModbusForm } from "../src/modbus";
import ModbusServer from "./test-modbus-server";
import chaiAsPromised from "chai-as-promised";
import { Readable } from "stream";
import { ProtocolHelpers } from "@node-wot/core";

// should must be called to augment all variables
should();
chai.use(chaiAsPromised);

describe("Modbus client test", () => {
    let client: ModbusClient;
    let testServer: ModbusServer;

    before(async () => {
        // Turn off logging to have a clean test log
        console.debug = () => {
            // Do nothing.
        };
        console.warn = () => {
            // Do nothing.
        };

        testServer = new ModbusServer(1);
        await testServer.start();
    });

    beforeEach(() => {
        client = new ModbusClient();
        testServer.clear();
    });
    afterEach(() => {
        client.stop();
    });
    after(() => {
        testServer.stop();
    });
    it("use entity alias for coil", () => {
        const form: ModbusForm = {
            href: "modbus://127.0.0.1:8502",
            "modbus:entity": "Coil",
            "modbus:address": 0,
            "modbus:quantity": 1,
            "modbus:unitID": 1,
        };

        /* eslint-disable dot-notation */
        client["validateAndFillDefaultForm"](form, 0)["modbus:function"].should.be.equal(1, "Wrong default read Coil");
        client["validateAndFillDefaultForm"](form, 1)["modbus:function"].should.be.equal(5, "Wrong write Coil");
        client["validateAndFillDefaultForm"](form, 2)["modbus:function"].should.be.equal(
            15,
            "Wrong write multiple Coil",
        );
        /* eslint-enable dot-notation */
    });

    it("use entity alias for holding registries", () => {
        const form: ModbusForm = {
            href: "modbus://127.0.0.1:8502",
            "modbus:entity": "HoldingRegister",
            "modbus:address": 0,
            "modbus:quantity": 1,
            "modbus:unitID": 1,
        };
        /* eslint-disable dot-notation */
        client["validateAndFillDefaultForm"](form)["modbus:function"].should.be.equal(3, "Wrong read Holding register");
        client["validateAndFillDefaultForm"](form, 2)["modbus:function"].should.be.equal(
            6,
            "Wrong write Holding register",
        );
        client["validateAndFillDefaultForm"](form, 4)["modbus:function"].should.be.equal(
            16,
            "Wrong write multiple Holding register",
        );
        /* eslint-enable dot-notation */
    });

    it("use entity alias for other entities", () => {
        const form: ModbusForm = {
            href: "modbus://127.0.0.1:8502",
            "modbus:entity": "DiscreteInput",
            "modbus:address": 0,
            "modbus:quantity": 1,
            "modbus:unitID": 1,
        };
        /* eslint-disable dot-notation */
        client["validateAndFillDefaultForm"](form)["modbus:function"].should.be.equal(2, "Wrong read Discrete input");
        form["modbus:entity"] = "InputRegister";
        client["validateAndFillDefaultForm"](form)["modbus:function"].should.be.equal(4, "Wrong read Input register");
        /* eslint-enable dot-notation */
    });

    it("should convert function names", () => {
        const form: ModbusForm = {
            href: "modbus://127.0.0.1:8502",
            "modbus:function": "readCoil",
            "modbus:address": 0,
            "modbus:quantity": 1,
            "modbus:unitID": 1,
        };

        // eslint-disable-next-line dot-notation
        client["validateAndFillDefaultForm"](form)["modbus:function"].should.be.equal(1, "Wrong substitution");
    });

    it("should override form values with URL", () => {
        const form: ModbusForm = {
            href: "modbus://127.0.0.1:8502/2?address=2&quantity=5",
            "modbus:function": "readCoil",
            "modbus:address": 0,
            "modbus:quantity": 1,
            "modbus:unitID": 1,
        };

        // eslint-disable-next-line dot-notation
        client["overrideFormFromURLPath"](form);
        form["modbus:unitID"].should.be.equal(2, "Form value not overridden");
        form["modbus:address"].should.be.equal(2, "Form value not overridden");
        form["modbus:quantity"].should.be.equal(5, "Form value not overridden");
    });

    describe("misc", () => {
        it("multiple operations", async () => {
            testServer.setRegisters([1]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 1,
                "modbus:address": 0,
                "modbus:quantity": 1,
                "modbus:unitID": 1,
            };

            let result = await client.readResource(form);
            let body = await ProtocolHelpers.readStreamFully(result.body);
            body.should.deep.equal(Buffer.from([1]), "Wrong data");
            result = await client.readResource(form);
            body = await ProtocolHelpers.readStreamFully(result.body);
            body.should.deep.equal(Buffer.from([1]), "Wrong data");
        });
        it("should fail for timeout", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 1,
                "modbus:address": 4444,
                "modbus:quantity": 1,
                "modbus:unitID": 1,
                "modbus:timeout": 1000,
            };

            await client.readResource(form).should.eventually.be.rejected;
        }).timeout(5000);
    });
    describe("read resource", () => {
        it("should read a resource using read coil function", async () => {
            testServer.setRegisters([1]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 1,
                "modbus:address": 0,
                "modbus:quantity": 1,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await ProtocolHelpers.readStreamFully(result.body);
            body.should.deep.equal(Buffer.from([1]), "Wrong data");
        });

        it("should read a resource using multiple read coil function", async () => {
            testServer.setRegisters([0, 1, 1]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 1,
                "modbus:address": 0,
                "modbus:quantity": 3,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await ProtocolHelpers.readStreamFully(result.body);
            body.should.deep.equal(Buffer.from([6]), "Wrong data"); // 0x110 is 6
        });

        it("should read a resource using read discrete input function", async () => {
            testServer.setRegisters([1]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 2,
                "modbus:address": 0,
                "modbus:quantity": 1,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await ProtocolHelpers.readStreamFully(result.body);
            body.should.deep.equal(Buffer.from([1]), "Wrong data");
        });

        it("should read a resource using read discrete input function", async () => {
            testServer.setRegisters([0, 1, 1]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 2,
                "modbus:address": 0,
                "modbus:quantity": 3,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await ProtocolHelpers.readStreamFully(result.body);
            body.should.deep.equal(Buffer.from([6]), "Wrong data"); // 0x110 is 6
        });

        it("should read a resource using read holding registers function", async () => {
            testServer.setRegisters([3]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 3,
                "modbus:address": 0,
                "modbus:quantity": 1,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await ProtocolHelpers.readStreamFully(result.body);
            body.should.deep.equal(Buffer.from([0, 3]), "Wrong data");
        });

        it("should read a resource using read multiple holding registers function", async () => {
            testServer.setRegisters([3, 2, 1]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 3,
                "modbus:address": 0,
                "modbus:quantity": 3,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await ProtocolHelpers.readStreamFully(result.body);
            body.should.deep.equal(Buffer.from([0, 3, 0, 2, 0, 1]), "Wrong data");
        });

        it("should read a resource using read input registers function", async () => {
            testServer.setRegisters([3]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 4,
                "modbus:address": 0,
                "modbus:quantity": 1,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await ProtocolHelpers.readStreamFully(result.body);
            body.should.deep.equal(Buffer.from([0, 3]), "Wrong data");
        });

        it("should read a resource using read multiple input registers function", async () => {
            testServer.setRegisters([3, 2, 1]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 4,
                "modbus:address": 0,
                "modbus:quantity": 3,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await ProtocolHelpers.readStreamFully(result.body);
            body.should.deep.equal(Buffer.from([0, 3, 0, 2, 0, 1]), "Wrong data");
        });

        it("should read a resource using read multiple input registers function with little endian conversion", async () => {
            testServer.setRegisters([3, 2, 1, 0]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                contentType: "application/octet-stream;byteSeq=LITTLE_ENDIAN",
                "modbus:function": 4,
                "modbus:address": 0,
                "modbus:quantity": 4,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await ProtocolHelpers.readStreamFully(result.body);
            body.should.deep.equal(Buffer.from([0, 0, 1, 0, 2, 0, 3, 0]), "Wrong data");
        });

        it("should read a resource using read multiple input registers function with little endian byte swap conversion", async () => {
            testServer.setRegisters([3, 2, 1, 0]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                contentType: "application/octet-stream;byteSeq=LITTLE_ENDIAN_BYTE_SWAP",
                "modbus:function": 4,
                "modbus:address": 0,
                "modbus:quantity": 4,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await ProtocolHelpers.readStreamFully(result.body);
            body.should.deep.equal(Buffer.from([0, 0, 0, 1, 0, 2, 0, 3]), "Wrong data");
        });

        it("should throw exception for unknown function", () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 255,
                "modbus:address": 0,
                "modbus:quantity": 3,
                "modbus:unitID": 1,
            };

            const promise = client.readResource(form);

            return promise.should.eventually.rejectedWith("Undefined function number or name: 255");
        });

        it("should throw exception for missing address", () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 1,
                "modbus:unitID": 1,
            };

            const promise = client.readResource(form);

            return promise.should.eventually.rejectedWith("Malformed form: address must be defined");
        });
    });

    describe("write resource", () => {
        it("should write a resource using write coil function", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 5,
                "modbus:address": 0,
                "modbus:unitID": 1,
            };

            await client.writeResource(form, { type: "", body: Readable.from([1]) });
            testServer.registers[0].should.be.equal(true, "wrong coil value");
        });
        it("should write a resource using multiple write coil function", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 15,
                "modbus:address": 0,
                "modbus:unitID": 1,
            };

            await client.writeResource(form, { type: "", body: Readable.from([1, 0, 1]) });
            testServer.registers.should.be.deep.equal([true, false, true], "wrong coil value");
        });

        it("should write a resource using write register function", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 6,
                "modbus:address": 0,
                "modbus:unitID": 1,
            };

            await client.writeResource(form, { type: "", body: Readable.from([1, 1]) });
            testServer.registers[0].should.be.equal(257, "wrong register value");
        });

        it("should write a resource using write multiple register function", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 16,
                "modbus:address": 0,
                "modbus:unitID": 1,
            };

            await client.writeResource(form, { type: "", body: Readable.from([1, 2, 1, 1]) }); // writes 0x0101 and 0x0100
            testServer.registers.should.be.deep.equal([258, 257], "wrong register value");
        });

        it("should write a resource with big endian ordering", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                contentType: "application/octet-stream;length=2;byteSeq=BIG_ENDIAN",
                "modbus:function": 16,
                "modbus:address": 0,
                "modbus:unitID": 1,
            };

            await client.writeResource(form, { type: "", body: Readable.from([0x25, 0x49, 0x59, 0x60]) });
            testServer.registers.should.be.deep.equal([9545, 22880], "wrong coil value");
        });

        it("should write a resource with little endian ordering", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                contentType: "application/octet-stream;length=2;byteSeq=LITTLE_ENDIAN",
                "modbus:function": 16,
                "modbus:address": 0,
                "modbus:unitID": 1,
            };

            await client.writeResource(form, { type: "", body: Readable.from([0x60, 0x59, 0x49, 0x25]) });
            testServer.registers.should.be.deep.equal([9545, 22880], "wrong coil value");
        });

        it("should write a resource with byte swap big endian ordering", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                contentType: "application/octet-stream;length=2;byteSeq=BIG_ENDIAN_BYTE_SWAP",
                "modbus:function": 16,
                "modbus:address": 0,
                "modbus:unitID": 1,
            };

            await client.writeResource(form, { type: "", body: Readable.from([0x49, 0x25, 0x60, 0x59]) });
            testServer.registers.should.be.deep.equal([9545, 22880], "wrong coil value");
        });

        it("should write a resource with byte swap little endian ordering", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                contentType: "application/octet-stream;length=2;byteSeq=LITTLE_ENDIAN_BYTE_SWAP",
                "modbus:function": 16,
                "modbus:address": 0,
                "modbus:unitID": 1,
            };

            await client.writeResource(form, { type: "", body: Readable.from([0x59, 0x60, 0x25, 0x49]) });
            testServer.registers.should.be.deep.equal([9545, 22880], "wrong coil value");
        });
    });

    describe("subscribe resource", () => {
        it("should wait for subscription", (done) => {
            testServer.setRegisters([1]);
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 1,
                "modbus:address": 0,
                "modbus:unitID": 1,
            };

            client
                .subscribeResource(form, (value) => {
                    // Do nothing.
                })
                .then((subscription) => {
                    client.unlinkResource(form);
                    done();
                });
        });

        it("should poll data", (done) => {
            testServer.setRegisters([1]);
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 1,
                "modbus:address": 0,
                "modbus:unitID": 1,
                "modbus:pollingTime": 250,
            };

            client.subscribeResource(form, async (value) => {
                const body = await ProtocolHelpers.readStreamFully(value.body);
                body.should.deep.equal(Buffer.from([1]), "Wrong data");
                client.unlinkResource(form);
                done();
            });
        });

        it("should poll multiple data", (done) => {
            testServer.setRegisters([1]);
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 1,
                "modbus:address": 0,
                "modbus:unitID": 1,
                "modbus:pollingTime": 125,
            };
            let count = 0;
            client.subscribeResource(form, async (value) => {
                count++;
                if (count > 1) {
                    done();
                    client.unlinkResource(form);
                }
                const body = await ProtocolHelpers.readStreamFully(value.body);
                body.should.deep.equal(Buffer.from([1]), "Wrong data");
            });
        });
    });
});
