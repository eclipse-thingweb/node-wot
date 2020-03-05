import { Form } from '@node-wot/td-tools';
export { default as ModbusClientFactory } from './modbus-client-factory';
export class ModbusForm extends Form {
  public 'modbus:function': number;
  public 'modbus:unitID': number;
  public 'modbus:range'?: [number, number?];
  public 'modbus:timeout'?: number;
  public 'modbus:pollingTime'?: number;
}
