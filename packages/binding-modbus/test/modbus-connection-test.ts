import { ModbusEndianness } from "./../src/modbus";
import { should } from "chai";
import * as chai from "chai";
import { ModbusForm } from "../src/modbus";
import ModbusServer from "./test-modbus-server";
import * as chaiAsPromised from "chai-as-promised";
import { ModbusConnection, PropertyOperation } from "../src/modbus-connection";

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
                "modbus:offset": 0,
                "modbus:length": 1,
                "modbus:unitID": 1,
            };
            const connection = new ModbusConnection("127.0.0.2", 8503, {
                connectionTimeout: 200,
                connectionRetryTime: 10,
                maxRetries: 1,
            });
            const op = new PropertyOperation(form, ModbusEndianness.BIG_ENDIAN);
            connection.enqueue(op);

            await op.execute().should.eventually.be.rejected;
            connection.close();
        }).timeout(5000);

        it("should throw with timeout", async () => {
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:entity": "Coil",
                "modbus:offset": 4444,
                "modbus:length": 1,
                "modbus:unitID": 1,
            };
            const connection = new ModbusConnection("127.0.0.1", 8502, {
                connectionTimeout: 1000,
                connectionRetryTime: 10,
                maxRetries: 1,
            });
            const op = new PropertyOperation(form, ModbusEndianness.BIG_ENDIAN);
            connection.enqueue(op);

            await op.execute().should.eventually.be.rejected;

            connection.close();
        }).timeout(5000);
    });
});
