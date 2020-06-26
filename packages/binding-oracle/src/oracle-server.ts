/********************************************************************************
 * Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
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
 * CoAP Server based on coap by mcollina
 */

import { ProtocolServer, Servient, ExposedThing } from "@node-wot/core"

const dcl = require("iotcs-csl-js");

export default class OracleServer implements ProtocolServer {

  public readonly scheme: string = "oracle";
  public readonly activationId: string;
  private server: any = undefined;
  private running: boolean = false;
  private failed: boolean = false;

  private readonly devices: { [key: string]: any } = {};

  constructor(store: string = "W3CWOT-GATEWAY", password: string = "Eclipse1") {
    this.activationId = store;
    this.server = new dcl.device.GatewayDevice(store, password);
  }

  public expose(thing: ExposedThing): Promise<void> {

    if (thing["iotcs:deviceModel"] === undefined) {
      return new Promise<void>((resolve, reject) => {
        reject(`OracleServer cannot expose Things without 'iotcs:deviceModel' field`);
      });
    }

    return new Promise<void>((resolve, reject) => {
      if (this.server.isActivated()) {
        // select model based on TD entry
        this.getModel(thing["iotcs:deviceModel"]).then( model => {
          this.registerDevice(thing, model).then( (id) => {
            this.startDevice(id, model, thing).then( () => {
              resolve();
            });
          });
        }).catch( err => {
          reject(err);
        });
      }
    });
  }

  public start(servient: Servient): Promise<void> {
    console.info("[binding-oracle]",`OracleServer starting with ${this.activationId}`);
    return new Promise<void>( (resolve, reject) => {

      if (!this.server.isActivated()) {
        this.server.activate([], (device: any, error: Error) => {
          if (error) {
            reject(error);
          } else {
            this.server = device;
            console.dir(device);
            
            if (this.server.isActivated()) {
              console.debug("[binding-oracle]",`OracleServer ${this.activationId} activated`);
              resolve();
            } else {
              reject(new Error(`Could not activate`));
            }
          }
        });
      } else {
        console.debug("[binding-oracle]",`OracleServer ${this.activationId} already activated`);
        resolve();
      }

    });
  }

  public stop(): Promise<void> {
    console.info("[binding-oracle]",`OracleServer ${this.activationId} stopping`);
    return new Promise<void>((resolve, reject) => {
      // stop promise handles all errors from now on
      try {
        this.server.close();
        resolve();
      } catch(err) {
        reject(new Error(`Could not stop`));
      }
    });
  }

  public getPort(): number {
    // do not show in TD
    return -1;
  }

  /** fetches the device model by URN */
  private getModel(modelUrn: string): Promise<any> {
    console.debug("[binding-oracle]",`OracleServer ${this.activationId} getting model '${modelUrn}'`);
    return new Promise<void>( (resolve, reject) => {
      if (!this.server.isActivated()) {
        reject(new Error(`OracleServer ${this.activationId} not activated`));
      } else {
        this.server.getDeviceModel(modelUrn, (model: any, error: Error) => {
          if (error) {
            reject(error);
          } else {
            console.debug("[binding-oracle]",`OracleServer ${this.activationId} found Device Model`, modelUrn);
            console.dir(model);
            resolve(model);
          }
        });
      }
    });
  }
  
  /** enrolls device and returns id */
  private registerDevice(thing: ExposedThing, model: any): Promise<any> {

    console.debug("[binding-oracle]",`OracleServer ${this.activationId} enrolling '${thing.id}'`);

    return new Promise<void>( (resolve, reject) => {
      if (!this.server.isActivated()) {
        reject(new Error("OracleServer not activated"));
      } else {
        this.server.registerDevice(
          thing.id,
          /*
           * Possible metadata fields
           *
            lib.device.GatewayDevice.DeviceMetadata = {
              MANUFACTURER: 'manufacturer',
              MODEL_NUMBER: 'modelNumber',
              SERIAL_NUMBER: 'serialNumber',
              DEVICE_CLASS: 'deviceClass',
              PROTOCOL: 'protocol',
              PROTOCOL_DEVICE_CLASS: 'protocolDeviceClass',
              PROTOCOL_DEVICE_ID: 'protocolDeviceId'
            }
          */
          {
            description: "node-wot connected device",
            manufacturer: "Eclipse Thingweb"
          },
          [model.urn],
          (id: any, error: Error) => {
            if (error) {
              reject(error);
            } else {
              console.debug("[binding-oracle]",`OracleServer ${this.activationId} registered '${id}'`);
              resolve(id);
            }
          }
        );
      }
    });
  }

  private startDevice(id: any, model: any, thing: ExposedThing): Promise<void> {

    let device = this.server.createVirtualDevice(id, model);

    thing.deviceID = id;

    this.devices[id] = device;

    return new Promise<void>( (resolve, reject) => {

      let updateInterval;
      if (thing["iotcs:updateInterval"] && (typeof thing["iotcs:updateInterval"] === "number")) {
        updateInterval = thing["iotcs:updateInterval"];
      } else {
        console.debug("[binding-oracle]",`### Oracle uses default Property update interval of 5000 ms`);
        console.warn("[binding-oracle]",`### TD can provide "iotcs:updateInterval" to configure interval (in ms)`);
        updateInterval = 5000;
      }

      // Property "reads" are value updates to the cloud
      setInterval( async () => {
        try {
          let attributes: any = {};

          // send all Thing-defined Properties, even if not in Device Model
          for (let propertyName in thing.properties) {
            attributes[propertyName] = await thing.properties[propertyName].read();
          }

          console.debug("[binding-oracle]","### Oracle PROPERTY UPDATE for",thing.deviceID);
          console.dir(attributes);

          device.update(attributes);
        } catch (err) {
          console.error("[binding-oracle]","OracleServer read() error: " + err);
        }
      }, updateInterval);

      // Property writes
      device.onChange = (tupples: any) => {
        tupples.forEach( (tupple: any) => {
          if (thing.properties[tupple.attribute.id] !== undefined) {
            console.debug("[binding-oracle]",`### Thing '${thing.title}' has Property '${tupple.attribute.id}' for writing '${tupple.newValue}'`);
            if (!thing.properties[tupple.attribute.id].readOnly) {
              thing.properties[tupple.attribute.id]
                .write(tupple.newValue)
                .catch((err: any) => { console.error("[binding-oracle]","Property write error: " + err) });
            }
          }
        });
      };

      // Actions
      // only wire Actions defined in Device Model
      for (let action of model.actions) {
        if (thing.actions[action.name] !== undefined) {
          console.debug("[binding-oracle]",`### Thing '${thing.title}' has Action '${action.name}'`);
          device[action.name].onExecute = (param: any) => {
            console.debug("[binding-oracle]",`### Oracle called Action '${action.name}'`);
            thing.actions[action.name]
              .invoke(param)
              .catch((err: any) => { console.error("[binding-oracle]","Action invoke error: " + err) });
            // No action results supported by Oracle
          }
        } else {
          console.warn("[binding-oracle]",`### Oracle Device Model Action '${action.name}' not available on Thing '${thing.title}'`);
        }
      }

      // FIXME: unclear how errors work -- why do they have attribute values?
      device.onError = (tupple: any) => {
        var show = {
          newValues: tupple.newValues,
          tryValues: tupple.tryValues,
          errorResponse: tupple.errorResponse
        };
        console.error("[binding-oracle]","### Oracle ERROR");
        console.dir(show);
      };

      resolve();
    });
  }
}
