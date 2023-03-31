/********************************************************************************
 * Copyright (c) 2023 Contributors to the Eclipse Foundation
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

import { createLoggers } from "@node-wot/core";
import { ServerTCP } from "modbus-serial";

const { error, debug } = createLoggers("binding-modbus", "test-modbus-server");

export default class ModbusServer {
    serverTCP: ServerTCP;
    registers: Array<number | boolean> = [];
    killers: Array<() => void> = [];
    constructor(unitID: number) {
        const vector = {
            getInputRegister: (addr: number, unitID: number) => {
                // Synchronous handling
                return this.registers[addr];
            },
            getDiscreteInput: (addr: number, unitID: number) => {
                // Synchronous handling
                return this.registers[addr];
            },
            getHoldingRegister: (addr: number, unitID: number) => {
                return this.registers[addr];
            },
            getCoil: (addr: number, unitID: number) => {
                if (addr === 4444) {
                    // promise sleeps for 100 second. Useful for testing long running requests.
                    return new Promise<number | boolean>((resolve) => {
                        const timeout = setTimeout(() => {
                            resolve(this.registers[addr]);
                        }, 100000);
                        // when stop forcing every connection to close
                        // it seems that the modbus client will not properly
                        // close the connection otherwise
                        this.killers.push(() => {
                            clearTimeout(timeout);
                            resolve(0);
                        });
                    });
                }
                return this.registers[addr];
            },

            setRegister: (addr: number, value: number, unitID: number) => {
                this.registers[addr] = value;
            },

            setCoil: (addr: number, value: boolean, unitID: number) => {
                this.registers[addr] = value;
            },
        };
        this.serverTCP = new ServerTCP(vector, { host: "127.0.0.1", port: 8502, debug: true, unitID: unitID });
    }

    setRegisters(data: Array<number>, start = 0): void {
        for (let index = 0; index < data.length; index++) {
            const element = data[index];
            this.registers[index + start] = element;
        }
    }

    clear(): void {
        this.registers = [];
    }

    public start(): Promise<unknown> {
        return new Promise((resolve) => {
            this.serverTCP.on("SocketError", (err: Error) => {
                // Handle socket error if needed, can be ignored
                error(err.toString());
            });
            this.serverTCP.on("error", (err) => {
                debug(err.toString());
            });

            this.serverTCP.on("initialized", resolve);
        });
    }

    public stop(): Promise<unknown> {
        return new Promise((resolve) => {
            this.killers.forEach((killer) => {
                killer();
            });
            this.serverTCP.close(resolve);
        });
    }
}
