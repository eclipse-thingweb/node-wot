/********************************************************************************
 * Copyright (c) 2018 Siemens AG
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

/**
 * Modbus master based on modbus-serial
 */

import { ProtocolClient, Content } from "@node-wot/core";
import { Form } from "@node-wot/td-tools";
import * as ModbusClient from 'modbus-serial/ModbusRTU'; // it is actually Modbus/TCP - the name is misleading
var ModbusRTU = require("modbus-serial/index");
import * as url from 'url';

const connectionTimeout = 2000;    // close Modbus connection after 2s
const knownRegisterTypes = ["in", "coil", "hold", "disc"]


/**
 * ModbusConnection represents a client connected to a specific host and port
 */
class ModbusConnection {
    host: string
    port: number
    client: any //ModbusClient.IModbusRTU
    connecting: boolean
    connected: boolean
    timer: NodeJS.Timer                 // connection idle timer
    transaction: ModbusTransaction      // transaction currently in progress or null
    queue: Array<ModbusTransaction>     // queue of further transactions

    constructor(host: string, port: number) {
        this.host = host;
        this.port = port;
        this.client = new ModbusRTU(); //new ModbusClient();
        this.connecting = false;
        this.connected = false;
        this.timer = null;
        this.transaction = null;
        this.queue = new Array<ModbusTransaction>();
    }

    /**
     * Enqueue a PropertyOperation by either creating a new ModbusTransaction
     * or joining it with an existing compatible transaction.
     * 
     * Note: The algorithm for joining operations implemented here is very simple
     * and can be further elaborated.
     * 
     * Note: Devices may also have a limit on the size of a MODBUS transaction.
     * This is not accounted for in this implementation.
     * 
     * @param op PropertyOperation to be enqueued
     */
    enqueue(op: PropertyOperation): void {
        // try to merge with any pending transaction
        for (let t of this.queue) {
            if (op.unitId === t.unitId &&
                op.registerType === t.registerType &&
                (op.content != null) === (t.content != null))
            {
                // same type, are registers adjacent?
                if (op.base === t.base + t.length) {
                    // append
                    t.length += op.length;

                    if (t.content) {
                        t.content = Buffer.concat([t.content, op.content]);
                    }

                    t.inform(op);
                    return;
                }
    
                if (op.base + op.length === t.base) {
                    // prepend
                    t.base -= op.length;
                    t.length += op.length;

                    if (t.content) {
                        t.content = Buffer.concat([op.content, t.content]);
                    }

                    t.inform(op);
                    return;
                }
            }
        }

        // create and append a new transaction
        let transaction = new ModbusTransaction(this, op.unitId, op.registerType, op.base, op.length, op.content);
        transaction.inform(op);
        this.queue.push(transaction);
    }

    /**
     * Trigger work on this connection.
     * 
     * If the ModbusConnection is unconnected, connect it and retrigger.
     * If no transaction is currently being processed but transactions are waiting,
     * start the next transaction.
     * Retrigger after success or failure.
     */
    trigger() {
        console.debug("ModbusConnection:trigger");
        if (!this.connecting && !this.connected) {
            console.info("Trying to connect to", this.host);
            this.connecting = true;
            this.client.connectTCP(this.host, { port: this.port })
            .then(() => {
                this.connecting = false;
                this.connected = true;
                console.info("Modbus connected to " + this.host);
                this.trigger();
            })
            .catch((reason: any) => {
                console.warn("Cannot connect to", this.host, "reason", reason, " retry in 10s");
                this.connecting = false;
                setTimeout(() => this.trigger(), 10000);
            });
        } else if (this.connected && this.transaction == null && this.queue.length > 0) {
            // take next transaction from queue and execute
            this.transaction = this.queue.shift();
            new Promise<void>((resolve, reject) => {
                this.transaction.execute(resolve, reject);
            })
            .then(() => {
                this.transaction = null;
                this.trigger();
            })
            .catch((reason: any) => {
                console.warn("MODBUS transaction failed:", reason);
                this.transaction = null;
                this.trigger();
            });
        }
    }

    private modbusstop() {
        console.log("Closing unused connection");
        this.client.close((err: string) => {
            if (!err) {
                console.debug("Modbus: session closed");
                this.connecting = false;
                this.connected = false;
            } else {
                console.error("Modbus: cannot close session " + err);
            }
        });

        this.timer = null;
    }

    readModbus(transaction: ModbusTransaction): Promise<ModbusClient.ReadCoilResult | ModbusClient.ReadRegisterResult> {
        console.debug("Invoking read transaction");
        // reset connection idle timer
        if (this.timer) {
            clearTimeout(this.timer);
        }

        this.timer = setTimeout(() => this.modbusstop(), connectionTimeout);

        const regtype: string = transaction.registerType;
        this.client.setID(transaction.unitId);

        if (regtype === "in") return this.client.readInputRegisters(transaction.base, transaction.length);
        if (regtype === "coil") return this.client.readCoils(transaction.base, transaction.length);
        if (regtype === "hold") return this.client.readHoldingRegisters(transaction.base, transaction.length);
        if (regtype === "disc") return this.client.readDiscreteInputs(transaction.base, transaction.length);

        //no match
        return Promise.reject("cannot read unknown register type " + regtype);
    }

