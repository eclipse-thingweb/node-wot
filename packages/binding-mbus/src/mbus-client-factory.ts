import { ProtocolClientFactory, ProtocolClient } from '@node-wot/core';
import MBusClient from './mbus-client';

export default class MBusClientFactory implements ProtocolClientFactory {
  public readonly scheme: string = 'mbus+tcp';

  public getClient(): ProtocolClient {
    console.log(`MBusClientFactory creating client for '${this.scheme}'`);
    return new MBusClient();
  }
  public init = () => true;
  public destroy = () => true;
}
