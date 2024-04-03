/********************************************************************************
 * Copyright (c) 2020 Contributors to the Eclipse Foundation
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
import { Content } from "@node-wot/core";

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
            "modv:entity": "Coil",
            "modbus:address": 0,
            "modbus:quantity": 1,
            "modbus:unitID": 1,
        };

        /* eslint-disable dot-notation */
        client["validateAndFillDefaultForm"](form, 0)["modv:function"].should.be.equal(1, "Wrong default read Coil");
        client["validateAndFillDefaultForm"](form, 1)["modv:function"].should.be.equal(5, "Wrong write Coil");
        client["validateAndFillDefaultForm"](form, 2)["modv:function"].should.be.equal(
            15,
            "Wrong write multiple Coil"
        );
        /* eslint-enable dot-notation */
    });

    it("use entity alias for holding registries", () => {
        const form: ModbusForm = {
            href: "modbus://127.0.0.1:8502",
            "modv:entity": "HoldingRegister",
            "modbus:address": 0,
            "modbus:quantity": 1,
            "modbus:unitID": 1,
        };
        /* eslint-disable dot-notation */
        client["validateAndFillDefaultForm"](form)["modv:function"].should.be.equal(3, "Wrong read Holding register");
        client["validateAndFillDefaultForm"](form, 2)["modv:function"].should.be.equal(
            6,
            "Wrong write Holding register"
        );
        client["validateAndFillDefaultForm"](form, 4)["modv:function"].should.be.equal(
            16,
            "Wrong write multiple Holding register"
        );
        /* eslint-enable dot-notation */
    });

    it("use entity alias for other entities", () => {
        const form: ModbusForm = {
            href: "modbus://127.0.0.1:8502",
            "modv:entity": "DiscreteInput",
            "modbus:address": 0,
            "modbus:quantity": 1,
            "modbus:unitID": 1,
        };
        /* eslint-disable dot-notation */
        client["validateAndFillDefaultForm"](form)["modv:function"].should.be.equal(2, "Wrong read Discrete input");
        form["modv:entity"] = "InputRegister";
        client["validateAndFillDefaultForm"](form)["modv:function"].should.be.equal(4, "Wrong read Input register");
        /* eslint-enable dot-notation */
    });

    it("should convert function names", () => {
        const form: ModbusForm = {
            href: "modbus://127.0.0.1:8502",
            "modv:function": "readCoil",
            "modbus:address": 0,
            "modbus:quantity": 1,
            "modbus:unitID": 1,
        };

        // eslint-disable-next-line dot-notation
        client["validateAndFillDefaultForm"](form)["modv:function"].should.be.equal(1, "Wrong substitution");
    });

    it("should accept just URL parameters", () => {
        const form: ModbusForm = {
            href: "modbus://127.0.0.1:8502/2/2?quantity=5",
            "modv:function": "readCoil",
        };

        // eslint-disable-next-line dot-notation
        const result = client["validateAndFillDefaultForm"](form);
        result["modbus:unitID"].should.be.equal(2, "unitID  value not set");
        result["modbus:address"].should.be.equal(2, "address value not set");
        result["modbus:quantity"].should.be.equal(5, "quantity value not set");
    });

    it("should accept just URL parameters without quantity", () => {
        const form: ModbusForm = {
            href: "modbus://127.0.0.1:8502/2/2",
            "modv:function": "readCoil",
        };

        // eslint-disable-next-line dot-notation
        const result = client["validateAndFillDefaultForm"](form);
        result["modbus:unitID"].should.be.equal(2, "unitID  value not set");
        result["modbus:address"].should.be.equal(2, "address value not set");
    });

    it("should override correctly form values with URL", () => {
        const form: ModbusForm = {
            href: "modbus://127.0.0.1:8502/2/2?quantity=5",
            "modv:function": "readCoil",
            "modbus:address": 0,
            "modbus:quantity": 1,
            "modbus:unitID": 1,
        };

        // eslint-disable-next-line dot-notation
        const result = client["validateAndFillDefaultForm"](form);
        result["modbus:unitID"].should.be.equal(2, "unitID value not overridden");
        result["modbus:address"].should.be.equal(2, "address value not overridden");
        result["modbus:quantity"].should.be.equal(5, "quantity value not overridden");
    });

    describe("misc", () => {
        it("multiple operations", async () => {
            testServer.setRegisters([1]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modv:function": 1,
                "modbus:address": 0,
                "modbus:quantity": 1,
                "modbus:unitID": 1,
            };

            let result = await client.readResource(form);
            let body = await result.toBuffer();
            body.should.deep.equal(Buffer.from([1]), "Wrong data");
            result = await client.readResource(form);
            body = await result.toBuffer();
            body.should.deep.equal(Buffer.from([1]), "Wrong data");
        });
        it("should fail for timeout", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modv:function": 1,
                "modbus:address": 4444,
                "modbus:quantity": 1,
                "modbus:unitID": 1,
                "modv:timeout": 100,
            };

            await client.readResource(form).should.eventually.be.rejectedWith("Timed out");
        }).timeout(5000);
    });
    describe("read resource", () => {
        it("should read a resource using read coil function", async () => {
            testServer.setRegisters([1]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modv:function": 1,
                "modbus:address": 0,
                "modbus:quantity": 1,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await result.toBuffer();
            body.should.deep.equal(Buffer.from([1]), "Wrong data");
        });

        it("should read a resource using multiple read coil function", async () => {
            testServer.setRegisters([0, 1, 1]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modv:function": 1,
                "modbus:address": 0,
                "modbus:quantity": 3,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await result.toBuffer();
            body.should.deep.equal(Buffer.from([6]), "Wrong data"); // 0x110 is 6
        });

        it("should read a resource using read discrete input function", async () => {
            testServer.setRegisters([1]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modv:function": 2,
                "modbus:address": 0,
                "modbus:quantity": 1,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await result.toBuffer();
            body.should.deep.equal(Buffer.from([1]), "Wrong data");
        });

        it("should read a resource using read discrete input function", async () => {
            testServer.setRegisters([0, 1, 1]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modv:function": 2,
                "modbus:address": 0,
                "modbus:quantity": 3,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await result.toBuffer();
            body.should.deep.equal(Buffer.from([6]), "Wrong data"); // 0x110 is 6
        });

        it("should read a resource using read holding registers function", async () => {
            testServer.setRegisters([3]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                contentType: "application/octet-stream",
                "modv:function": 3,
                "modbus:address": 0,
                "modbus:quantity": 1,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await result.toBuffer();
            body.should.deep.equal(Buffer.from([0, 3]), "Wrong data");
            result.type.should.be.equal("application/octet-stream", "Wrong content type");
        });

        it("should read a resource using read multiple holding registers function", async () => {
            testServer.setRegisters([3, 2, 1]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                contentType: "application/octet-stream; length=6",
                "modv:function": 3,
                "modbus:address": 0,
                "modbus:quantity": 3,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await result.toBuffer();
            body.should.deep.equal(Buffer.from([0, 3, 0, 2, 0, 1]), "Wrong data");
            result.type.should.be.equal("application/octet-stream; length=6", "Wrong content type");
        });

        it("should read a resource using read input registers function", async () => {
            testServer.setRegisters([3]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modv:function": 4,
                "modbus:address": 0,
                "modbus:quantity": 1,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await result.toBuffer();
            body.should.deep.equal(Buffer.from([0, 3]), "Wrong data");
        });

        it("should read a resource using read multiple input registers function", async () => {
            testServer.setRegisters([3, 2, 1]);

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modv:function": 4,
                "modbus:address": 0,
                "modbus:quantity": 3,
                "modbus:unitID": 1,
            };

            const result = await client.readResource(form);
            const body = await result.toBuffer();
            body.should.deep.equal(Buffer.from([0, 3, 0, 2, 0, 1]), "Wrong data");
        });

        it("should throw exception for unknown function", () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modv:function": 255,
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
                "modv:function": 1,
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
                "modv:function": 5,
                "modbus:address": 0,
                "modbus:unitID": 1,
            };

            await client.writeResource(form, new Content("", Readable.from([1])));
            testServer.registers[0].should.be.equal(true, "wrong coil value");
        });
        it("should write a resource using multiple write coil function", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modv:function": 15,
                "modbus:address": 0,
                "modbus:unitID": 1,
            };

            await client.writeResource(form, new Content("", Readable.from([1, 0, 1])));
            testServer.registers.should.be.deep.equal([true, false, true], "wrong coil value");
        });

        it("should write a resource using write register function", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modv:function": 6,
                "modbus:address": 0,
                "modbus:unitID": 1,
            };

            await client.writeResource(form, new Content("", Readable.from([1, 1])));
            testServer.registers[0].should.be.equal(257, "wrong register value");
        });

        it("should write a resource using write multiple register function", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modv:function": 16,
                "modbus:address": 0,
                "modbus:unitID": 1,
            };

            await client.writeResource(form, new Content("", Readable.from([1, 2, 1, 1])));
            testServer.registers.should.be.deep.equal([258, 257], "wrong register value");
        });

        it("should write a resource with big endian ordering", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                contentType: "application/octet-stream;length=2;byteSeq=BIG_ENDIAN",
                "modv:function": 16,
                "modbus:address": 0,
                "modbus:unitID": 1,
            };

            await client.writeResource(form, new Content("", Readable.from([0x25, 0x49, 0x59, 0x60])));
            testServer.registers.should.be.deep.equal([9545, 22880], "wrong coil value");
        });

        it("should write a resource with little endian ordering", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                contentType: "application/octet-stream;byteSeq=LITTLE_ENDIAN",
                "modv:function": 6,
                "modbus:address": 0,
                "modbus:unitID": 1,
            };

            await client.writeResource(form, new Content("", Readable.from([0x01, 0x01]))); // 257 little-endian
            testServer.registers.should.be.deep.equal([257], "wrong coil value");
        });
    });

    describe("subscribe resource", () => {
        it("should wait for subscription", (done) => {
            testServer.setRegisters([1]);
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modv:function": 1,
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
                "modv:function": 1,
                "modbus:address": 0,
                "modbus:unitID": 1,
                "modv:pollingTime": 250,
            };

            client.subscribeResource(form, async (value) => {
                const body = await value.toBuffer();
                body.should.deep.equal(Buffer.from([1]), "Wrong data");
                client.unlinkResource(form);
                done();
            });
        });

        it("should poll multiple data", (done) => {
            testServer.setRegisters([1]);
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modv:function": 1,
                "modbus:address": 0,
                "modbus:unitID": 1,
                "modv:pollingTime": 125,
            };
            let count = 0;
            client.subscribeResource(form, async (value) => {
                count++;
                if (count > 1) {
                    done();
                    client.unlinkResource(form);
                }
                const body = await value.toBuffer();
                body.should.deep.equal(Buffer.from([1]), "Wrong data");
            });
        });
    });
});
