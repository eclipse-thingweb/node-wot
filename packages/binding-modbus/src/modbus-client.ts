/**
 * Modbus master based on modbus-serial
 */
import { ModbusForm, ModbusFunction } from './modbus'

import { ProtocolClient, Content, ContentSerdes } from '@node-wot/core'
import { SecurityScheme } from '@node-wot/td-tools'
import { modbusFunctionToEntity } from './utils'
import { ModbusConnection, PropertyOperation } from './modbus-connection'

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
    form = this.validateAndFillDefaultForm(form, 0)
    const id = `${form.href}/${form['modbus:unitID']}#${form['modbus:function']}?${form['modbus:range'][0]}&${form['modbus:range'][1]}`


    this._subscriptions.get(id).unsubscribe()
    this._subscriptions.delete(id)

    return Promise.resolve()
  }
  public subscribeResource(form: ModbusForm,
    next: ((value: any) => void), error?: (error: any) => void, complete?: () => void): any {
    form = this.validateAndFillDefaultForm(form, 0)

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
    this._connections.forEach(connection => {
      connection.close()
    })
    return true;
  }
  setSecurity(metadata: SecurityScheme[], credentials?: any): boolean {
    return false;
  }

  private async performOperation(form: ModbusForm, content?: Content): Promise<Content | void> {

    // get host and port
    let parsed = new URL(form.href);
    const port = parsed.port ? parseInt(parsed.port, 10) : DEFAULT_PORT

    form = this.validateAndFillDefaultForm(form, content ?.body.byteLength)

    let host = parsed.hostname;
    let hostAndPort = host + ':' + port;

    this.overrideFormFromURLPath(form);

    if (content) {
      this.validateContentLength(form, content)
    }

    // find or create connection
    let connection = this._connections.get(hostAndPort);

    if (!connection) {
      console.debug('[binding-modbus]', 'Creating new ModbusConnection for ', hostAndPort);
      this._connections.set(hostAndPort, new ModbusConnection(host, port));
      connection = this._connections.get(hostAndPort);
    }else {
      console.debug('[binding-modbus]', 'Reusing ModbusConnection for ', hostAndPort);
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

    input['modbus:unitID'] = parseInt(pathComp[1], 10) || input['modbus:unitID'];
    input['modbus:range'][0] = parseInt(query.get('offset'), 10) || input['modbus:range'][0];
    input['modbus:range'][1] = parseInt(query.get('length'), 10) || input['modbus:range'][1];
  }

  private validateContentLength(form: ModbusForm, content: Content) {

    const mpy = form['modbus:entity'] === 'InputRegister' || form['modbus:entity'] === 'HoldingRegister' ? 2 : 1;
    const length = form['modbus:range'][1]
    if (content && content.body.length !== mpy * length) {
      throw new Error('Content length does not match register / coil count, got ' + content.body.length + ' bytes for '
        + length + ` ${mpy === 2 ? 'registers' : 'coils'}`);
    }
  }
  private validateAndFillDefaultForm(form: ModbusForm, contentLength = 0): ModbusForm {
    const result: ModbusForm = { ...form }
    const mode = contentLength > 0 ? 'w' : 'r';

    if (!form['modbus:function'] && !form['modbus:entity']) {
      throw new Error('Malformed form: modbus:function or modbus:entity must be defined');
    }


    if (form['modbus:function']) {
      // Convert string function to enums if defined
      if (typeof (form['modbus:function']) === 'string') {
        result['modbus:function'] = ModbusFunction[form['modbus:function']];
      }

      // Check if the function is a valid modbus function code
      if (!Object.keys(ModbusFunction).includes(result['modbus:function'].toString())) {
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
      // 'modbus:entity' undefined but modbus:function defined
      result['modbus:entity'] = modbusFunctionToEntity(result['modbus:function'] as ModbusFunction)
    }

    // fill default range
    if (!form['modbus:range']) {
      result['modbus:range'] = [0, 1]
    } else if (!form['modbus:range'][1] && contentLength === 0) {
      result['modbus:range'] = [form['modbus:range'][0], 1]
    } else if (!form['modbus:range'][1] && contentLength > 0) {
      const regSize = result['modbus:entity'] === 'InputRegister' ||
        result['modbus:entity'] === 'HoldingRegister' ? 2 : 1;
      result['modbus:range'] = [form['modbus:range'][0], contentLength / regSize]
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
