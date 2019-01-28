import { ProtocolServer, ContentSerdes, ExposedThing, Helpers } from "@node-wot/core";
import { MqttForm, MqttPublish, MqttSubscribe } from "./mqtt";
import { Subscription } from "rxjs";
import MqttBrokerProxy from "./broker-proxy";

/**
 * Implementation of the Node-WoT ProtocolServer interface.
 * TODO: more description.
 */
export default class MqttServer implements ProtocolServer {
    scheme: string;
    // TODO: WebSockets (ws) and plain TCP (tcp) should also be supported.
    //TODO: set scheme

    private readonly MQTT_TOPIC_SEPARATOR = "/";
    private readonly PROPERTY_DIR = "properties";
    private readonly ACTION_DIR = "actions";
    private readonly EVENT_DIR = "events";
    private readonly things: { [key: string]: ExposedThing } = {};

    /* Communication with MQTT broker */
    private readonly broker: MqttBrokerProxy;
    private requestSubscription: Subscription;


    constructor(brokerAdapter: MqttBrokerProxy) {
        this.broker = brokerAdapter;
        this.scheme = brokerAdapter.getScheme();
    }

    public expose(thing: ExposedThing): Promise<void> {
        return new Promise<void>((resolve) => {
            const name = thing.name in this.things ? Helpers.generateUniqueName(thing.name) : thing.name;

            if (this.getPort() !== -1) {
                this.logInfo(`Exposing '${thing.name}' as unique '/${name}'`);
                this.things[name] = thing;

                //TODO Subscribe already here for read/subscribeEvent.
                for (let address of Helpers.getAddresses()) {
                    for (let contentType of ContentSerdes.get().getOfferedMediaTypes()) {
                        let base: string = this.scheme + '://' + address + ':' + this.getPort() + '/' + encodeURIComponent(name);
                        //TODO proper encoding for topic.

                        // Properties
                        for (let [propertyName, property] of Object.entries(thing.properties)) {
                            const resourceTopic = this.buildMqttTopic(name, this.PROPERTY_DIR, contentType, propertyName);
                            const form = new MqttForm(base, contentType, resourceTopic);
                            if (property.readOnly) {
                                form.op = ["readproperty"];
                            } else if (property.writeOnly) {
                                form.op = ["writeproperty"];
                            } else {
                                form.op = ["readproperty", "writeproperty"];
                            }

                            if (property.observable && !property.writeOnly) {
                                form.op = [...form.op, "observeproperty"]
                            }

                            property.forms.push(form);
                            this.broker.startListeningOn(form["mqtt:topic"]);

                            // Listen on changes and push new values to broker if property is readable.
                            //TODO Does not work like this. But we need to get informed about changes somehow.
                            if (!property.writeOnly) {
                                property.subscribe(
                                    value => {
                                        this.broker.update({
                                            type: "publish",
                                            topic: form["mqtt:topic"],
                                            payload: Buffer.from(value),
                                            retain: false,
                                            properties: {
                                                contentType: contentType
                                            }
                                        });
                                    },
                                    err => this.logError(`Received error during subscribe on property '${propertyName}': ${err.message}`),
                                    () => this.logInfo(`Received completed during subscribe on property '${propertyName}'.`)
                                );
                            }


                            this.logInfo(`Assigning topic '${form["mqtt:topic"]}' to Property '${propertyName}' on broker '${base}'`);
                        }
                        // Actions
                        for (let [actionName, action] of Object.entries(thing.actions)) {
                            const form = new MqttForm(base, contentType, this.buildMqttTopic(name, this.ACTION_DIR, contentType, actionName));
                            form.op = ["invokeaction"];

                            action.forms.push(form);
                            this.broker.startListeningOn(form["mqtt:topic"]);

                            this.logInfo(`Assigning topic '${form["mqtt:topic"]}' to action '${actionName}' on broker '${base}'`);
                        }
                        // Events
                        for (let [eventName, event] of Object.entries(thing.events)) {
                            const form = new MqttForm(base, contentType, this.buildMqttTopic(name, this.EVENT_DIR, contentType, eventName));
                            form.op = ["subscribeevent"];

                            event.forms.push(form);
                            this.broker.startListeningOn(form["mqtt:topic"]);

                            // Listen for new events and push them to broker.
                            event.subscribe(
                                value => {
                                    this.broker.update({
                                        type: "publish",
                                        topic: form["mqtt:topic"],
                                        payload: Buffer.from(value),
                                        retain: false,
                                        properties: {
                                            contentType: contentType
                                        }
                                    });
                                },
                                err => this.logError(`Received error during subscribe on event '${eventName}': ${err.message}`),
                                () => this.logInfo(`Received completed during subscribe on event '${eventName}'.`)
                            );

                            this.logInfo(`Assigning topic '${form["mqtt:topic"]}' to event '${eventName}' on broker '${base}'`);
                        }
                    }
                }
            }
            resolve();
        });
    }
    public start(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.broker.start().then(() => {
                this.requestSubscription = this.broker.receive().subscribe(
                    message => {
                        switch (message.type) {
                            case "subscribe":
                                this.handleSubscribe(message as MqttSubscribe);
                                break;
                            case "publish":
                                this.handlePublish(message as MqttPublish);
                                break;
                            default:
                                this.logError(`Unknown message type: ${message.type}`);
                        }
                    },
                    (err: any) => {
                        this.logError("BrokerProxy has connection problems, stopping...");
                        this.stop();
                        reject(err);
                    },
                    () => {
                        // Should not happen.
                        this.logError("BrokerProxy has connection problems, stopping...");
                        this.stop();
                        reject(new Error(`[MqttBroker,port=${this.getPort()}] BrokerProxy completed publish message forwarding.`));
                    });
                resolve();
            });
        });
    }
    public stop(): Promise<void> {
        if (this.requestSubscription) {
            this.requestSubscription.unsubscribe();
        }

        return this.broker.stop();
    }
    public getPort(): number {
        return this.broker.getPort();
    }

    private handlePublish(message: MqttPublish): void {
        const request = this.parseMqttTopic(message.topic);
        if (request.thingName && request.thingName in this.things) {
            const thing = this.things[request.thingName];
            if (request.dir && request.contentType && request.resourceName) {
                const dir = request.dir;
                const contentType = request.contentType;
                const resourceName = request.resourceName;

                if (dir === this.PROPERTY_DIR && resourceName in thing.properties) {
                    // Write on property.
                    const property = thing.properties[resourceName];
                    if (property.writable) {
                        let value;
                        try {
                            value = ContentSerdes.get().contentToValue({ type: contentType, body: message.payload }, <any>property);
                        } catch (err) {
                            this.logError(`Cannot process write value for property '${resourceName}': ${err.message}`);
                            //TODO Send error code in MQTT5?
                        }

                        if (value) {
                            property.write(value)
                                .catch(err => {
                                    this.logError(`Got internal error on write '${resourceName}': ${err.message}`);
                                    //TODO Send error code in MQTT5?
                                });
                        }
                    }
                } else if (dir === this.ACTION_DIR && resourceName in thing.actions) {
                    // Invoke on action.
                    const action = thing.actions[resourceName];
                    let input;
                    try {
                        input = ContentSerdes.get().contentToValue({ type: contentType, body: message.payload }, action.input);
                    } catch (err) {
                        this.logError(`Cannot process input to action '${resourceName}': ${err.message}`);
                        return;
                        //TODO Send error code in MQTT5?
                    }

                    action.invoke(input)
                        .then(output => {
                            const content = ContentSerdes.get().valueToContent(output, action.output);
                            const responseTopic = message.properties && message.properties.responseTopic
                                ? message.properties.responseTopic
                                : message.topic + "response";


                            this.broker.respond({
                                type: "publish",
                                topic: responseTopic,
                                payload: content.body,
                                retain: false,
                                properties: {
                                    contentType: contentType
                                }
                            });
                        })
                        .catch(err => {
                            this.logError(`Got internal error on invoke '${resourceName}': ${err.message}`);
                        });
                }
            }
        }
    }
    private handleSubscribe(message: MqttSubscribe): void {
        const request = this.parseMqttTopic(message.topic);
        if (request.thingName && request.thingName in this.things) {
            const thing = this.things[request.thingName];

            if (request.dir && request.contentType && request.resourceName) {
                const dir = request.dir;
                const contentType = request.contentType;
                const resourceName = request.resourceName;

                if (dir === this.PROPERTY_DIR && resourceName in thing.properties) {
                    // Read on property.
                    const property = thing.properties[resourceName];
                    property.read()
                        .then(value => {
                            this.broker.respond({
                                type: "publish",
                                topic: message.topic,
                                payload: Buffer.from(value),
                                retain: true,
                                properties: {
                                    contentType: contentType
                                }
                            });
                        })
                        .catch(err => this.logError(`Got internal error on read '${message.topic}': ${err.message}`));

                } else if (request.dir === this.EVENT_DIR && request.resourceName in thing.events) {
                    // Subscribe on event.
                    const event = thing.events[request.resourceName];

                }

            } else {
                // No resource specified -> send TD.
                this.broker.respond({
                    type: "publish",
                    topic: message.topic,
                    payload: Buffer.from(thing.getThingDescription()),
                    retain: true,
                    properties: {
                        contentType: ContentSerdes.TD
                    }
                });
            }
        } else {
            // Empty request -> list all things.
            // Using reduce, because there is no flatmap() available yet.
            const thingList = Helpers.getAddresses()
                .reduce(
                    (acc, address: string) =>
                        acc.concat(Object.keys(this.things).map(name =>
                            `${this.scheme}://${Helpers.toUriLiteral(address)}:${this.getPort}/${encodeURIComponent(name)}`)),
                    []);

            this.broker.respond({
                type: "publish",
                topic: message.topic,
                payload: Buffer.from(JSON.stringify(thingList)),
                retain: true,
                properties: {
                    contentType: ContentSerdes.DEFAULT
                }
            });
        }
    }

    private buildMqttTopic(thing: string, interaction: string, contentType: string, resourceName: string) {
        //TODO: encode forbidden characters such as # or +
        const topic = `${this.MQTT_TOPIC_SEPARATOR}${thing}${this.MQTT_TOPIC_SEPARATOR}${interaction}${this.MQTT_TOPIC_SEPARATOR}${encodeURIComponent(contentType)}${this.MQTT_TOPIC_SEPARATOR}${resourceName}`;
        return topic;
    }

    private parseMqttTopic(topic: string) {
        let tokens = topic.split(this.MQTT_TOPIC_SEPARATOR);
        const segments: { [key: string]: string } = {};

        // Extract resourceName if present.
        const resourceName = tokens.length > 4 ? tokens.slice(4).reduce((acc: string, val: string) => acc + val) : undefined;
        if (resourceName) {
            tokens = topic.replace(resourceName, "").split(this.MQTT_TOPIC_SEPARATOR).filter(token => token && token !== "");
            segments.resourceName = resourceName;
        }

        // Extract rest.
        switch (tokens.length) {
            case 4:
                segments.resourceName = tokens[3];
            case 3:
                segments.contentType = decodeURIComponent(tokens[2]);
            case 2:
                segments.dir = tokens[1];
            case 1:
                segments.thingName = tokens[0];
            default:
                break;
        }

        return segments;
    }

    private logInfo = (message: string) => {
        console.info(`[MqttBroker,port=${this.getPort()}] ${message}`);
    }

    private logError = (message: string) => {
        console.error(`[MqttBroker,port=${this.getPort()}] ${message}`);
    };

}
