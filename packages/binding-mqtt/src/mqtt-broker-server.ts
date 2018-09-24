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

import { IPublishPacket } from "mqtt";
import * as mqtt from "mqtt";
import * as url from "url";

import * as TD from "@node-wot/td-tools";
import { ProtocolServer, ExposedThing, ContentSerdes } from "@node-wot/core";

export default class MqttBrokerServer implements ProtocolServer {

  readonly scheme: string = "mqtt";

  private port: number = -1;
  private address: string = undefined;

  private user: string = undefined; // in the case usesername is required to connect the broker

  private psw: string = undefined; // in the case password is required to connect the broker
  private brokerURI: string = undefined;

  private readonly things: Map<string, ExposedThing> = new Map<string, ExposedThing>();

  private broker: any;

  constructor(uri: string, user?: string, psw?: string) {
    if (uri !== undefined) {

      //if there is a MQTT protocol identicator missing, add this
      if (uri.indexOf("://") == -1) {
        uri = this.scheme + "://" + uri;
      }
      this.brokerURI = uri;
    }

    if (user !== undefined) {
      this.user = user;
    }
    if (psw !== undefined) {
      this.psw = psw;
    }
  }

  public expose(thing: ExposedThing): Promise<void> {

    if (this.broker === undefined) {
      return;
    }

    let name = thing.name;

    if (this.things.has(name)) {
      let suffix = name.match(/.+_([0-9]+)$/);
      if (suffix !== null) {
        name = name.slice(0, -suffix[1].length) + (1 + parseInt(suffix[1]));
      } else {
        name = name + "_2";
      }
    }

    console.log(`MqttBrokerServer at ${this.brokerURI} exposes '${thing.name}' as unique '/${name}/*'`);
    return new Promise<void>((resolve, reject) => {

      // TODO clean-up on destroy and stop
      this.things.set(name, thing);

      for (let actionName in thing.actions) {
        let topic = "/" + encodeURIComponent(name) + "/actions/" + encodeURIComponent(actionName);
        this.broker.subscribe(topic);

        let href = this.brokerURI + topic;
        thing.actions[actionName].forms.push(new TD.Form(href, ContentSerdes.DEFAULT));
        console.log(`MqttBrokerServer at ${this.brokerURI} assigns '${href}' to Action '${actionName}'`);
      }

      // connect incoming messages to Thing
      this.broker.on("message", (receivedTopic: string, payload: string, packet: IPublishPacket) => {

        // route request
        let segments = receivedTopic.split("/");

        if (segments.length === 4 ) {
          console.log(`MqttBrokerServer at ${this.brokerURI} received message for '${receivedTopic}'`);
          let thing = this.things.get(segments[1]);
          if (thing) {
            if (segments[2] === "actions") {
              let action = thing.actions[segments[3]];
              if (action) {
                action.invoke(payload)
                  .then((output) => {
                    // MQTT cannot return results
                    if (output) {
                      console.warn(`MqttBrokerServer at ${this.brokerURI} cannot return output '${segments[3]}'`); 
                    }
                  })
                  .catch(err => {
                    console.error(`MqttBrokerServer at ${this.brokerURI} got error on invoking '${segments[3]}': ${err.message}`);
                  });
                // topic found and message processed
                return;
              } // Action exists?
            }
          } // Thing exists?
        }
        // topic not found
        console.warn(`MqttBrokerServer at ${this.brokerURI} received message for invalid topic '${receivedTopic}'`);
      });

      for (let eventName in thing.events) {
        let topic = "/" + encodeURIComponent(name) + "/events/" + encodeURIComponent(eventName);
        // FIXME store subscription and clean up on stop
        let subscription = thing.events[eventName].subscribe(
          (value) => {
            // send event data
            console.log(`MqttBrokerServer at ${this.brokerURI} publishing to Event topic '${eventName}'`);
            this.broker.publish(topic, value);
          }
        );

        let href = this.brokerURI + topic;
        thing.events[eventName].forms.push(new TD.Form(href, ContentSerdes.DEFAULT));
        console.log(`MqttBrokerServer at ${this.brokerURI} assigns '${href}' to Event '${eventName}'`);
      }

      resolve();
    });
  }

  public start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {

      if (this.brokerURI === undefined) {
        console.warn(`No broker defined for MQTT server binding - skipping`);
        resolve();
      } else {
        // try to connect to the broker without or with credentials
        if (this.psw == undefined) {
          console.info(`MqttBrokerServer trying to connect to broker at ${this.brokerURI}`);
          // TODO test if mqtt extracts port from passed URI (this.address)
          this.broker = mqtt.connect(this.brokerURI);
        } else {
          console.info(`MqttBrokerServer trying to connect to secured broker at ${this.brokerURI}`);
          // TODO test if mqtt extracts port from passed URI (this.address)
          this.broker = mqtt.connect({ host: this.brokerURI }, { username: this.user, password: this.psw });
        }

        this.broker.on("connect", () => {
          console.log(`MqttBrokerServer connected to broker at ${this.brokerURI}`);

          let parsed = url.parse(this.brokerURI);
          this.address = parsed.hostname;
          let port = parseInt(parsed.port);
          this.port = port > 0 ? port : 1883;
          resolve();
        });
        this.broker.on("error", (error: Error) => {
          console.error(`MqttBrokerServer could not connect to broker at ${this.brokerURI}`);
          reject(error);
        });
      }
    });
  }

  public stop(): Promise<void> {
    return new Promise<void>((resolve, reject) => {

      if (this.broker === undefined) resolve();

      this.broker.stop();
    });
  }

  public getPort(): number {
    return this.port;
  }

  public getAddress(): string {
    return this.address;
  }
}