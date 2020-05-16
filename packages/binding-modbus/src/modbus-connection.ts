import ModbusRTU from 'modbus-serial'
import { ReadCoilResult, ReadRegisterResult } from 'modbus-serial/ModbusRTU'
import { ModbusEntity, ModbusFunction, ModbusForm } from './modbus'
import { Content } from '@node-wot/core'

const configDefaults = {
  operationTimeout: 2000,
  connectionRetryTime: 10000,
  maxRetries: 5
}

/**
 * ModbusConnection represents a client connected to a specific host and port
 */
export class ModbusConnection {
  host: string
  port: number
  client: any // ModbusClient.IModbusRTU
  connecting: boolean
  connected: boolean
  timer: NodeJS.Timer                 // connection idle timer
  currentTransaction: ModbusTransaction      // transaction currently in progress or null
  queue: Array<ModbusTransaction>     // queue of further transactions
  config: { connectionTimeout?: number, operationTimeout?: number; connectionRetryTime?: number; maxRetries?: number }

  constructor(host: string, port: number, config: {
    connectionTimeout?: number, operationTimeout?: number; connectionRetryTime?: number; maxRetries?: number
  } = configDefaults) {
    this.host = host;
    this.port = port;
    this.client = new ModbusRTU(); // new ModbusClient();
    this.connecting = false;
    this.connected = false;
    this.timer = null;
    this.currentTransaction = null;
    this.queue = new Array<ModbusTransaction>();

    this.config = Object.assign(configDefaults, config)
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
    let transaction = new ModbusTransaction(this, op.unitId, op.registerType,
      op.function, op.base, op.length, op.content);
    transaction.inform(op);
    this.queue.push(transaction);
  }

  async connect() {
    if (!this.connecting && !this.connected) {
      console.debug('[binding-modbus]', 'Trying to connect to', this.host);
      this.connecting = true;

      for (let retry = 0; retry < this.config.maxRetries; retry++) {
        try {
          this.client.setTimeout(this.config.connectionTimeout)
          await this.client.connectTCP(this.host, { port: this.port })
          this.connecting = false;
          this.connected = true;
          console.debug('[binding-modbus]', 'Modbus connected to ' + this.host);
          return
        } catch (error) {
          console.warn('[binding-modbus]', 'Cannot connect to', this.host, 'reason', error, ` retry in ${this.config.connectionRetryTime}ms`);
          this.connecting = false;
          if (retry >= this.config.maxRetries - 1) {
            throw new Error('Max connection retries');
          }
          await new Promise(r => setTimeout(r, this.config.connectionRetryTime));
        }
      }
    }
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
    console.debug('[binding-modbus]', 'ModbusConnection:trigger');
    if (!this.connecting && !this.connected) {
      // connection may be closed due to operation timeout
      // try to reconnect again
      try {
        await this.connect()
        this.trigger()
      } catch (error) {
        console.warn('[binding-modbus]', 'cannot reconnect to modbus server')
        // inform all the operations that the connection cannot be recovered
        this.queue.forEach(transaction => {
          transaction.operations.forEach(op => {
            op.failed(error)
          })
        })
      }
    } else if (this.connected && this.currentTransaction == null && this.queue.length > 0) {
      // take next transaction from queue and execute
      this.currentTransaction = this.queue.shift();
      try {
        await this.currentTransaction.execute()
        this.currentTransaction = null;
        this.trigger();
      } catch (error) {
        console.warn('[binding-modbus]', 'transaction failed:', error);
        this.currentTransaction = null;
        this.trigger();
      }
    }
  }

  public close() {
    this.modbusstop();
  }

  async readModbus(transaction: ModbusTransaction): Promise<ReadCoilResult | ReadRegisterResult> {
    console.debug('[binding-modbus]', 'Invoking read transaction');
    // reset connection idle timer
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = global.setTimeout(() => this.modbusstop(), this.config.operationTimeout);

    const regType: ModbusEntity = transaction.registerType;
    this.client.setID(transaction.unitId);

    switch (regType) {
      case 'InputRegister':
        return this.client.readInputRegisters(transaction.base, transaction.length);
      case 'Coil':
        return this.client.readCoils(transaction.base, transaction.length);
      case 'HoldingRegister':
        return this.client.readHoldingRegisters(transaction.base, transaction.length);
      case 'DiscreteInput':
        return this.client.readDiscreteInputs(transaction.base, transaction.length);
      default:
        throw new Error('cannot read unknown register type ' + regType);
    }
  }

