/**
 * Modbus master based on modbus-serial
 */
import { ModbusForm, ModbusFunction, ModbusFunctionName, ModbusEntity } from './modbus'
import ModbusRTU from 'modbus-serial'

import { ProtocolClient, Content, ContentSerdes } from '@node-wot/core'
import { SecurityScheme } from '@node-wot/td-tools'
import { modbusFunctionToEntity } from './utils'
import { ReadCoilResult, ReadRegisterResult } from 'modbus-serial/ModbusRTU'

const DEFAULT_PORT = 805
const DEFAULT_TIMEOUT = 1000
const DEFAULT_POLLING = 2000

export default class ModbusClient implements ProtocolClient {
  private _connections: Map<string, ModbusConnection>;

  private _subscriptions: Map<string, Subscription> = new Map();

  constructor() {
    this._connections = new Map()
  }
  readResource(form: ModbusForm): Promise<Content> {
    return this.performOperation(form) as Promise<Content>
  }
  writeResource(form: ModbusForm, content: Content): Promise<void> {
    return this.performOperation(form, content) as Promise<void>;
  }
  invokeResource(form: ModbusForm, content: Content): Promise<Content> {
    return new Promise(async (resolve, reject) => {
      try {
        await this.performOperation(form, content)

        // As mqtt there is no response
        resolve({ type: ContentSerdes.DEFAULT, body: Buffer.from('') });
      } catch (error) {
        reject(error)
      }
    })
  }
  unlinkResource(form: ModbusForm): Promise<void> {
    form = this.validateAndFillDefaultForm(form, 'r', 0)
    const id = `${form.href}/${form['modbus:unitID']}#${form['modbus:function']}?${form['modbus:range'][0]}&${form['modbus:range'][1]}`


    this._subscriptions.get(id).unsubscribe()
    this._subscriptions.delete(id)

    return Promise.resolve()
  }
  public subscribeResource(form: ModbusForm,
    next: ((value: any) => void), error?: (error: any) => void, complete?: () => void): any {
    form = this.validateAndFillDefaultForm(form, 'r', 0)

    const id = `${form.href}/${form['modbus:unitID']}#${form['modbus:function']}?${form['modbus:range'][0]}&${form['modbus:range'][1]}`

    if (this._subscriptions.has(id)) {
      throw new Error('Already subscribed for ' + id + '. Multiple subscriptions are not supported');
    }

    this._subscriptions.set(id, new Subscription(form, this, next, error, complete))
  }
  start(): boolean {
    return true;
  }
  stop(): boolean {
    return true;
  }
  setSecurity(metadata: SecurityScheme[], credentials?: any): boolean {
    return false;
  }

  private async performOperation(form: ModbusForm, content?: Content): Promise<Content | void> {

    // get host and port
    let parsed = new URL(form.href);
    const port = parsed.port ? parseInt(parsed.port, 10) : DEFAULT_PORT

    form = this.validateAndFillDefaultForm(form, "w", content?.body.byteLength)

    let host = parsed.hostname;
    let hostAndPort = host + ":" + port;

    this.overrideFormFromURLPath(form);

    // TODO: validate content length
    /*
    let mpy = form === "in" || regType === "hold" ? 2 : 1;
    
    if (content && content.body.length != mpy * length) {
      throw new Error("Content length does not match register / coil count, got " + content.body.length + " bytes for "
        + length + " registers / coils");
    }*/

    // find or create connection
    let connection = this._connections.get(hostAndPort);

    if (!connection) {
      console.info("Creating new ModbusConnection for ", hostAndPort);
      this._connections.set(hostAndPort, new ModbusConnection(host, port));
      connection = this._connections.get(hostAndPort);
    }
    // create operation
    let operation = new PropertyOperation(form, content ? content.body : undefined);

    // enqueue the operation at the connection
    connection.enqueue(operation);

    // return a promise to execute the operation
    return operation.execute()
  }

