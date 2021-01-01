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
                return that.registers[addr];
            },
            getCoil: function (addr: number, unitID: any) {
                return that.registers[addr];
            },

            setRegister: function (addr: any, value: any, unitID: any) {
                that.registers[addr] = value
                return;
            },

            setCoil: function (addr: any, value: any, unitID: any) {
                
                that.registers[addr] = value
                return;
            }
        }
        this.serverTCP = new ServerTCP(vector, { host: "127.0.0.1", port: 8502, debug: true, unitID: unitID });
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

