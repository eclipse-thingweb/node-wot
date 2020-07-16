import { should } from "chai";
import * as chai from 'chai';
import ModbusClient from "../src/modbus-client";
import { ModbusForm } from "../src/modbus";
import ModbusServer from "./test-modbus-server";
import * as chaiAsPromised from "chai-as-promised";
import { ModbusConnection, PropertyOperation } from "../src/modbus-connection";

// should must be called to augment all variables
should();
chai.use(chaiAsPromised);


describe('Modbus connection', () => {
    let testServer: ModbusServer
    
    before(async () => {
        testServer = new ModbusServer(1);
        await testServer.start()
    });

    after(() => {
        testServer.stop()
    });
    
    it('should connect', async()=>{
        const connection = new ModbusConnection("127.0.0.1",8502)
        await connection.connect()
        connection.connected.should.be.true
    })

    it('should throw for unknown host', () => {
        const connection = new ModbusConnection("127.0.0.2", 8503,{connectionTimeout:200,connectionRetryTime:10,maxRetries:1})
        return connection.connect().should.eventually.be.rejected
    }).timeout(5000);

    describe('Operation', () => {
        it('should fail for unknown host',()=>{
            const form: ModbusForm = {
                href: "modbus://127.0.0.2:8502",
                "modbus:function": 15,
                "modbus:range": [0,1],
                "modbus:unitID": 1
            }
            const connection = new ModbusConnection("127.0.0.2", 8503, {connectionTimeout: 200, connectionRetryTime: 10, maxRetries: 1 })
            const op = new PropertyOperation(form)
            connection.enqueue(op);

            return op.execute().should.eventually.be.rejected
        }).timeout(5000);
    });
});