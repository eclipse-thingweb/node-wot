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

import { ServerTCP } from "modbus-serial";

export default class ModbusServer {
    serverTCP: ServerTCP;
    registers: Array<number> = [];
    killers: Array<() => void> = [];
    constructor(unitID: number) {
        const that = this;

        const vector = {
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
                if (addr === 4444) {
                    // promise sleeps for 100 second. Useful for testing long running requests.
                    return new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            resolve(that.registers[addr]);
                        }, 100000);
                        // when stop forcing every connection to close
                        // it seems that the modbus client will not properly
                        // close the connection otherwise
                        that.killers.push(() => {
                            clearTimeout(timeout);
                            resolve(0);
                        });
                    });
                }
                return that.registers[addr];
            },

            setRegister: function (addr: any, value: any, unitID: any) {
                that.registers[addr] = value;
            },

            setCoil: function (addr: any, value: any, unitID: any) {
                that.registers[addr] = value;
            },
        };
        this.serverTCP = new ServerTCP(vector, { host: "127.0.0.1", port: 8502, debug: true, unitID: unitID });
    }

    setRegisters(data: Array<number>, start = 0) {
        for (let index = 0; index < data.length; index++) {
            const element = data[index];
            this.registers[index + start] = element;
        }
    }

    clear() {
        this.registers = [];
    }

    public start() {
        return new Promise((resolve) => {
            this.serverTCP.on("SocketError", function (err: any) {
                // Handle socket error if needed, can be ignored
                console.error(err);
            });
            this.serverTCP.on("error", (e) => {
                console.log(e);
            });

            this.serverTCP.on("initialized", resolve);
        });
    }

    public stop() {
        return new Promise((resolve) => {
            this.killers.forEach((killer) => {
                killer();
            });
            this.serverTCP.close(resolve);
        });
    }
}