  private overrideFormFromURLPath(input: ModbusForm) {
    let parsed = new URL(input.href);
    let pathComp = parsed.pathname.split('/')
    let query = parsed.searchParams

    input["modbus:unitID"] = parseInt(pathComp[1]) || input["modbus:unitID"];
    input["modbus:range"][0] = parseInt(query.get("offset")) || input["modbus:range"][0];
    input["modbus:range"][1] = parseInt(query.get("length")) || input["modbus:range"][1];
  }
  private validateAndFillDefaultForm(form: ModbusForm, mode: 'r' | 'w', contentLength = 0): ModbusForm {
    const result: ModbusForm = { ...form }

    if (!form["modbus:function"] && !form["modbus:entity"]) {
      throw new Error("Malformed form: modbus:function or modbus:entity must be defined");
    }


    if (form['modbus:function']) {
      // Convert string function to enums if defined
      if (typeof (form['modbus:function']) === 'string') {
        result['modbus:function'] = ModbusFunction[form['modbus:function']];
      }

      // Check if the function is a valid modbus function code
      if (!Object.keys(ModbusFunction).includes(result["modbus:function"].toString())) {
        throw new Error('Undefined function number or name: ' + form['modbus:function']);;
      }
    }

    if (form['modbus:entity']) {
      switch (form['modbus:entity']) {
        case 'Coil':
          result['modbus:function'] = mode === 'r' ? ModbusFunction.readCoil :
            contentLength > 1 ? ModbusFunction.writeMultipleCoils : ModbusFunction.writeSingleCoil;
          break;
        case 'HoldingRegister':
          // the content length must be divided by 2 (holding registers are 16bit)
          result['modbus:function'] = mode === 'r' ? ModbusFunction.readMultipleHoldingRegisters :
            contentLength / 2 > 1 ? ModbusFunction.writeMultipleHoldingRegisters :
              ModbusFunction.writeSingleHoldingRegister;
          break;
        case 'InputRegister':
          result['modbus:function'] = ModbusFunction.readInputRegister
          break;
        case 'DiscreteInput':
          result['modbus:function'] = ModbusFunction.readDiscreteInput
          break;
        default:
          throw new Error('Unknown modbus entity: ' + form['modbus:entity']);
      }
    } else {
      //'modbus:entity' undefined but modbus:function defined
      result["modbus:entity"] = modbusFunctionToEntity(result["modbus:function"] as ModbusFunction)
    }

    // fill default range
    if (!form['modbus:range']) {
      result['modbus:range'] = [0, 1]
    } else if (!form['modbus:range'][1] && contentLength === 0) {
      result['modbus:range'] = [form['modbus:range'][0], 1]
    } else if (!form['modbus:range'][1] && contentLength > 0) {
      const regSize = result["modbus:entity"] === 'InputRegister' || result["modbus:entity"] === 'HoldingRegister' ? 2 : 1
      result['modbus:range'] = [form['modbus:range'][0], contentLength]
    }

    result['modbus:pollingTime'] = form['modbus:pollingTime'] ? form['modbus:pollingTime'] : DEFAULT_POLLING
    result['modbus:timeout'] = form['modbus:timeout'] ? form['modbus:timeout'] : DEFAULT_TIMEOUT

    return result
  }
}

class Subscription {
  interval: NodeJS.Timeout;
  complete: () => void;
  constructor(form: ModbusForm, client: ModbusClient,
    next: ((value: any) => void), error?: (error: any) => void, complete?: () => void) {
    if (!complete) { complete = () => { return; } }
    this.interval = global.setInterval(async () => {
      try {
        const result = await client.readResource(form)
        next(result)
      } catch (e) {
        if (error) { error(e); }
        console.log(e);

        clearInterval(this.interval)
      }
    }, form['modbus:pollingTime'])


    this.complete = complete
  }

  unsubscribe() {
    clearInterval(this.interval)
    this.complete()
  }
}


