import { ProtocolClient, Content } from '@node-wot/core';
import { Form } from '@node-wot/td-tools';
import { MqttForm } from './mqtt';
export default class MqttClient implements ProtocolClient {
    constructor(config?: any, secure?: boolean);
    private client;
    subscribeResource(form: MqttForm, next: ((value: any) => void), error?: (error: any) => void, complete?: () => void): any;
    readResource: (form: MqttForm) => Promise<Content>;
    writeResource: (form: MqttForm, content: Content) => Promise<void>;
    invokeResource: (form: MqttForm, content: Content) => Promise<Content>;
    unlinkResource: (form: Form) => Promise<void>;
    start: () => boolean;
    stop: () => boolean;
    setSecurity(metadata: Array<WoT.Security>, credentials?: any): boolean;
    private mapQoS;
    private logError;
}
