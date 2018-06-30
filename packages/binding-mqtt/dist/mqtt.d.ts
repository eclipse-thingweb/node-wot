import { Form } from "@node-wot/td-tools";
export { default as MqttClient } from './mqtt-client';
export { default as MqttClientFactory } from './mqtt-client-factory';
export * from './mqtt-client';
export * from './mqtt-client-factory';
export declare enum MqttQoS {
    QoS0 = 0,
    QoS1 = 1,
    QoS2 = 2
}
export declare class MqttForm extends Form {
    'mqtt:qos': MqttQoS;
    'mqtt:retain': Boolean;
}