const connectionTimeout = 2000;    // close Modbus connection after 2s



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
  currentTransaction: ModbusTransaction      // transaction currently in progress or null
  queue: Array<ModbusTransaction>     // queue of further transactions

  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
    this.client = new ModbusRTU(); //new ModbusClient();
    this.connecting = false;
    this.connected = false;
    this.timer = null;
    this.currentTransaction = null;
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
        (op.content != null) === (t.content != null)) {
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
  async trigger() {
    console.debug("ModbusConnection:trigger");
    if (!this.connecting && !this.connected) {
      console.info("Trying to connect to", this.host);
      this.connecting = true;
      try {
        await this.client.connectTCP(this.host, { port: this.port })
        this.connecting = false;
        this.connected = true;
        console.debug("[binding-modbus]","Modbus connected to " + this.host);
        this.trigger();
      } catch (error) {
        console.warn("Cannot connect to", this.host, "reason", error, " retry in 10s");
        this.connecting = false;
        setTimeout(() => this.trigger(), 10000); 
      }
    } else if (this.connected && this.currentTransaction == null && this.queue.length > 0) {
      // take next transaction from queue and execute
      this.currentTransaction = this.queue.shift();
      try {
        await this.currentTransaction.execute()
        this.currentTransaction = null;
        this.trigger();
      } catch (error) {
        console.warn("MODBUS transaction failed:", error);
        this.currentTransaction = null;
        this.trigger();
      }
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

  readModbus(transaction: ModbusTransaction): Promise<ReadCoilResult | ReadRegisterResult> {
    console.debug("Invoking read transaction");
    // reset connection idle timer
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = global.setTimeout(() => this.modbusstop(), connectionTimeout);

    const regtype: ModbusEntity = transaction.registerType;
    this.client.setID(transaction.unitId);

    if (regtype === "InputRegister") return this.client.readInputRegisters(transaction.base, transaction.length);
    if (regtype === "Coil") return this.client.readCoils(transaction.base, transaction.length);
    if (regtype === "HoldingRegister") return this.client.readHoldingRegisters(transaction.base, transaction.length);
    if (regtype === "DiscreteInput") return this.client.readDiscreteInputs(transaction.base, transaction.length);

    //no match
    return Promise.reject("cannot read unknown register type " + regtype);
  }

  writeModbus(transaction: ModbusTransaction): Promise<void> {
    console.debug("Invoking write transaction");
    // reset connection idle timer
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = global.setTimeout(() => this.modbusstop(), connectionTimeout);

    const regtype: ModbusEntity = transaction.registerType;
    this.client.setID(transaction.unitId);

    if (regtype === "Coil") {
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

    if (regtype === "HoldingRegister") {
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
        for (let i = 0; i < transaction.length; i++) {
          values.push(transaction.content.readUInt16BE(i));
          i++
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
  registerType: ModbusEntity
  base: number
  length: number
  content?: Buffer
  operations: Array<PropertyOperation>    // operations to be completed when this transaction completes

  constructor(connection: ModbusConnection, unitId: number, registerType: ModbusEntity, base: number, length: number, content?: Buffer) {
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
  async execute(): Promise<void> {
    if (!this.content) {
      // Read transaction
      console.debug("Trigger MODBUS read operation on", this.base, "len", this.length);
      try {
        const result = await this.connection.readModbus(this)
        console.debug("[binding-modbus]", "Got result from MODBUS read operation on", this.base, "len", this.length);
        this.operations.forEach(op => op.done(this.base, result.buffer, result.data));
      } catch (error) {
        console.warn("[binding-modbus]","MODBUS read operation failed on", this.base, "len", this.length, error);
        // inform all operations and the invoker
        this.operations.forEach(op => op.failed(error));
        throw error;
      }
      
    } else {
      console.log("[binding-modbus]","Trigger MODBUS write operation on", this.base, "len", this.length);
      try {
        await this.connection.writeModbus(this)
        this.operations.forEach(op => op.done());
      } catch (error) {
        console.warn("[binding-modbus]","MODBUS write operation failed on", this.base, "len", this.length, error);
        // inform all operations and the invoker
        this.operations.forEach(op => op.failed(error));
        throw error;
      }
    }
  }
}

/**
 * PropertyOperation represents a read or write operation on a property
 */
class PropertyOperation {
  unitId: number
  registerType: ModbusEntity
  base: number
  length: number
  content?: Buffer
  transaction: ModbusTransaction      // transaction used to execute this operation
  resolve: (value?: Content | PromiseLike<Content>) => void
  reject: (reason?: any) => void

  constructor(form: ModbusForm, content?: Buffer) {
    this.unitId = form["modbus:unitID"];
    this.registerType = form["modbus:entity"];
    this.base = form["modbus:range"][0];
    this.length = form["modbus:range"][1];
    this.content = content;
    this.transaction = null;
  }

  /**
   * Trigger execution of this operation.
   * 
   */
  async execute(): Promise<Content | PromiseLike<Content>> {
    return new Promise((resolve: (value?: Content | PromiseLike<Content>) => void, reject: (reason?: any) => void)=>{
      this.resolve = resolve;
      this.reject = reject;

      if (this.transaction == null) {
        reject("No transaction for this operation");
      } else {
        this.transaction.trigger();
      }
    })
  }

  /**
   * Invoked by the ModbusTransaction when it has completed successfully
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


    if (this.registerType === "InputRegister" || this.registerType === "HoldingRegister") {
      let bufstart = 2 * offset;
      let bufend = 2 * (offset + this.length);

      resp = {
        body: buffer.slice(bufstart, bufend),
        type: 'application/octet-stream'
      };
    } else {
      resp = {
        body: buffer.slice(offset, this.length),
        type: 'application/octet-stream'
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