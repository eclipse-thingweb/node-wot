
//@ts-ignore
import * as mqttConnection from "mqtt-connection";
import * as mqttPacket from "mqtt-packet";
import * as net from "net";
import { BrokerProxy, MqttClientOptions, MqttProxyOptions, MqttMessage, MqttPublish } from "../src/mqtt";
import { Subject, BehaviorSubject, ReplaySubject } from "rxjs";

export default class BrokerProxyMock extends BrokerProxy {

    private server: net.Server;
    private port: number;
    private options: MqttProxyOptions;
    private mqttHandler: Mqtt3Handler | Mqtt5Handler;
    private messages: Subject<MqttMessage> = new Subject<MqttMessage>();
    private messageQueue: Array<MqttPublish> = [];

    constructor(options: MqttProxyOptions) {
        super(options);
        this.options = options;
    }
    public start(port?: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server = new net.Server();
            this.server.on("connection", (stream) => {
                let client = mqttConnection(stream);
                let mqttHandler: Mqtt3Handler | Mqtt5Handler;
                switch (this.options.protocolVersion) {
                    case 5:
                        this.mqttHandler = new Mqtt5Handler(client, this.messages);
                        break;
                    case 4:
                        this.mqttHandler = new Mqtt3Handler(client, this.messages);
                        break;
                    default:
                        console.error("No protocol specified");
                        reject();
                        break;
                }
                let queueLength = this.messageQueue.length;
                for (let i = 0; i < queueLength; i++) {
                    this.update(this.messageQueue.pop());
                }
            });
            this.server.on("error", err => reject(err));
            this.server.on("listening", () => resolve());
            this.server.listen(this.options.port, "127.0.0.1");
        });
    } 
    public stop(): Promise<void> {
        return new Promise<void>((resolve, reject) => this.server.close(() => {
            this.port = -1;
            resolve();
        }));
    }
    public getScheme(): "mqtt" | "mqtts" {
        throw this.options.protocol;
    }
    public getPort(): number {
        return this.port;
    }
    public startListeningOn(topic: string): void {}
    public stopListeningOn(topic: string): void {}
    public respond(message: MqttPublish): Promise<void> {
        return new Promise((resolve, reject) => {
            this.mqttHandler.send(message);
        });
    }
    public update(message: MqttPublish): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.mqttHandler) {
                this.mqttHandler.send(message);
            } else {
                this.messageQueue.push(message);
            }
            
            resolve();
        });
    }
    public receive(): Subject<MqttMessage> {
        return this.messages;
    }
}

class Mqtt3Handler {
    messages: Subject<MqttMessage>;
    subscriptions: { [topic: string]: Subject<MqttPublish>} = {};
    constructor(client: any, messages: Subject<MqttMessage>) {
        this.messages = messages;
        client.on("connect", (packet: mqttPacket.IConnectPacket) => client.connack({ returnCode: 0 }));
        client.on("publish", (packet: mqttPacket.IPublishPacket) => {
            let payload = packet.payload instanceof Buffer ? packet.payload : Buffer.from(packet.payload);
            const message: MqttPublish = {
                type: "publish",
                topic: packet.topic,
                payload: payload,
                retain: packet.retain
            };
            this.messages.next(message);

            // Send puback if qos == 1.
            if (packet.qos && packet.qos == 1) {
                client.puback({
                    messageId: packet.messageId
                });
            }
        });  
        client.on("subscribe", (packet: mqttPacket.ISubscribePacket) => {
            packet.subscriptions
                .filter(sub => sub.qos <= 1)
                .forEach(sub => {
                    if (!(sub.topic in this.subscriptions)) {
                        this.subscriptions[sub.topic] = new ReplaySubject<MqttPublish>();
                    }
                    this.subscriptions[sub.topic].subscribe(message => {
                        const response: MqttPublish = {
                            type: "publish",
                            topic: message.topic,
                            payload: message.payload,
                            retain: message.retain
                        };
                        client.publish(response);
                    });
                });

            client.suback({ 
                granted: packet.subscriptions.filter(sub => sub.qos <= 1).map(sub => sub.qos), 
                messageId: packet.messageId});
        });
    }
    public send(message: MqttPublish) {
        if (!this.subscriptions[message.topic]) {
            this.subscriptions[message.topic] = new ReplaySubject<MqttPublish>();
        }
        this.subscriptions[message.topic].next(message);
        
    }
}

class Mqtt5Handler {
    messages: Subject<MqttMessage>;
    subscriptions: { [topic: string]: Subject<MqttPublish>} = {};
    constructor(client: any, messages: Subject<MqttMessage>) {
        this.messages = messages;
        client.on("connect", (packet: mqttPacket.IConnectPacket) => client.connack({ statusCode: 0 }));
        client.on("publish", (packet: mqttPacket.IPublishPacket) => {
            let payload = packet.payload instanceof Buffer ? packet.payload : Buffer.from(packet.payload);
            const message: MqttPublish = {
                type: "publish",
                topic: packet.topic,
                payload: payload,
                retain: packet.retain
            };
            if (packet.properties) {
                message.properties = {};
                Object.assign(message.properties, packet.properties);
            }
            this.messages.next(message);

            // Send puback if qos == 1.
            if (packet.qos && packet.qos == 1) {
                client.puback({
                    messageId: packet.messageId
                });
            }
        });
        client.on("subscribe", (packet: mqttPacket.ISubscribePacket) => {
            packet.subscriptions
                .filter(sub => sub.qos <= 1)
                .forEach(sub => {
                    if (!(sub.topic in this.subscriptions)) {
                        this.subscriptions[sub.topic] = new Subject<MqttPublish>();
                    }
                    this.subscriptions[sub.topic].subscribe(message => {
                        const response: MqttPublish = {
                            type: "publish",
                            topic: message.topic,
                            payload: message.payload,
                            retain: message.retain
                        };
                        if (message.properties) {
                            response.properties = {};
                            Object.assign(response.properties, message.properties);
                        }
                        client.publish(response);
                    });
                });

            client.suback({ 
                granted: [packet.subscriptions.filter(sub => sub.qos <= 1).map(sub => sub.qos)], 
                messageId: packet.messageId});
        });
    }

    public send(message: MqttPublish) {
        if (this.subscriptions[message.topic]) {
            this.subscriptions[message.topic].next(message);
        }
    }
}

/**
 * Events not handled:
 * connack
 * puback
 * pubrec
 * pubrel
 * pubcomp
 * suback
 * unsubscribe
 * unsuback
 * pingreq
 * pingresp
 * disconnect
 * auth
 */