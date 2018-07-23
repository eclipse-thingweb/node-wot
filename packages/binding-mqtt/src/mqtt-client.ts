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
 * Protocol test suite to test protocol implementations
 */

import { ProtocolClient, Content } from '@node-wot/core';
import { Form } from '@node-wot/td-tools';
import * as mqtt from 'mqtt';
import { MqttForm, MqttQoS } from './mqtt';
import { IPublishPacket, QoS } from 'mqtt';
import * as CS from '../../core/dist/content-serdes';
import * as url from 'url';
import { Subscription } from "rxjs/Subscription";

export default class MqttClient implements ProtocolClient {
    private user:string = undefined;

    private psw:string = undefined;

    constructor(config: any = null, secure = false) {}

    private client : any = undefined;

    public subscribeResource(form: MqttForm, next: ((value: any) => void), error?: (error: any) => void, complete?: () => void): any {

        // get MQTT-based metadata
        let mediaType = form['mediaType'];
        let retain = form['mqtt:retain']; // TODO: is this needed here?
        let qos = form['mqtt:qos']; // TODO: is this needed here?
        let requestUri = url.parse(form['href']);
        let topic = requestUri.pathname;
        let brokerUri : String = "mqtt://"+requestUri.host;

        if(this.client==undefined) {
            this.client = mqtt.connect(brokerUri)
        }

        this.client.on('connect', () => this.client.subscribe(topic))
        this.client.on('message', (receivedTopic : string, payload : string, packet: IPublishPacket) => {
            console.log("Received MQTT message (topic, data): (" + receivedTopic + ", "+ payload + ")");
            if (receivedTopic === topic) {
                let content = new CS.Content(mediaType, new Buffer(payload));
                next({ mediaType: mediaType, body: payload });
            }
        })
        this.client.on('error', (error :any)  => {
            if (this.client) {
                this.client.end();
            }
            this.client == undefined;
            // TODO: error handling
            error(error);
        });


        return new Subscription(()=>{this.client.end()});
      }

    
    readResource = (form: MqttForm): Promise<Content> => {
        return new Promise<Content>((resolve, reject) => {
            throw new Error('Method not implemented.');

        });
    }

    writeResource = (form: MqttForm, content: Content): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
            throw new Error('Method not implemented.');

        });
    }

    invokeResource = (form: MqttForm, content: Content): Promise<Content> => {
        return new Promise<Content>((resolve, reject) => {


            let requestUri = url.parse(form['href']);
            let topic = requestUri.pathname;
            let brokerUri : String = "mqtt://"+requestUri.host;
            
            if(this.client==undefined) {
                this.client = mqtt.connect(brokerUri)
            }
            this.client.publish(topic, content.body)

            // there will bo no response
            resolve({ mediaType: CS.ContentSerdes.DEFAULT, body: new Buffer("") });

        });
    }
    unlinkResource = (form: Form): Promise<void> => {
        //TODO: Implement
        throw new Error('Method not implemented.');
    }
    start = (): boolean => {
        return true;
    }
    stop = (): boolean => {
        return true;
    }
    
    //setSecurity = (metadata: any, credentials?: any): boolean => {
        //TODO: Implement
      //  throw new Error('Method not implemented.');
   // }



    public setSecurity(metadata: Array<WoT.Security>, credentials?: any): boolean {

        if (metadata === undefined || !Array.isArray(metadata) || metadata.length == 0) {
          console.warn(`MqttClient received empty security metadata`);
          return false;
        }      
        let security: WoT.Security = metadata[0];
      
        if (security.scheme === "basic") {
            //this.authorization = "Basic " + new Buffer(credentials.username + ":" + credentials.password).toString('base64');
          //  this.user = mqtt.username;
        }
        return true;
      }

    private mapQoS = (qos: MqttQoS): QoS => {
        switch (qos) {
            case 2:
                return qos = 2;
            case 1:
                return qos = 1;
            case 0:
            default:
                return qos = 0;
        }
    }

    private logError = (message: string): void => {
        console.error(`[MqttClient]${message}`);
    }
}