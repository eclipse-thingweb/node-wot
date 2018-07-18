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

import { IPublishPacket } from 'mqtt';
import { ProtocolServer, ResourceListener } from "@node-wot/core";
import { EventResourceListener, ActionResourceListener } from "@node-wot/core";
import * as mqtt from 'mqtt';


export default class MqttBrokerServer implements ProtocolServer {

    readonly scheme: string = 'mqtt'; 

    private port: number = 1883;

    private user:string = undefined; // in the case usesername is required to connect the broker

    private psw:string = undefined; // in the case password is required to connect the broker

    private address: string = undefined;

    private readonly resources: { [key: string]: ResourceListener } = {};

    private broker : any;

    constructor(address: string, port?: number, user?: string, psw?: string) {
        if (port !== undefined) {
        this.port = port;
        }
        if (address !== undefined) {
        
            //if there is a MQTT protocol identicator missing, add this
        if(address.indexOf("://")==-1) {
            address = this.scheme + "://" + address;
        }
        this.address = address;
        }
        if (user !== undefined) {
        this.user = user;
        }
        if (psw !== undefined) {
        this.psw = psw;
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
                      this.logInfo(`Publish data to the topic '${path}'`);

                      this.broker.publish(path, content.body)
                    }
                    //TODO: when to complete?,
                   //complete: () => res.
                  });
                
            }

            if (res instanceof ActionResourceListener) {

                // for Action: we going to subscribe this topic and check if there some new value provided on this topic
                this.broker.subscribe(path);

                this.broker.on('message', (receivedTopic : ByteString, payload :string, packet: IPublishPacket) => {
                    //console.log("Received MQTT message (topic, data): (" + receivedTopic + ", "+ payload + ")");
                    if (receivedTopic === path) {

                        // TODO mediaType handling here
                        res.onInvoke({ mediaType: "application/json", body: new Buffer(payload) })
                        .then(content => {
                            // Actions have a void return (no output)                            
                          })
                          .catch((err) => {
                            console.error(err);
                          });
                    }
                })
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
            // try to connect to the broker without or with credentials
            if(this.psw==undefined) {
                console.info(`Try to connect the MQTT Broker ${(this.address)} port ${this.port}`);
                this.broker = mqtt.connect(this.address+":"+this.port);
            } else {
                console.info(`Try to connect the MQTT Broker ${(this.address !== undefined ? this.address + ' ' : '')} port ${this.port} with credentials`);
                this.broker = mqtt.connect({host:this.address, port:this.port}, {username:this.user, password:this.psw});
            }
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
        return this.port;
    }

    public getAddress = (): string => {

        // replace protocol information and return only the address value
        return this.address.replace(this.scheme+"://","");
    }

    private logInfo = (message: string) => {
        console.info(`[MqttBroker,port=${this.getPort()}]${message}`);
    }

    private logError = (message: string) => {
        console.info(`[MqttBroker,port=${this.getPort()}]${message}`);
    }
}