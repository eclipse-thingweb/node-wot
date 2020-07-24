import { Form } from '@node-wot/td-tools';
export { default as ModbusClientFactory } from './modbus-client-factory';
export { default as ModbusClient } from './modbus-client';
export * from './modbus-client';
export * from './modbus-client-factory';

export class ModbusForm extends Form {
  /**
   * The modbus function issued in the request.
   */
  public 'modbus:function'?: ModbusFunction | ModbusFunctionName;
  /**
   * Describe the entity type of the request. This property can be 
   * used instead of 'modbus:fuction' when the form has multiple op. For
   * example if op = ['readProperty','writeProperty'] and 'modbus:function
   * is 'Coil', the low level modbus function will be mapped to 1 when
   * reading and to 5 when writing.
   */
  public 'modbus:entity'?: ModbusEntity
  /**
   * Physical address of the unit connected to the bus.
   */
  public 'modbus:unitID': number;
  /**
   * Defines how many registers or coils should be written. The first
   * element of the tuple is the starting address while the second is 
   * the total amount of registers. For example [2,3] means that registers
   * 2,3,4 will be returned as response.
   */
  public 'modbus:range'?: [number, number?];
  /**
   * Timeout in milliseconds of the modbus request. Default to 1000 milliseconds
   */
  public 'modbus:timeout'?: number;
  /**
   * Used for subscriptions. The client will issue a reading 
   * command every modbus:pollingTime milliseconds. Note that 
   * the reading request timeout can be still controlled using
   * modbus:timeout property. 
   */
  public 'modbus:pollingTime'?: number;
}

/**
 * Different modbus function names as defined in
 * https://en.wikipedia.org/wiki/Modbus. 
 */
export type ModbusFunctionName = 'readCoil' | 'readDiscreteInput' | 'readMultipleHoldingRegisters' |
  'writeSingleCoil' | 'writeSingleHoldingRegister' | 'writeMultipleCoils' | 'writeMultipleHoldingRegisters';

export type ModbusEntity = 'Coil' | 'InputRegister' | 'HoldingRegister' | 'DiscreteInput'
export enum ModbusFunction {
  'readCoil' = 1,
  'readDiscreteInput' = 2,
  'readMultipleHoldingRegisters' = 3,
  'readInputRegister' = 4,
  'writeSingleCoil' = 5,
  'writeSingleHoldingRegister' = 6,
  'writeMultipleCoils' = 15,
  'writeMultipleHoldingRegisters' = 16
}
