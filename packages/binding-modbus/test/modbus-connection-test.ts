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
import { ModbusForm } from "../src/modbus";
import ModbusServer from "./test-modbus-server";
import chaiAsPromised from "chai-as-promised";
import { ModbusConnection, PropertyOperation } from "../src/modbus-connection";
import { Endianness } from "@node-wot/core";

// should must be called to augment all variables
should();
chai.use(chaiAsPromised);

describe("Modbus connection", () => {
    let testServer: ModbusServer;

    before(async () => {
        testServer = new ModbusServer(1);
        await testServer.start();
    });

    after(() => {
        testServer.stop();
    });

    it("should connect", async () => {
        const connection = new ModbusConnection("127.0.0.1", 8502);
        await connection.connect();
        // eslint-disable-next-line no-unused-expressions
        connection.client.isOpen.should.be.true;
    });

    it("should throw for unknown host", () => {
        const connection = new ModbusConnection("127.0.0.2", 8502, {
            connectionTimeout: 200,
            connectionRetryTime: 10,
            maxRetries: 1,
        });
        return connection.connect().should.eventually.be.rejectedWith("Max connection retries");
    }).timeout(5000);

    it("should throw for timeout", () => {
        const connection = new ModbusConnection("127.0.0.1", 8503, {
            connectionTimeout: 200,
            connectionRetryTime: 10,
            maxRetries: 1,
        });
        return connection.connect().should.eventually.be.rejectedWith("Max connection retries");
    }).timeout(5000);

    describe("Operation", () => {
        it("should fail for unknown host", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.2:8502",
                "modbus:function": 15,
                "modbus:address": 0,
                "modbus:quantity": 1,
                "modbus:unitID": 1,
            };
            const connection = new ModbusConnection("127.0.0.2", 8503, {
                connectionTimeout: 200,
                connectionRetryTime: 10,
                maxRetries: 1,
            });
            const op = new PropertyOperation(form, Endianness.BIG_ENDIAN);
            connection.enqueue(op);

            await op.execute().should.eventually.be.rejected;
            connection.close();
        }).timeout(5000);

        it("should throw with timeout", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:entity": "Coil",
                "modbus:address": 4444,
                "modbus:quantity": 1,
                "modbus:unitID": 1,
            };
            const connection = new ModbusConnection("127.0.0.1", 8502, {
                connectionTimeout: 1000,
                connectionRetryTime: 10,
                maxRetries: 1,
            });
            const op = new PropertyOperation(form, Endianness.BIG_ENDIAN);
            connection.enqueue(op);

            await op.execute().should.eventually.be.rejected;

            connection.close();
        }).timeout(5000);
    });
});
