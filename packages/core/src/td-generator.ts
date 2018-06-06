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


import Servient from "./servient"
import ExposedThing from "./exposed-thing"
import { Thing } from "@node-wot/td-tools"
import * as TD from "@node-wot/td-tools"
import * as Helpers from "./helpers";


/** Copies TD members from Thing and adds Servient metadata (security, form)
* generated
* @param thing
* @param servient
*/
export function generateTD(thing: ExposedThing, servient: Servient): Thing {

  // FIXME necessary to create a copy? security and binding data needs to be filled in...
  // Could pass Thing data and binding data separately to serializeTD()?
  let genTD: Thing = new Thing();
  // genTD.semanticType = thing.semanticType.slice(0);
  genTD.name = thing.name;
  genTD.id = thing.id;
  // TODO security
  genTD.security = [{ description: "node-wot development Servient, no security" }];
  // TODO fix these missing information OR can/should this be done differently?
  // genTD.metadata = thing.metadata.slice(0);
  // genTD.interaction = thing.interaction.slice(0); // FIXME: not a deep copy
  genTD.properties = thing.properties;
  genTD.actions = thing.actions;
  genTD.events = thing.events;
  // genTD.link = thing.link.slice(0); // FIXME: not a deep copy
  genTD.link = thing.link;

  // fill in binding data (for properties)
  console.debug(`generateTD() found ${Object.keys(genTD.properties).length} Properties`);
  for (let propertyName in genTD.properties) {
    let property = genTD.properties[propertyName];

    // reset as slice() does not make a deep copy
    property.form = [];

    // a form is generated for each address, supported protocol, and mediatype
    for (let address of Helpers.getAddresses()) {
      for (let server of servient.getServers()) {
        for (let type of servient.getOffereddMediaTypes()) {

          // if server is online !==-1 assign the href information
          if (server.getPort() !== -1) {
            let href: string = server.scheme + "://" + address + ":" + server.getPort() + "/" + thing.name;

            // depending on the resource pattern, uri is constructed
            property.form.push(new TD.Form(href + "/properties/" + propertyName, type));
            console.debug(`generateTD() assigns href '${href}' to Property '${propertyName}'`);
          }
        }
      }
    }
  }

  // fill in binding data (for actions)
  console.debug(`generateTD() found ${Object.keys(genTD.actions).length} Actions`);
  for (let actionName in genTD.actions) {
    let action = genTD.actions[actionName];

    // reset as slice() does not make a deep copy
    action.form = [];

    // a form is generated for each address, supported protocol, and mediatype
    for (let address of Helpers.getAddresses()) {
      for (let server of servient.getServers()) {
        for (let type of servient.getOffereddMediaTypes()) {

          // if server is online !==-1 assign the href information
          if (server.getPort() !== -1) {
            let href: string = server.scheme + "://" + address + ":" + server.getPort() + "/" + thing.name;

            // depending on the resource pattern, uri is constructed
            action.form.push(new TD.Form(href + "/actions/" + actionName, type));
            console.debug(`generateTD() assigns href '${href}' to Action '${actionName}'`);
          }
        }
      }
    }
  }

  // fill in binding data (for events)
  console.debug(`generateTD() found ${Object.keys(genTD.events).length} Events`);
  for (let eventName in genTD.events) {
    let event = genTD.events[eventName];

    // reset as slice() does not make a deep copy
    event.form = [];

    // a form is generated for each address, supported protocol, and mediatype
    for (let address of Helpers.getAddresses()) {
      for (let server of servient.getServers()) {
        for (let type of servient.getOffereddMediaTypes()) {

          // if server is online !==-1 assign the href information
          if (server.getPort() !== -1) {
            let href: string = server.scheme + "://" + address + ":" + server.getPort() + "/" + thing.name;

            // depending on the resource pattern, uri is constructed
            event.form.push(new TD.Form(href + "/events/" + eventName, type));
            console.debug(`generateTD() assigns href '${href}' to Event '${eventName}'`);
          }
        }
      }
    }
  }




  /*
  // fill in binding data
  console.debug(`generateTD() found ${genTD.interaction.length} Interaction${genTD.interaction.length == 1 ? "" : "s"}`);
  for (let interaction of genTD.interaction) {
    // reset as slice() does not make a deep copy
    interaction.form = [];
    // a form is generated for each address, supported protocol, and mediatype
    for (let address of Helpers.getAddresses()) {
      for (let server of servient.getServers()) {
        for (let type of servient.getOffereddMediaTypes()) {
          // if server is online !==-1 assign the href information
          if (server.getPort() !== -1) {
            let href: string = server.scheme + "://" + address + ":" + server.getPort() + "/" + thing.name;
            // depending of the resource pattern, uri is constructed
            if (interaction.pattern === TD.InteractionPattern.Property) {
              interaction.form.push(new TD.InteractionForm(href + "/properties/" + interaction.name, type));
            } else if (interaction.pattern === TD.InteractionPattern.Action) {
              interaction.form.push(new TD.InteractionForm(href + "/actions/" + interaction.name, type));
            } else if (interaction.pattern === TD.InteractionPattern.Event) {
              interaction.form.push(new TD.InteractionForm(href + "/events/" + interaction.name, type));
            }
            console.debug(`generateTD() assigns href '${interaction.form[interaction.form.length - 1].href}' to Interaction '${interaction.name}'`);
          }
        }
      }
    }
  }
  */

  return genTD;
}