    writeModbus(transaction: ModbusTransaction): Promise<void> {
        console.debug("Invoking write transaction");
        // reset connection idle timer
        if (this.timer) {
            clearTimeout(this.timer);
        }

        this.timer = setTimeout(() => this.modbusstop(), connectionTimeout);

        const regtype: string = transaction.registerType;
        this.client.setID(transaction.unitId);

        if (regtype === "coil") {
            if (transaction.length === 1) {
                //writing a single value to a single coil
                let value = transaction.content.readUInt8(0) != 0;
                return this.client.writeCoil(transaction.base, value).then((result: any) => {
                    if (result.address == transaction.base && result.state === value)
                        return Promise.resolve()
                    else
                        return Promise.reject(`writing ${value} to ${transaction.base} failed, state is ${result.state}`)
                })
            } else {
                let value = new Array<boolean>();
                transaction.content.forEach(v => value.push(v != 0));
                return this.client.writeCoils(transaction.base, value).then((result: any) => {
                    if (result.address == transaction.base && result.length === transaction.length)
                        return Promise.resolve()
                    else
                        return Promise.reject(`writing ${value} to ${transaction.base} failed`)
                })
            }
        }

        if (regtype === "hold") {
            if (transaction.length === 1) {
                // writing a single value to a single register
                let value = transaction.content.readUInt16BE(0);
                return this.client.writeRegister(transaction.base, value).then((result: any) => {
                    if (result.address == transaction.base && result.value === value)
                        return Promise.resolve()
                    else
                        return Promise.reject(`writing ${value} to ${transaction.base} failed, state is ${result.value}`)
                })
            } else {
                // writing values to multiple registers
                let values = new Array<number>();
                for (let i = 0; i < transaction.length; ++i) {
                    values.push(transaction.content.readUInt16BE(2 * i));
                }
                return this.client.writeRegisters(transaction.base, values).then((result: any) => {
                    if (result.address == transaction.base) {
                        console.warn(`short write to registers ${transaction.base} + ${transaction.length}, wrote ${values} to ${result.address} + ${result.length} `)
                        return Promise.resolve()
                    } else
                        return Promise.reject(`writing ${values} to registers ${transaction.base} + ${transaction.length} failed, wrote to ${result.address}`)
                })
            }
        }

        //no match
        return Promise.reject("cannot write register type " + regtype)
    }
}


/**
 * ModbusTransaction represents a raw MODBUS operation performed on a ModbusConnection
 */
class ModbusTransaction {
    connection: ModbusConnection
    unitId: number
    registerType: string
    base: number
    length: number
    content?: Buffer
    operations: Array<PropertyOperation>    // operations to be completed when this transaction completes

    constructor(connection: ModbusConnection, unitId: number, registerType: string, base: number, length: number, content?: Buffer) {
        this.connection = connection;
        this.unitId = unitId;
        this.registerType = registerType;
        this.base = base;
        this.length = length;
        this.content = content;
        this.operations = new Array<PropertyOperation>();
    }

    /**
     * Link PropertyOperation with this transaction, so that operations can be
     * notified about the result of a transaction.
     * 
     * @param op the PropertyOperation to link with this transaction
     */
    inform(op: PropertyOperation) {
        op.transaction = this;
        this.operations.push(op);
    }

    /**
     * Trigger work on the associated connection.
     * 
     * @see ModbusConnection.trigger()
     */
    trigger() {
        console.debug("ModbusTransaction:trigger");
        this.connection.trigger();
    }

    /**
     * Execute this ModbusTransaction and resolve/reject the invoking Promise as well
     * as the Promises of all associated PropertyOperations.
     * 
     * @param resolve 
     * @param reject 
     */
    execute(resolve: () => void, reject: (reason?: any) => void): void {
        if (!this.content) {
            console.log("Trigger MODBUS read operation on", this.base, "len", this.length);
            // perform read transaction
            this.connection.readModbus(this)
            .then(result => {
                console.log("Got result from MODBUS read operation on", this.base, "len", this.length);
                // inform all operations and the invoker
                this.operations.forEach(op => op.done(this.base, result.buffer, result.data));
                resolve();
            })
            .catch((reason: any) => {
                console.warn("MODBUS read operation failed on", this.base, "len", this.length, reason);
                // inform all operations and the invoker
                this.operations.forEach(op => op.failed(reason));
                reject(reason);
            });
        } else {
            console.log("Trigger MODBUS write operation on", this.base, "len", this.length);
            // perform write transaction
            this.connection.writeModbus(this)
            .then(() => {
                console.log("Got result from MODBUS read operation on", this.base, "len", this.length);
                // inform all operations and the invoker
                this.operations.forEach(op => op.done());
                resolve();
            })
            .catch((reason: any) => {
                console.warn("MODBUS write operation failed on", this.base, "len", this.length, reason);
                // inform all operations and the invoker
                this.operations.forEach(op => op.failed(reason));
                reject(reason);
            });

        }
    }
}

