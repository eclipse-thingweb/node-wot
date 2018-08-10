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
 * CoAP Server based on coap by mcollina
 */

import { ContentSerdes } from "@node-wot/core";
import { ProtocolServer, ResourceListener, PropertyResourceListener, ActionResourceListener } from "@node-wot/core"

const dcl = require("iotcs-csl-js");

export default class OracleServer implements ProtocolServer {

  public readonly scheme: string = "oracle";
  public readonly activationId: string;
  private readonly port: number = -1;
  private readonly address: string = undefined;
  private server: any = undefined;
  private running: boolean = false;
  private failed: boolean = false;

  private readonly resources: { [key: string]: ResourceListener } = {};


  // TODO remove and use hook for application script (e.g., Thing metadata)
  //private readonly hardcodedUrn: string = "urn:test:w3c-wot:testthing";
  private readonly hardcodedUrn: string = "urn:dev:wot:siemens:festolive";
  // TODO allow for dynamic Things whose device model is not registered yet (use case for .expose() function)
  private device: any;
  // TODO do not duplicate Interaction state down here -- client library design conflict
  private readonly properties: Map<string, any> = new Map<string, any>();
  private readonly actions: Map<string, any> = new Map<string, any>();

  constructor(store: string = "W3CWOT-GATEWAY", password: string = "Wotf2fbj") {
    this.activationId = store;
    this.server = new dcl.device.GatewayDevice(store, password);
  }

  public addResource(path: string, res: ResourceListener): boolean {
    if (this.resources[path] !== undefined) {
      console.warn(`OracleServer ${this.activationId} already has ResourceListener '${path}' - skipping`);
      return false;
    } else {

      // TODO debug-level
      console.log(`OracleServer ${this.activationId} adding resource '${path}'`);
      
      if (res instanceof PropertyResourceListener) {
        console.warn(`### OracleServer ${this.activationId} knows about Property ${res.name}`);

        // .name does not exist on ResourceListener, hence here
        this.resources[res.name] = res;

      } else if (res instanceof ActionResourceListener) {
        console.warn(`### OracleServer ${this.activationId} knows about Action ${res.name}`);

        // .name does not exist on ResourceListener, hence here
        this.resources[res.name] = res;
      }

      /* TODO: Events -- still need the wiring from .emitEvent() down to the ProtocolServers
      // TODO: dynamically register Event URNs based on dynamic Device Models
      if (properties.int > 90) {
          console.log("ALERT: " + properties.int + " higher than 90");
          var alert = this.thing.createAlert('urn:test:w3c-wot:testthing:alert-event');
          alert.fields.cause = "Integer greater than 90";
          alert.raise();
        }
      */

      return true;
    }
  }

  public removeResource(path: string): boolean {
    // TODO debug-level
    console.log(`OracleServer ${this.activationId} removing resource '${path}'`);
    return delete this.resources[path];
  }

  public start(): Promise<void> {
    console.info(`OracleServer starting with ${this.activationId}`);
    return new Promise<void>( (resolve, reject) => {

      if (this.server.isActivated()) {

        // first resource added, lets set up the virtual device
        // TODO create hook, so that Thing name and modelUrn form metadata can be received
        this.getModel(this.hardcodedUrn).then( model => {
          this.registerDevice(model).then( id => {
            this.startDevice(id, model).then( () => {
              resolve();
            });
          });
        }).catch( err => {
          reject(err);
        });
        
      } else {
        
        this.server.activate([], (device: any, error: Error) => {
          if (error) {
            reject(error);
          }

          this.server = device;
          
          if (this.server.isActivated()) {
            console.debug(`OracleServer activated as ${this.activationId}`);
            resolve();
          } else {
            reject(new Error(`Could not activate`));
          }
        });
      }
    });
  }

  public stop(): Promise<void> {
    console.info(`OracleServer ${this.activationId} stopping`);
    return new Promise<void>((resolve, reject) => {
      // stop promise handles all errors from now on
      try {
        this.server.close();
        resolve();  
      } catch(err) {
        reject();
      }
    });
  }