  async writeModbus(transaction: ModbusTransaction): Promise<void> {
    console.debug('[binding-modbus]', 'Invoking write transaction');
    // reset connection idle timer
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = global.setTimeout(() => this.modbusstop(), this.config.operationTimeout);

    const modFunc: ModbusFunction = transaction.function;
    this.client.setID(transaction.unitId);

    switch (modFunc) {
      case 5: // write single coil
        const coil = transaction.content.readUInt8(0) !== 0;
        const result = await this.client.writeCoil(transaction.base, coil)

        if (result.address !== transaction.base && result.state !== coil) {
          throw new Error(`writing ${coil} to ${transaction.base} failed, state is ${result.state}`);
        }

        break;
      case 15: // write multiple coils
        const coils = new Array<boolean>();
        transaction.content.forEach(v => coils.push(v !== 0));
        const coilsResult = await this.client.writeCoils(transaction.base, coils)
        if (coilsResult.address !== transaction.base && coilsResult.length !== transaction.length) {
          throw new Error(`writing ${coils} to ${transaction.base} failed`);
        }
        break;
      case 6: // writing a single value to a single register
        let value = transaction.content.readUInt16BE(0);
        const resultRegister = await this.client.writeRegister(transaction.base, value)

        if (resultRegister.address !== transaction.base && resultRegister.value !== value) {
          throw new Error(`writing ${value} to ${transaction.base} failed, state is ${result.value}`);
        }
        break;
      case 16: // writing values to multiple registers
        let values = new Array<number>();
        // transaction length contains the total number of register to be written
        for (let i = 0; i < transaction.length * 2; i++) {
          values.push(transaction.content.readUInt16BE(i));
          i++
        }
        const registers = await this.client.writeRegisters(transaction.base, values)

        if (registers.address === transaction.base && transaction.length / 2 > registers.length) {
          console.warn(`short write to registers ${transaction.base} + ${transaction.length}, wrote ${values} to ${registers.address} + ${registers.length} `)
        } else if (registers.address !== transaction.base) {
          throw new Error(`writing ${values} to registers ${transaction.base} + ${transaction.length} failed, wrote to ${registers.address}`)
        }
        break;
      default:
        throw new Error('cannot read unknown function type ' + modFunc);
    }
  }
  private modbusstop() {
    console.debug('[binding-modbus]', 'Closing unused connection');
    this.client.close((err: string) => {
      if (!err) {
        console.debug('[binding-modbus]', 'session closed');
        this.connecting = false;
        this.connected = false;
      } else {
        console.error('[binding-modbus]', 'cannot close session ' + err);
      }
    });
    clearInterval(this.timer)
    this.timer = null;
  }
}

/**
 * ModbusTransaction represents a raw MODBUS operation performed on a ModbusConnection
 */
class ModbusTransaction {
  connection: ModbusConnection
  unitId: number
  registerType: ModbusEntity
  function: ModbusFunction
  base: number
  length: number
  content?: Buffer
  operations: Array<PropertyOperation>    // operations to be completed when this transaction completes

  constructor(connection: ModbusConnection, unitId: number, registerType: ModbusEntity,
    func: ModbusFunction, base: number, length: number, content?: Buffer) {
    this.connection = connection;
    this.unitId = unitId;
    this.registerType = registerType;
    this.function = func
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
    console.debug('[binding-modbus]', 'ModbusTransaction:trigger');
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
      console.debug('[binding-modbus]', 'Trigger read operation on', this.base, 'len', this.length);
      try {
        const result = await this.connection.readModbus(this)
        console.debug('[binding-modbus]', 'Got result from read operation on', this.base, 'len', this.length);
        this.operations.forEach(op => op.done(this.base, result.buffer));
      } catch (error) {
        console.warn('[binding-modbus]', 'read operation failed on', this.base, 'len', this.length, error);
        // inform all operations and the invoker
        this.operations.forEach(op => op.failed(error));
        throw error;
      }

    } else {
      console.debug('[binding-modbus]', 'Trigger write operation on', this.base, 'len', this.length);
      try {
        await this.connection.writeModbus(this)
        this.operations.forEach(op => op.done());
      } catch (error) {
        console.warn('[binding-modbus]', 'write operation failed on', this.base, 'len', this.length, error);
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
export class PropertyOperation {
  unitId: number
  registerType: ModbusEntity
  base: number
  length: number
  function: ModbusFunction
  content?: Buffer
  transaction: ModbusTransaction      // transaction used to execute this operation
  resolve: (value?: Content | PromiseLike<Content>) => void
  reject: (reason?: any) => void

  constructor(form: ModbusForm, content?: Buffer) {
    this.unitId = form['modbus:unitID'];
    this.registerType = form['modbus:entity'];
    this.base = form['modbus:range'][0];
    this.length = form['modbus:range'][1];
    this.function = form['modbus:function'] as ModbusFunction;
    this.content = content;
    this.transaction = null;
  }

  /**
   * Trigger execution of this operation.
   * 
   */
  async execute(): Promise<Content | PromiseLike<Content>> {
    return new Promise((resolve: (value?: Content | PromiseLike<Content>) => void, reject: (reason?: any) => void) => {
      this.resolve = resolve;
      this.reject = reject;

      if (this.transaction == null) {
        reject('No transaction for this operation');
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
  done(base?: number, buffer?: Buffer) {
    console.debug('[binding-modbus]', 'Operation done');

    if (base === null || base === undefined) {
      // resolve write operation
      this.resolve();
      return;
    }

    // extract the proper part from the result and resolve promise
    let offset = this.base - base;
    let resp: Content;


    if (this.registerType === 'InputRegister' || this.registerType === 'HoldingRegister') {
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
    console.warn('[binding-modbus]', 'Operation failed:', reason);
    // reject the Promise given to the invoking script
    this.reject(reason);
  }
}
