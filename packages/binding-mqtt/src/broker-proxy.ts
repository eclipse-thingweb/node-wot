import { MqttMessage, MqttQoS, MqttPublish, MqttProxyOptions } from './mqtt';
import { Subject } from 'rxjs';

export default abstract class MqttBrokerProxy {
    
    proxyOptions: MqttProxyOptions;
    constructor(options: MqttProxyOptions) {
        this.proxyOptions = options;
    }
    public abstract start(port?: number): Promise<void>;
    public abstract stop(): Promise<void>;
    public abstract getScheme(): "mqtt" | "mqtts";
    public abstract getPort(): number;
    public abstract startListeningOn(topic: string): void;
    public abstract stopListeningOn(topic: string): void;
    public abstract respond(message: MqttPublish): Promise<void>;
    public abstract update(message: MqttPublish): Promise<void>;
    public abstract receive(): Subject<MqttMessage>;
}