  public getPort(): number {
    // do not show in TD
    return -1;
  }

  /** fetches the device model by URN */
  private getModel(modelUrn: string): Promise<any> {
    console.debug(`OracleServer ${this.activationId} getting model '${modelUrn}'`);
    return new Promise<void>( (resolve, reject) => {
      if (!this.server.isActivated()) {
        reject(new Error(`OracleServer ${this.activationId} not activated`));
      }
      this.server.getDeviceModel(modelUrn, (model: any, error: Error) => {
        if (error) {
            reject(error);
        }
        console.info(`OracleServer ${this.activationId} found Device Model`, modelUrn);
        console.dir(model);
        resolve(model);
      });
    });
  }
  
  /** enrolls device and returns id */
  private registerDevice(model: any): Promise<any> {
    // device allowed to realm
    var hardwareId = `${this.activationId}-${model["name"]}`;

    console.log(`OracleServer ${this.activationId} enrolling '${hardwareId}'`);

    return new Promise<void>( (resolve, reject) => {
      if (!this.server.isActivated()) {
        reject(new Error("OracleServer not activated"));
      }
    
      this.server.registerDevice(
        hardwareId,
        {
          description: "node-wot connected device",
          manufacturer: "Eclipse Thingweb"
        },
        [model.urn],
        function (id: any, error: Error) {
          if (error) {
              reject(error);
          }
          if (id) {
            console.log(`OracleServer registered '${id}'`);
            resolve(id);
          }
        }
      );
    });
  }

  private startDevice(id: any, model: any): Promise<void> {

    this.device = this.server.createVirtualDevice(id, model);

    return new Promise<void>( (resolve, reject) => {

      // "read" is there is only update push in iotcs
      var send = async () => {

        try {
          let attributes: any = {};

          // send all Thing-defined Properties, even if not in Device Model
          for (let resName in this.resources) {
            if (this.resources[resName] instanceof PropertyResourceListener) {
              let content = await this.resources[resName].onRead();
              // FIXME csl is not a low-level server and does not expect bytes
              // FIXME passing null as schema currently not used, but what when it is -- how to access ThingProperty? ResourceListeners should go away..
              attributes[resName] = ContentSerdes.get().contentToValue(content, null);
            }
          }

          console.warn("### Oracle PROPERTY UPDATE");
          console.dir(attributes);

          this.device.update(attributes);
        } catch(err) {
          console.error("OracleServer onRead error: " + err);
        }
      };
      // every 10 seconds...
      setInterval(send, 10000);

      // attribute writes
      this.device.onChange = (tupples: any) => {
        tupples.forEach( (tupple: any) => {
          if (this.resources[tupple.attribute.id] instanceof PropertyResourceListener) {
            console.warn(`### Thing has Property '${tupple.attribute.id}' for writing '${tupple.newValue}'`);
            this.resources[tupple.attribute.id].onWrite({ contentType: "application/json", body: tupple.newValue })
              .catch( (err: any) => { console.error("Property write error: " + err) });
          }
        });
      };

      // actions
      // only wire Actions defined in Device Model
      for (let action of model.actions) {
        console.warn(`### Oracle Device Model has action '${action.name}' / '${action.alias}'`);
          this.device[action.name].onExecute = (param: any) => {
            if (this.resources[action.name] instanceof ActionResourceListener) {
              console.warn(`### Thing has Action '${action.name}'`);
              this.resources[action.name].onInvoke({ contentType: "application/json", body: param })
                .catch( (err: any) => { console.error("Action invoke error: " + err) });
              // No action results supported by Oracle
            }
        }
      }

      // FIXME: unclear how errors work -- why do they have attribute values?
      this.device.onError = (tupple: any) => {
        var show = {
            newValues: tupple.newValues,
            tryValues: tupple.tryValues,
            errorResponse: tupple.errorResponse
        };
        console.warn("### Oracle ERROR");
        console.dir(show);
      };

      resolve();
    });
  }
}
