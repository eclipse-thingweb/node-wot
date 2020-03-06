
import { ModbusForm, ModbusFunction, ModbusFunctionName } from './modbus'
import ModbusRTU from 'modbus-serial'

import { ProtocolClient, Content, ContentSerdes } from '@node-wot/core'

const DEFAULT_PORT = 805
const DEFAULT_TIMEOUT = 1000
const DEFAULT_POLLING = 2000

export default class ModbusClient implements ProtocolClient {
  private _client: ModbusRTU;

  private _subscriptions: Map<string, Subscription> = new Map();

  constructor() {
    this._client = new ModbusRTU()

  }
  readResource(form: ModbusForm): Promise<Content> {
    return this.modbusRead(form)
  }
  writeResource(form: ModbusForm, content: Content): Promise<void> {
    return this.modbusWrite(form, content)
  }
  invokeResource(form: ModbusForm, content: Content): Promise<Content> {
    return new Promise(async (resolve, reject) => {
      try {
        await this.modbusWrite(form, content)

        // As mqtt there is no response
        resolve({ type: ContentSerdes.DEFAULT, body: Buffer.from('') });
      } catch (error) {
        reject(error)
      }
    })
  }
  unlinkResource(form: ModbusForm): Promise<void> {
    form = this.fillDefaultForm(form, 'r', 0)
    const id = `${form.href}/${form['modbus:unitID']}#${form['modbus:function']}?${form['modbus:range'][0]}&${form['modbus:range'][1]}`


    this._subscriptions.get(id).unsubscribe()
    this._subscriptions.delete(id)

    return Promise.resolve()
  }
  public subscribeResource(form: ModbusForm,
    next: ((value: any) => void), error?: (error: any) => void, complete?: () => void): any {
    form = this.fillDefaultForm(form, 'r', 0)

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
  setSecurity(metadata: import('../../td-tools/dist/thing-description').SecurityScheme[], credentials?: any): boolean {
    return false;
  }

  private async modbusRead(form: ModbusForm) {
    let parsed = new URL(form.href);
    const port = parsed.port ? parseInt(parsed.port, 10) : DEFAULT_PORT
    form = this.fillDefaultForm(form, 'r', 0)

    await this._client.connectTCP(parsed.hostname, { port: port });

    this._client.setID(form['modbus:unitID']);
    this._client.setTimeout(form['modbus:timeout'])

    let data: any;

    switch (form['modbus:function']) {
      case 1:
        data = await this._client.readCoils(form['modbus:range'][0], form['modbus:range'][1])
        break;
      case 2:
        data = await this._client.readDiscreteInputs(form['modbus:range'][0], form['modbus:range'][1])
        break;
      case 3:
        data = await this._client.readHoldingRegisters(form['modbus:range'][0], form['modbus:range'][1])
        break;
      case 4:
        data = await this._client.readInputRegisters(form['modbus:range'][0], form['modbus:range'][1])
        break;
      default:
        throw new Error('Undefined function number: ' + form['modbus:function'])
    }

    this._client.close(() => { return; })

    return {
      type: 'application/octet-stream',
      body: data.buffer
    }
  }

  private async modbusWrite(form: ModbusForm, content: Content) {
    let parsed = new URL(form.href);
    const port = parsed.port ? parseInt(parsed.port, 10) : DEFAULT_PORT
    form = this.fillDefaultForm(form, 'w', content.body.byteLength)

    await this._client.connectTCP(parsed.hostname, { port: port });
    this._client.setID(form['modbus:unitID']);
    this._client.setTimeout(form['modbus:timeout'])

    let data: any;

    switch (form['modbus:function']) {
      case 5:
        data = content.body.readUInt8(0) ? true : false;
        await this._client.writeCoil(form['modbus:range'][0], data)
        break;
      case 15:
        data = []
        content.body.forEach(num => {
          data.push(num)
        })

        await this._client.writeCoils(form['modbus:range'][0], data)
        break;
      case 6:
        data = content.body.readInt16BE(0)
        await this._client.writeRegister(form['modbus:range'][0], data)
        break;
      case 16:
        data = []
        for (let index = 0; index < content.body.length; index++) {
          data.push(content.body.readInt16BE(index))
          index++;
        }
        await this._client.writeRegisters(form['modbus:range'][0], data)
        break;
      default:
        throw new Error('Undefined function number: ' + form['modbus:function']);
    }

    this._client.close(() => { return; })
  }
  private fillDefaultForm(form: ModbusForm, mode: 'r' | 'w', contentLength: number): ModbusForm {
    const result: ModbusForm = { ...form }

    // fill default range
    if (!form['modbus:range']) {
      result['modbus:range'] = [0, 1]
    } else if (!form['modbus:range'][1]) {
      result['modbus:range'] = [form['modbus:range'][0], 1]
    }

    // Convert string function to enums
    if (typeof (form['modbus:function']) === 'string') {
      result['modbus:function'] = ModbusFunction[form['modbus:function']]
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
    this.interval = setInterval(async () => {
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
