/********************************************************************************
 * Copyright (c) 2018 Contributors to the Eclipse Foundation
 * 
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 * 
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0, or the W3C Software Notice and
 * Document License (2015-05-13) which is available at
 * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.
 * 
 * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513
 ********************************************************************************/

/**
 * MQTT Broker Server based on http
 */

import { MqttQoS } from './mqtt';
import { ProtocolServer, ResourceListener, ContentSerdes } from "@node-wot/core";
import { EventResourceListener } from "@node-wot/core";
import * as mqtt from 'mqtt';


export class MqttBrokerServer implements ProtocolServer {

    readonly scheme: string = 'mqtt'; 

    private port: number = 1883;

    private readonly address: string = undefined;

    private readonly resources: { [key: string]: ResourceListener } = {};

    private broker : any;

    constructor(address?: string, port?: number) {
        if (port !== undefined) {
        this.port = port;
        }
        if (address !== undefined) {
        this.address = address;
        }
    }

    public addResource = (path: string, res: ResourceListener): boolean => {
        if (this.resources[path] !== undefined) {
            this.logError(`Already has ResourceListener '${path}' - skipping`);
            return false;
        } else {
            this.logInfo(`Adding resource '${path}'`);
            this.resources[path] = res;

            if (res instanceof EventResourceListener) {
                let subscription = res.subscribe({
                    next: (content) => {
                      // send event data
                      this.logInfo(`publish topic '${path}'`);

                      this.broker.publish(path, content.body)
                    }
                    //,
                   // complete: () => res.
                  });
                
            }

            return true;
        }
    }

    public removeResource = (path: string): boolean => {
        // TODO debug-level
        this.logInfo(`Removing resource '${path}'`);
        return delete this.resources[path];
    }

    public start = (): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
            this.broker = mqtt.connect(this.address+":"+this.port);

            console.info(`Try to onnect to the MQTT Broker ${(this.address !== undefined ? this.address + ' ' : '')}port ${this.port}`);


            this.broker.on('connect', function () {

                console.info(`Connected to the MQTT Broker`);

                resolve();
            })

            this.broker.on('error',  (error: Error) =>  {
                console.error(`No connection to the MQTT Broker`);
                reject(error);
            })

        });
    }

    public stop = (): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
            this.broker.stop();
        });
    }

    public getPort = (): number => {
      /*  if (this.adapter) {
            return this.adapter.getPort();
        } else {
            return -1;
        }*/

        return this.port;
    }




    private handlePublish = (topic: string, payload: Buffer, qos: MqttQoS, retain: Boolean): void => {
        let requestHandler = this.resources[topic];
        //FIXME: Detect content + fancy bug??? let contentType doesn't work... ?!?
        const contentType = 'application/json';

        this.logInfo(`Received publish on topic ${topic}`);

        if (requestHandler === undefined) {
            // No resource handler, stop here.
            //FIXME: How to signal this to mqtt client?
            return;
        } else if (retain && (requestHandler.getType() === 'Property' || requestHandler.getType() === 'Asset')) {
            requestHandler.onWrite({ mediaType: contentType, body: payload })
                .then(() => {
                    // Publish changed property.
                   // this.adapter.publish(topic, payload, MqttQoS.QoS0, true);
                })
                .catch(err => {
                    this.logError(`Got internal error on write '${topic}': ${err.message}`);
                });
        } else if (requestHandler.getType() === 'Action') {
            requestHandler.onInvoke({ mediaType: contentType, body: payload })
                .then(content => {
                    // Publish action's result.
                    //this.adapter.publish(topic, content.body, MqttQoS.QoS0, false);
                })
                .catch(err => {
                    this.logError(`Got internal error on invoke '${topic}': ${err.message}`);
                });
        } else {
            //TODO
        }
    }

    private handleSubscribe = (topic: string, clientId: string): void => {
        let requestHandler = this.resources[topic];
        if (requestHandler === undefined) {
            // No resource handler, stop here.
            //FIXME: How to signal this to mqtt client?
            return;
        } else if (requestHandler.getType() === 'Property' || requestHandler.getType() === 'Asset' || requestHandler.getType() === 'TD') {
            requestHandler.onRead()
                .then(content => {
                   // this.adapter.publish(topic, content.body, MqttQoS.QoS0, true);
                });
        } else if (requestHandler instanceof EventResourceListener) {
            //FIXME: Nothing to do here? Or should we open another topic and pushing the messages there?
        } else {
            //TODO
        }
    }

    private logInfo = (message: string) => {
        console.info(`[MqttBroker,port=${this.getPort()}]${message}`);
    }

    private logError = (message: string) => {
        console.info(`[MqttBroker,port=${this.getPort()}]${message}`);
    }
}