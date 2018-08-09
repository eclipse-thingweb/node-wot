#!/usr/bin/env node
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

// global W3C WoT Scripting API definitions
import * as WoT from "wot-typescript-definitions";

// node-wot implementation of W3C WoT Servient 
import { Servient } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";

// exposed protocols
import { CoapServer } from "@node-wot/binding-coap";

// tools
const net = require('net');

// the UnicornHat API daemon listens on a Unix socket at /var/run/mysocket
const client = net.createConnection('/var/run/unicornd.socket');
client.on('connect', () => { main(); });
client.on('error', (err: Error) => { console.error('unicornd error: ' + err.message); });
client.on('data', (data: Buffer) => { console.debug('unicornd data: ' + data.toString()); });

// local definitions

declare interface Color {
  r: number,
  g: number,
  b: number
}

let unicorn: WoT.ExposedThing;
let gradient: Array<Color>;
let gradientTimer: any;
let gradIndex: number = 0;
let gradNow: Color;
let gradNext: Color;
let gradVector: Color;

// main logic after connecting to UnicornHat daemon

function main() {

  // init hardware
  setBrightness(100);
  setAll(0, 0, 0);

  console.info("UnicornHAT initilized");

  let servient = new Servient();

  servient.addServer(new HttpServer());
  servient.addServer(new CoapServer());

  // get WoT object for privileged script
  servient.start().then( myWoT => {
  
    console.info("RaspberryServient started");

    try {

      let template: WoT.ThingFragment = { name: "Unicorn" };

      let thing = myWoT.produce(template);
      unicorn = thing;

      unicorn
        .addProperty(
          "brightness",
          {
            type: "integer",
            minimum: 0,
            maximum: 255,
            writable: true
          },
          100 )
        .setPropertyWriteHandler(
          "brightness",
          (value : any) => {
            return new Promise((resolve, reject) => {
              setBrightness(value);
              resolve(value);
            });
          } )
        .addProperty(
          "color",
          {
            type: "object",
            properties: {
              r: { type: "integer", minimum: 0, maximum: 255 },
              g: { type: "integer", minimum: 0, maximum: 255 },
              b: { type: "integer", minimum: 0, maximum: 255 },
            },
            writable: true
          },
          { r: 0, g: 0, b: 0 } )
        .setPropertyWriteHandler(
          "color",
          (value : any) => {
            return new Promise((resolve, reject) => {
              if (typeof value !== "object") {
                reject(new Error("color" + " requires application/json"));
              } else {
                setAll(value.r, value.g, value.b);
                resolve(value);
              }
            });
          } );
        unicorn
        .addAction(
          "gradient",
          {
            input: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  r: { type: "integer", minimum: 0, maximum: 255 },
                  g: { type: "integer", minimum: 0, maximum: 255 },
                  b: { type: "integer", minimum: 0, maximum: 255 },
                }
              },
              "minItems": 2
            }
          } )
        .setActionHandler(
          "gradient",
          (input: Array<Color>) => {
            return new Promise((resolve, reject) => {
              if (input.length < 2) {
                return '{ "minItems": 2 }';
              }
              unicorn.invokeAction('cancel');
    
              gradient = input;
              gradIndex = 0;
              gradNow = gradient[0];
              gradNext = gradient[1];
              gradVector = {
                r: (gradNext.r - gradNow.r) / 20,
                g: (gradNext.g - gradNow.g) / 20,
                b: (gradNext.b - gradNow.b) / 20
              };
              gradientTimer = setInterval(gradientStep, 50);
              resolve(true);
            });
          }
        )
        .addAction(
          "forceColor",
          {
            input: {
              type: "object",
              properties: {
                r: { type: "integer", minimum: 0, maximum: 255 },
                g: { type: "integer", minimum: 0, maximum: 255 },
                b: { type: "integer", minimum: 0, maximum: 255 }
              }
            }
          })
        .setActionHandler(
          "forceColor",
          (input: Color) => {
            return new Promise((resolve, reject) => {
                unicorn.invokeAction('cancel');
                unicorn.writeProperty('color', input);
                resolve();
            });
          }
        )
        .addAction("cancel", {})
        .setActionHandler(
          "cancel",
          () => {
            return new Promise((resolve, reject) => {
              if (gradientTimer) {
                console.info('>> canceling timer');
                clearInterval(gradientTimer);
                gradientTimer = null;
              }
              resolve();
            });
          }
        );
      unicorn.expose();

      unicorn.expose();
      console.info(unicorn.name + " ready");

    } catch (err) {
      console.error("Unicorn setup error: " + err);
    }

  }).catch( (err) => {
    console.error("Servient start error: " + err);
  });
}

// helpers

function roundColor(color: Color): Color {
  return { r: Math.round(color.r), g: Math.round(color.g), b: Math.round(color.b) };
}

function gradientStep() {
  gradNow = {
    r: (gradNow.r + gradVector.r),
    g: (gradNow.g + gradVector.g),
    b: (gradNow.b + gradVector.b)
  };
  unicorn.writeProperty('color', roundColor(gradNow));
  if (gradNow.r === gradNext.r && gradNow.g === gradNext.g && gradNow.b === gradNext.b) {
    gradNow = gradient[gradIndex];
    gradIndex = ++gradIndex % gradient.length;
    gradNext = gradient[gradIndex];
    console.debug('> step new index ' + gradIndex);
    gradVector = {
      r: (gradNext.r - gradNow.r) / 20,
      g: (gradNext.g - gradNow.g) / 20,
      b: (gradNext.b - gradNow.b) / 20
    };
  }
}

function setBrightness(val: number) {
  if (!client) {
    console.error('not connected');
    return;
  }
  client.write(Buffer.from([0, val, 3]));
}

function setPixel(x: number, y: number, r: number, g: number, b: number) {
  if (!client) {
    console.error('not connected');
    return;
  }
  client.write(Buffer.from([1, x, y, g, r, b]));
}

function show() {
  if (!client) {
    console.error('not connected');
    return;
  }
  client.write(Buffer.from([3]));
}

function setAll(r: number, g: number, b: number) {
  if (!client) {
    console.error('not connected');
    return;
  }
  let all = [2];
  for (let i = 0; i < 64; ++i) {
    all.push(g);
    all.push(r);
    all.push(b);
  }
  all.push(3);
  client.write(Buffer.from(all));
}

