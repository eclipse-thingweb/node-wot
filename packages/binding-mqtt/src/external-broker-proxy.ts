import MqttBrokerProxy from "./broker-proxy";
import * as mqtt from "mqtt";
import { Subject } from "rxjs";
import { MqttMessage, MqttQoS, MqttPublish, MqttClientOptions, MQTTS_PORT_DEFAULT, MQTT_PORT_DEFAULT, MqttProxyOptions } from "./mqtt";


/**
 * This proxy implementation connects to an external MQTT broker 
 * through an internal MQTT client.
 * 
 * Properties are publish as MQTT retained message.
 * Not all requirements can be modelled with this method.
 * However, other, non-WoT clients could override those
 * by sending other retained messages.
 */
export default class ExternalBrokerProxy extends MqttBrokerProxy {

    // Options for internal client; 
    // connection parameters (host, port, protocol) are taken from inherited proxy options. */
    private clientOptions: MqttClientOptions = {
        protocolVersion: 5,
        qos: 1,
        keepAlive: 60
    };
    private secureClient: boolean;
    private mqttClient: mqtt.MqttClient;

    constructor(options: MqttProxyOptions, clientOptions?: MqttClientOptions, secureClient: boolean = false) {
        super(options);
        this.secureClient = secureClient;
        Object.assign(this.clientOptions, clientOptions);
    }

    public start(port?: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const options: mqtt.IClientOptions = {
                protocol: this.secureClient ? "mqtts" : "mqtt",
                host: this.proxyOptions.host,
                path: this.proxyOptions.path ? this.proxyOptions.path : "",
                clientId: "_node-wot-externalproxy_" + Math.trunc(Math.random() * 1000).toString()
            };
            options.port = this.proxyOptions.port ? this.proxyOptions.port
                : options.protocol === "mqtts" ? MQTTS_PORT_DEFAULT : MQTT_PORT_DEFAULT;

            // Set username and password only if present.
            if (this.clientOptions) {
                if (this.clientOptions.username) {
                    options.username = this.clientOptions.username;
                }
                if (this.clientOptions.password) {
                    options.password = this.clientOptions.password;
                }
            }

            // MQTTS
            if (this.secureClient) {
                options.cert = this.clientOptions.cert;
                options.key = this.clientOptions.key;
                // Reject mqtts connection if authorization fails.
                options.rejectUnauthorized = true;
            }

            const mqttClient = mqtt.connect(null, options);
            mqttClient.on("connect", () => {
                this.mqttClient = mqttClient;
                resolve();
            })
        });
    }

    public stop(): Promise<void> {
        return new Promise(resolve => {
            if (this.mqttClient) {
                this.mqttClient.end(false, () => {
                    this.mqttClient = null;
                    resolve()
                });
            }
        });
    }

    public getScheme(): "mqtt" | "mqtts" {
        return this.secureClient ? "mqtts" : "mqtt";
    }

    public getPort(): number {
        if (this.mqttClient) {
            return this.mqttClient.options.port;
        } else {
            return -1;
        }
    }

    public startListeningOn(topic: string): void {
        if (this.mqttClient) {
            this.mqttClient.subscribe(topic);
        }
    }
    public stopListeningOn(topic: string): void {
        if (this.mqttClient) {
            this.mqttClient.unsubscribe(topic);
        }
    }
    public respond(message: MqttPublish): Promise<void> {
        return this.sendPublish(message);
    }

    public update(message: MqttPublish): Promise<void> {
        return this.sendPublish(message);
    }

    public receive(): Subject<MqttMessage> {
        if (this.mqttClient) {
            let subject = new Subject<MqttMessage>();
            this.mqttClient.on("message", (topic: string, payload: Buffer, packet: mqtt.IPublishPacket) => {
                // Check the version of the MQTT message.
                let message: MqttPublish = { type: "publish", topic, payload, retain: packet.retain };
                if (this.mqttClient.options.protocolVersion && packet.properties) {
                    message.properties = {};
                    Object.assign(
                        {},
                        packet.properties.contentType,
                        packet.properties.responseTopic,
                        packet.properties.correlationData,
                        packet.properties.userProperties);
                }
                subject.next(message);
            });
            return subject;
        }
    }

    private sendPublish(message: MqttPublish): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.mqttClient && message.type === "publish") {
                const publishOptions: any = {
                    retain: message.retain,
                    qos: this.clientOptions.qos
                };

                if (this.mqttClient.options.protocolVersion === 5) {
                    Object.assign(publishOptions.properties, message.properties);
                }
                this.mqttClient.publish(message.topic, message.payload, publishOptions, (err, packet) => {
                    if (err) {
                        console.error(`Error on sending MQTT${this.mqttClient.options.protocolVersion} Publish on topic '${message.topic}': ${err.message}`);
                        reject(err);
                    }
                    resolve();
                });
            } else {
                reject(new Error("Setup of mqttClient necessary."));
            }
        });
    }

}