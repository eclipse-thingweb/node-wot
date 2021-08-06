import { Form } from '@node-wot/td-tools';
export { default as MBusClientFactory } from './mbus-client-factory';
export { default as MBusClient } from './mbus-client';
export * from './mbus-client';
export * from './mbus-client-factory';

export class MBusForm extends Form {
  /**
   * Physical address of the unit connected to the bus.
   */
  public 'mbus:unitID': number;
  /**
   * Defines the starting address of registers or coils that are
   * meant to be written.
   */
  public 'mbus:offset'?: number;
  /**
   * Timeout in milliseconds of the modbus request. Default to 1000 milliseconds
   */
  public 'mbus:timeout'?: number;
}