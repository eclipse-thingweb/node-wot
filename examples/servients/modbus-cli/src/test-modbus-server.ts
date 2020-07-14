import {ServerTCP} from 'modbus-serial'

export default class ModbusServer{
    serverTCP: ServerTCP;
    registers:Array<number> = [];
    constructor(unitID:number) {
        const that = this
        var vector = {
            getInputRegister: function (addr: any, unitID: any) {
                // Synchronous handling
                return that.registers[addr];
            },
            getDiscreteInput: function (addr: any, unitID: any) {
                // Synchronous handling
                return that.registers[addr];
            },
            getHoldingRegister: function (addr: number, unitID: any) {
                console.log("Reading holding register n°", addr, "value", that.registers[addr]);
                return that.registers[addr];
            },
            getCoil: function (addr: number, unitID: any) {
                console.log("Reading coil n°", addr, "value", that.registers[addr]);
                
                return that.registers[addr];
            },

            setRegister: function (addr: any, value: any, unitID: any) {
                console.log("Writing to register n°", addr, "the value", value)
                that.registers[addr] = value
                return;
            },

            setCoil: function (addr: any, value: any, unitID: any) {
                console.log("Writing to coil n°",addr,"the value",value)
                that.registers[addr] = value
                return;
            }
        }
        this.serverTCP = new ServerTCP(vector, { host: "127.0.0.1", port: 60000, debug: true, unitID: unitID });
    }

    setRegisters(data:Array<number>,start=0){
        for (let index = 0; index < data.length; index++) {
            const element = data[index];
            this.registers[index+start] = element
        }
    }

    clear(){
        this.registers = []
    }

    public start(){
        return new Promise((resolve) => {

            this.serverTCP.on("SocketError", function (err: any) {
                // Handle socket error if needed, can be ignored
                console.error(err);
            });
            this.serverTCP.on("error", (e) => { console.log(e) })

            this.serverTCP.on("initialized",resolve)
        })
    }

    public stop(){
        return new Promise((resolve)=> {
            this.serverTCP.close(resolve)
        })
    }
}

if (process.mainModule) {
    console.log("Starting modbus server at 127.0.0.1:60000");
    
    let test = new ModbusServer(1)
    test.start().then(()=> console.log("Started"))
}