/**
 * PropertyOperation represents a read or write operation on a property
 */
class PropertyOperation {
    unitId: number
    registerType: string
    base: number
    length: number
    content?: Buffer
    transaction: ModbusTransaction      // transaction used to execute this operation
    resolve: (value?: Content | PromiseLike<Content>) => void
    reject: (reason?: any) => void

    constructor(unitId: number, registerType: string, base: number, length: number, content?: Buffer) {
        this.unitId = unitId;
        this.registerType = registerType;
        this.base = base;
        this.length = length;
        this.content = content;
        this.transaction = null;
    }

    /**
     * Trigger execution of this operation.
     * 
     * The resolve/reject functions of the Promise made by this operation are catched and stored
     * with the PropertyOperation object, so that these Promises can later be fulfilled by the
     * associated ModbusTransaction.
     * 
     * @param resolve 
     * @param reject 
     */
    execute(resolve: (value?: Content | PromiseLike<Content>) => void, reject: (reason?: any) => void): void {
        this.resolve = resolve;
        this.reject = reject;

        if (this.transaction == null) {
            reject("No transaction for this operation");
        } else {
            // deferred trigger, invoked later when the caller of this method has completed
            setImmediate(() => this.transaction.trigger());
        }
    }

    /**
     * Invoked by the ModbusTransaction when it has completed succesfully
     * 
     * @param base Base register offset of the transaction (on read)
     * @param buffer Result data of the transaction as Buffer (on read)
     * @param data Result data of the transaction as array (on read)
     */
    done(base?: number, buffer?: Buffer, data?: boolean[] | number[]) {
        console.debug("Operation done");

        if (base == null || base == undefined) {
            // resolve write operation
            this.resolve();
            return;
        }

        // extract the proper part from the result and resolve promise
        let offset = this.base - base;
        let resp: Content;

        if (this.registerType === "in" || this.registerType === "hold") {
            let bufstart = 2 * offset;
            let bufend = 2 * (offset + this.length);
    
            resp = { 
                body: buffer.slice(bufstart, bufend),
                type: null
            };
        } else {
            resp = { 
                body: Buffer.alloc(1, data[offset] ? 1 : 0),
                type: null
            };
        }

        // resolve the Promise given to the invoking script
        this.resolve(resp);
    }

    /**
     * Invoked by the ModbusTransaction when it has failed.
     * 
     * @param reason Reason of failure
     */
    failed(reason: string) {
        console.warn("Operation failed:", reason);
        // reject the Promise given to the invoking script
        this.reject(reason);
    }
}

export class ModBusClient implements ProtocolClient {
    private connections: Map<string, ModbusConnection>;

    constructor() {
        this.connections = new Map<string, ModbusConnection>();
    }

    private performOpertion(form: Form, content?: Content): Promise<Content | void> {
        // get host and port
        let rquri = url.parse(form.href);
        let host = rquri.hostname;
        let port = parseInt(rquri.port) || 502;
        let hostandport = host + ":" + port;

        // find or create connection
        let connection = this.connections.get(hostandport);

        if (!connection) {
            console.info("Creating new ModbusConnection for ", hostandport);
            this.connections.set(hostandport, new ModbusConnection(host, port));
            connection = this.connections.get(hostandport);
        }

        let pathComp = rquri.path.split('/')

        // ensure it is a known registertype
        let registerTypeIdx = knownRegisterTypes.indexOf(pathComp[2])
        if (registerTypeIdx === -1) {
            return Promise.reject("Unkown Modbus register type " + pathComp[2]); 
        }

        let unitId = parseInt(pathComp[1]) || 0;
        let regType = knownRegisterTypes[registerTypeIdx];
        let base = parseInt(pathComp[3]) || 0;
        let length =  parseInt(pathComp[4]) || 1;

        // check buffer length on write
        let mpy = regType === "in" || regType === "hold" ? 2 : 1;

        if (content && content.body.length != mpy * length) {
            return Promise.reject("Content length does not match register/coil count, got " + content.body.length + " bytes for " + length + " registers/coils"); 
        }

        // create operation
        let operation = new PropertyOperation(unitId, regType, base, length, content ? content.body : undefined);

        // enqueue the operation at the connection
        connection.enqueue(operation);

        // return a promise to execute the operation
        return new Promise<Content | void>((resolve, reject) => {
            operation.execute(resolve, reject);
        });
    }

	public readResource(form: Form): Promise<Content> {
        return this.performOpertion(form) as Promise<Content>;
    }

    public writeResource(form: Form, content: Content): Promise<void> {
        return this.performOpertion(form, content) as Promise<void>;
    }

    public invokeResource(form: Form, content: Content): Promise<Content> {
        return Promise.reject("Invoke not applicable for modbus")
    }

    public subscribeResource(form: Form, next: ((value: any) => void), error?: (error: any) => void, complete?: () => void): any {
        error(new Error(`ModbusClient does not implement subscribe`));
        return null;
    }
    
    public unlinkResource = (form: Form) => Promise.reject("Unlink not applicable for modbus")

    start = () => true
    stop = () => true
    public setSecurity = (metadata : any) => false;
}

export default ModBusClient;
