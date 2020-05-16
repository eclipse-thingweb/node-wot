import { ProtocolClientFactory, ProtocolClient } from '@node-wot/core';
import ModbusClient from './modbus-client';

export default class ModbusClientFactory implements ProtocolClientFactory {
  public readonly scheme: string = 'modbus+tcp';

  public getClient(): ProtocolClient {
    console.log(`ModbusClientFactory creating client for '${this.scheme}'`);
    return new ModbusClient();
  }
  public init = () => true;
  public destroy = () => true;
}
