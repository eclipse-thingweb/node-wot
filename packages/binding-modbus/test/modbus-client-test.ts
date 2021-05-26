import { should } from "chai";
import * as chai from 'chai';
import ModbusClient from "../src/modbus-client";
import { ModbusForm } from "../src/modbus";
import ModbusServer from "./test-modbus-server";
import * as chaiAsPromised from "chai-as-promised";

// should must be called to augment all variables
should();
chai.use(chaiAsPromised);

describe('Modbus client test', () => {
    let client: ModbusClient;
    let testServer: ModbusServer

    before(async () => {
        //Turn off logging to have a clean test log
        console.debug = ()=>{}
        console.warn = ()=>{}

        testServer = new ModbusServer(1);
        await testServer.start()
    });

    beforeEach(() => {
        client = new ModbusClient();
        testServer.clear()
    });
    afterEach(() => {
        client.stop()
    });
    after(() => {
        testServer.stop()
    });
    it('use entity alias for coil', () => {
        const form: ModbusForm = {
            href: "modbus://127.0.0.1:8502",
            "modbus:entity": "Coil",
            "modbus:offset": 0,
            "modbus:length": 1,
            "modbus:unitID": 1
        }

        client["validateAndFillDefaultForm"](form, 0)["modbus:function"].should.be.equal(1, "Wrong default read Coil")

        client["validateAndFillDefaultForm"](form, 1)["modbus:function"].should.be.equal(5, "Wrong write Coil")
        client["validateAndFillDefaultForm"](form, 2)["modbus:function"].should.be.equal(15, "Wrong write multiple Coil")
    });

    it('use entity alias for holding registries', () => {
        const form: ModbusForm = {
            href: "modbus://127.0.0.1:8502",
            "modbus:entity": "HoldingRegister",
            "modbus:offset": 0,
            "modbus:length": 1,
            "modbus:unitID": 1
        }

        client["validateAndFillDefaultForm"](form)["modbus:function"].should.be.equal(3, "Wrong read Holding register")
        client["validateAndFillDefaultForm"](form, 2)["modbus:function"].should.be.equal(6, "Wrong write Holding register")
        client["validateAndFillDefaultForm"](form, 4)["modbus:function"].should.be.equal(16, "Wrong write multiple Holding register")
    });

    it('use entity alias for other entities', () => {
        const form: ModbusForm = {
            href: "modbus://127.0.0.1:8502",
            "modbus:entity": "DiscreteInput",
            "modbus:offset": 0,
            "modbus:length": 1,
            "modbus:unitID": 1
        }

        client["validateAndFillDefaultForm"](form)["modbus:function"].should.be.equal(2, "Wrong read Discrete input")
        form["modbus:entity"] = "InputRegister"
        client["validateAndFillDefaultForm"](form)["modbus:function"].should.be.equal(4, "Wrong read Input register")
    });

    it('should convert function names', () => {
        const form: ModbusForm = {
            href: "modbus://127.0.0.1:8502",
            "modbus:function": "readCoil",
            "modbus:offset": 0,
            "modbus:length": 1,
            "modbus:unitID": 1
        }

        client["validateAndFillDefaultForm"](form)["modbus:function"].should.be.equal(1, "Wrong substitution")
    });

    it('should override form values with URL', () => {
        const form: ModbusForm = {
            href: "modbus://127.0.0.1:8502/2?offset=2&length=5",
            "modbus:function": "readCoil",
            "modbus:offset": 0,
            "modbus:length": 1,
            "modbus:unitID": 1
        }

        client["overrideFormFromURLPath"](form)
        form["modbus:unitID"].should.be.equal(2, "Form value not overridden")
        form["modbus:offset"].should.be.equal(2, "Form value not overridden")
        form["modbus:length"].should.be.equal(5, "Form value not overridden")
    });

    describe('misc', () => {
        it('multiple operations', async () => {
            testServer.setRegisters([1])

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 1,
                "modbus:offset": 0,
                "modbus:length": 1,
                "modbus:unitID": 1
            }

            let result = await client.readResource(form)
            result.body.should.deep.equal(Buffer.from([1]), "Wrong data")
            result = await client.readResource(form)
            result.body.should.deep.equal(Buffer.from([1]), "Wrong data")
        });
    });
    describe('read resource', () => {
        it('should read a resource using read coil function', async () => {

            testServer.setRegisters([1])

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 1,
                "modbus:offset": 0,
                "modbus:length": 1,
                "modbus:unitID": 1
            }

            const result = await client.readResource(form)
            result.body.should.deep.equal(Buffer.from([1]), "Wrong data")
        });

        it('should read a resource using multiple read coil function', async () => {

            testServer.setRegisters([0, 1, 1])

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 1,
                "modbus:offset": 0,
                "modbus:length": 3,
                "modbus:unitID": 1
            }

            const result = await client.readResource(form)
            result.body.should.deep.equal(Buffer.from([6]), "Wrong data") // 0x110 is 6 
        });

        it('should read a resource using read discrete input function', async () => {

            testServer.setRegisters([1])

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 2,
                "modbus:offset": 0,
                "modbus:length": 1,
                "modbus:unitID": 1
            }

            const result = await client.readResource(form)
            result.body.should.deep.equal(Buffer.from([1]), "Wrong data")
        });

        it('should read a resource using read discrete input function', async () => {

            testServer.setRegisters([0, 1, 1])

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 2,
                "modbus:offset": 0,
                "modbus:length": 3,
                "modbus:unitID": 1
            }

            const result = await client.readResource(form)
            result.body.should.deep.equal(Buffer.from([6]), "Wrong data") // 0x110 is 6 
        });

        it('should read a resource using read holding registers function', async () => {

            testServer.setRegisters([3])

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 3,
                "modbus:offset": 0,
                "modbus:length": 1,
                "modbus:unitID": 1
            }

            const result = await client.readResource(form)
            result.body.should.deep.equal(Buffer.from([0, 3]), "Wrong data")
        });

        it('should read a resource using read multiple holding registers function', async () => {

            testServer.setRegisters([3, 2, 1])

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 3,
                "modbus:offset": 0,
                "modbus:length": 3,
                "modbus:unitID": 1
            }

            const result = await client.readResource(form)
            result.body.should.deep.equal(Buffer.from([0, 3, 0, 2, 0, 1]), "Wrong data")
        });

        it('should read a resource using read input registers function', async () => {

            testServer.setRegisters([3])

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 4,
                "modbus:offset": 0,
                "modbus:length": 1,
                "modbus:unitID": 1
            }

            const result = await client.readResource(form)
            result.body.should.deep.equal(Buffer.from([0, 3]), "Wrong data")
        });

        it('should read a resource using read multiple input registers function', async () => {

            testServer.setRegisters([3, 2, 1])

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 4,
                "modbus:offset": 0,
                "modbus:length": 3,
                "modbus:unitID": 1
            }

            const result = await client.readResource(form)
            result.body.should.deep.equal(Buffer.from([0, 3, 0, 2, 0, 1]), "Wrong data")
        });

        it('should read a resource using read multiple input registers function with little endian conversion', async () => {

            testServer.setRegisters([3, 2, 1, 0])

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                contentType: "application/octet-stream;byteSeq=LITTLE_ENDIAN",
                "modbus:function": 4,
                "modbus:offset": 0,
                "modbus:length": 4,
                "modbus:unitID": 1
            }

            const result = await client.readResource(form)
            result.body.should.deep.equal(Buffer.from([0, 0, 1, 0, 2, 0, 3, 0]), "Wrong data")
        });

        it('should read a resource using read multiple input registers function with little endian byte swap conversion', async () => {

            testServer.setRegisters([3, 2, 1, 0])

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                contentType: "application/octet-stream;byteSeq=LITTLE_ENDIAN_BYTE_SWAP",
                "modbus:function": 4,
                "modbus:offset": 0,
                "modbus:length": 4,
                "modbus:unitID": 1
            }

            const result = await client.readResource(form)
            result.body.should.deep.equal(Buffer.from([0, 0, 0, 1, 0, 2, 0, 3]), "Wrong data")
        });

        it('should throw exception for unknown function', () => {

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 255,
                "modbus:offset": 0,
                "modbus:length": 3,
                "modbus:unitID": 1
            }

            const promise = client.readResource(form)

            return promise.should.eventually.rejectedWith("Undefined function number or name: 255")
        });

        it('should throw exception for missing offset', () => {

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 1,
                "modbus:unitID": 1
            }

            const promise = client.readResource(form)

            return promise.should.eventually.rejectedWith("Malformed form: offset must be defined")
        });
    });

    describe('write resource', () => {
        it('should write a resource using write coil function', async () => {

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 5,
                "modbus:offset": 0,
                "modbus:unitID": 1
            }

            await client.writeResource(form, { type: "", body: Buffer.from([1]) })
            testServer.registers[0].should.be.equal(true, "wrong coil value")
        });
        it('should write a resource using multiple write coil function', async () => {

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 15,
                "modbus:offset": 0,
                "modbus:unitID": 1
            }

            await client.writeResource(form, { type: "", body: Buffer.from([1, 0, 1]) })
            testServer.registers.should.be.deep.equal([true, false, true], "wrong coil value")
        });

        it('should write a resource using write register function', async () => {

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 6,
                "modbus:offset": 0,
                "modbus:unitID": 1
            }

            await client.writeResource(form, { type: "", body: Buffer.from([1, 1]) })
            testServer.registers[0].should.be.equal(257, "wrong register value")
        });

        it('should write a resource using write multiple register function', async () => {

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 16,
                "modbus:offset": 0,
                "modbus:unitID": 1
            }

            await client.writeResource(form, { type: "", body: Buffer.from([1, 2, 1, 1]) }) //writes 0x0101 and 0x0100
            testServer.registers.should.be.deep.equal([258, 257], "wrong register value")
        });

        it('should write a resource with big endian ordering', async () => {

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                contentType: "application/octet-stream;length=2;byteSeq=BIG_ENDIAN",
                "modbus:function": 16,
                "modbus:offset": 0,
                "modbus:unitID": 1
            }

            await client.writeResource(form, { type: "", body: Buffer.from([ 0x25, 0x49, 0x59, 0x60 ]) })
            testServer.registers.should.be.deep.equal([9545, 22880], "wrong coil value")
        });

        it('should write a resource with little endian ordering', async () => {

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                contentType: "application/octet-stream;length=2;byteSeq=LITTLE_ENDIAN",
                "modbus:function": 16,
                "modbus:offset": 0,
                "modbus:unitID": 1
            }

            await client.writeResource(form, { type: "", body: Buffer.from([ 0x60, 0x59, 0x49, 0x25 ]) })
            testServer.registers.should.be.deep.equal([9545, 22880], "wrong coil value")
        });

        it('should write a resource with byte swap big endian ordering', async () => {

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                contentType: "application/octet-stream;length=2;byteSeq=BIG_ENDIAN_BYTE_SWAP",
                "modbus:function": 16,
                "modbus:offset": 0,
                "modbus:unitID": 1
            }

            await client.writeResource(form, { type: "", body: Buffer.from([ 0x49, 0x25, 0x60, 0x59 ]) })
            testServer.registers.should.be.deep.equal([9545, 22880], "wrong coil value")
        });

        it('should write a resource with byte swap little endian ordering', async () => {

            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                contentType: "application/octet-stream;length=2;byteSeq=LITTLE_ENDIAN_BYTE_SWAP",
                "modbus:function": 16,
                "modbus:offset": 0,
                "modbus:unitID": 1
            }

            await client.writeResource(form, { type: "", body: Buffer.from([ 0x59, 0x60, 0x25, 0x49 ]) })
            testServer.registers.should.be.deep.equal([9545, 22880], "wrong coil value")
        });
    });

    describe('subscribe resource', () => {
        it('should poll data', (done) => {
            testServer.setRegisters([1])
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 1,
                "modbus:offset": 0,
                "modbus:unitID": 1,
                "modbus:pollingTime": 250
            }

            client.subscribeResource(form, value => {
                value.body.should.deep.equal(Buffer.from([1]), "Wrong data")
                client.unlinkResource(form);
                done()
            })
        });

        it('should poll multiple data', (done) => {
            testServer.setRegisters([1])
            const form: ModbusForm = {
                href: "modbus://127.0.0.1:8502",
                "modbus:function": 1,
                "modbus:offset": 0,
                "modbus:unitID": 1,
                "modbus:pollingTime": 125
            }
            let count = 0;
            client.subscribeResource(form, value => {
                count++
                if (count > 1) {
                    done()
                    client.unlinkResource(form);
                }
                value.body.should.deep.equal(Buffer.from([1]), "Wrong data")
            })
        });
    });
});
