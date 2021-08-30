/**
 * M-Bus master based on node-mbus
 */
import { MBusForm } from './mbus'

import { ProtocolClient, Content, ContentSerdes } from '@node-wot/core'
import { SecurityScheme } from '@node-wot/td-tools'
import { MBusConnection, PropertyOperation } from './mbus-connection'

const DEFAULT_PORT = 805
const DEFAULT_TIMEOUT = 1000

export default class MBusClient implements ProtocolClient {
  private _connections: Map<string, MBusConnection>;

  constructor() {
    this._connections = new Map()
  }
  readResource(form: MBusForm): Promise<Content> {
    return this.performOperation(form) as Promise<Content>
  }
  writeResource(form: MBusForm, content: Content): Promise<void> {
    return new Promise<void>((resolve, reject) => {
		throw new Error('Method not implemented.');
	});
  }
  invokeResource(form: MBusForm, content: Content): Promise<Content> {
    return new Promise<Content>((resolve, reject) => {
		throw new Error('Method not implemented.');
	});
  }
  unlinkResource(form: MBusForm): Promise<void> {
    return new Promise<void>((resolve, reject) => {
		throw new Error('Method not implemented.');
	});
  }
  public subscribeResource(form: MBusForm,
    next: ((value: any) => void), error?: (error: any) => void, complete?: () => void): any {
		
    return new Promise<Content>((resolve, reject) => {
		throw new Error('Method not implemented.');
	});
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

  private async performOperation(form: MBusForm): Promise<Content | void> {

    // get host and port
    let parsed = new URL(form.href);
    const port = parsed.port ? parseInt(parsed.port, 10) : DEFAULT_PORT

    form = this.validateAndFillDefaultForm(form)

    let host = parsed.hostname;
    let hostAndPort = host + ':' + port;

    this.overrideFormFromURLPath(form);

    // find or create connection
    let connection = this._connections.get(hostAndPort);

    if (!connection) {
      console.debug('[binding-mbus]', 'Creating new MbusConnection for ', hostAndPort);
      this._connections.set(hostAndPort, new MBusConnection(host, port, {connectionTimeout: form['mbus:timeout'] || DEFAULT_TIMEOUT}));
      connection = this._connections.get(hostAndPort);
    }else {
      console.debug('[binding-mbus]', 'Reusing MbusConnection for ', hostAndPort);
    }
    // create operation
    let operation = new PropertyOperation(form);

    // enqueue the operation at the connection
    connection.enqueue(operation);

    // return a promise to execute the operation
    return operation.execute()
  }

  private overrideFormFromURLPath(input: MBusForm) {
    let parsed = new URL(input.href);
    let pathComp = parsed.pathname.split('/')
    let query = parsed.searchParams

    input['mbus:unitID'] = parseInt(pathComp[1], 10) || input['mbus:unitID'];
    input['mbus:offset'] = parseInt(query.get('offset'), 10) || input['mbus:offset'];
    input['mbus:timeout'] = parseInt(query.get('timeout'), 10) || input['mbus:timeout'];
  }
  
  private validateAndFillDefaultForm(form: MBusForm): MBusForm {
    const result: MBusForm = { ...form }

    if(form['mbus:unitID'] === undefined || form['mbus:unitID'] === null) {
        throw new Error('Malformed form: unitID must be defined');
    }
	if(form['mbus:offset'] === undefined || form['mbus:offset'] === null) {
        throw new Error('Malformed form: offset must be defined');
    }
	
    result['mbus:timeout'] = form['mbus:timeout'] ? form['mbus:timeout'] : DEFAULT_TIMEOUT

    return result
  }
}
