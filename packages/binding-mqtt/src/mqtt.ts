import { Form } from "@node-wot/td-tools";

export { default as MqttServer } from "./mqtt-server";
export { default as MqttClient } from "./mqtt-client";
export { default as MqttClientFactory } from "./mqtt-client-factory";
export { default as MqttsClientFactory } from "./mqtts-client-factory";
export { default as BrokerProxy} from './broker-proxy';
export { default as ExternalBrokerProxy } from './external-broker-proxy';
export * from "./mqtt-server";
export * from "./mqtt-client";
export * from "./mqtt-client-factory";
export * from "./mqtts-client-factory";

export const MQTT_PORT_DEFAULT = 1883;
export const MQTTS_PORT_DEFAULT = 8883;
export interface MqttClientOptions {
    port?: number,
    host?: string,
    path?: string

    /* MQTTv3.1.1 := 4, MQTTv5 := 5 */
    protocolVersion?: 4 | 5
    qos?: MqttQoS
    username?: string
    password?: string
    /* Keep-Alive time of MQTT connection in seconds */
    keepAlive?: number
    /* Optional private keys in PEM format. */
    key?: string | string[] | Buffer | Buffer[] | Object[]
    /* Optional certificate chains in PEM format. */
    cert?: string | string[] | Buffer | Buffer[]
}

export interface MqttProxyOptions {
    /* MQTT Protocol Version: 4 := MQTTv3.1.1, 5:= MQTTv5 */
    protocolVersion?: 4 | 5

    port?: number

    /* The string identifying the host, does not include port. */
    host?: string

    /* Additional path: {host}:{port}/{path} */
    path?: string

    protocol?: "mqtt" | "mqtts"

    /* Keep-Alive time of MQTT connection in seconds */
    keepalive?: number
}

/**
 * MQTT Quality of Service level.
 * QoS0: Fire-and-forget
 * QoS1: Deliver-at-least-once
 * QoS2: Deliver-exactly-once
 */
export enum MqttQoS { QoS0, QoS1, QoS2 }

export class MqttForm extends Form {
    public "mqtt:topic": string;
    public "mqtt:retain": boolean;
    public "mqtt:qos"?: MqttQoS;

    constructor(href: string, contentType: string, topic: string, retain: boolean = false, qos?: number) {
        super(href, contentType);
        this["mqtt:topic"] = topic;
        this["mqtt:retain"] = retain;
        if (typeof qos !== "undefined" && qos !== null) {
            this["mqtt:qos"] = qos;
        }
    }

}

/* Models the relevant properties of a MQTT publish message. */
export interface MqttMessage {
    type: string
    topic: string
}
export interface MqttPublish extends MqttMessage {
    type: "publish"
    payload: Buffer
    retain: boolean
    properties?: {
        contentType?: string
        payloadFormatIndicator?: boolean
        responseTopic?: string
        correlationData?: Buffer
        topicAlias?: number
        userProperties?: Object
        subscriptionIdentifier?: number
    }
}

/* Models the relevant properties of a MQTT subscribe message. */
export interface MqttSubscribe extends MqttMessage {
    type: "subscribe"
}