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
  let boundThing: Thing = JSON.parse(JSON.stringify(thing));

  // fill in binding data (for properties)
  console.debug(`generateTD() found ${Object.keys(boundThing.properties).length} Properties`);
  for (let propertyName in boundThing.properties) {
    let property = boundThing.properties[propertyName];

    // reset as slice() does not make a deep copy
    property.forms = [];

    // a form is generated for each address (except for mqtt), supported protocol, and mediatype
    for (let address of Helpers.getAddresses()) {
      for (let server of servient.getServers()) {
        for (let type of servient.getOffereddMediaTypes()) {

          // if server is online !==-1 assign the href information
          if (server.getPort() !== -1) {
            let href: string = server.scheme + "://" + address + ":" + server.getPort() + "/" + thing.name;

            // depending on the resource pattern, uri is constructed
            property.forms.push(new TD.Form(href + "/properties/" + propertyName, type));
            console.debug(`generateTD() assigns href '${href}' to Property '${propertyName}'`);
          }
        }
      }
    }


  }

  // fill in binding data (for actions)
  console.debug(`generateTD() found ${Object.keys(boundThing.actions).length} Actions`);
  for (let actionName in boundThing.actions) {
    let action = boundThing.actions[actionName];

    // reset as slice() does not make a deep copy
    action.forms = [];

    // a form is generated for each address, supported protocol, and mediatype
    for (let address of Helpers.getAddresses()) {
      for (let server of servient.getServers()) {
        for (let type of servient.getOffereddMediaTypes()) {

          // if server is online !==-1 assign the href information
          if (server.getPort() !== -1) {
            let href: string = server.scheme + "://" + address + ":" + server.getPort() + "/" + thing.name;

            // depending on the resource pattern, uri is constructed
            action.forms.push(new TD.Form(href + "/actions/" + actionName, type));
            console.debug(`generateTD() assigns href '${href}' to Action '${actionName}'`);
          }
        }
      }
    }
  }

  // fill in binding data (for events)
  console.debug(`generateTD() found ${Object.keys(boundThing.events).length} Events`);
  for (let eventName in boundThing.events) {
    let event = boundThing.events[eventName];

    // reset as slice() does not make a deep copy
    event.forms = [];

    // a form is generated for each address, supported protocol, and mediatype
    for (let address of Helpers.getAddresses()) {
      for (let server of servient.getServers()) {
        for (let type of servient.getOffereddMediaTypes()) {

          // if server is online !==-1 assign the href information
          if (server.getPort() !== -1 && server.scheme!=="mqtt") {
            let href: string = server.scheme + "://" +  server.getPort() + "/" + thing.name;

            // depending on the resource pattern, uri is constructed
            event.forms.push(new TD.Form(href + "/events/" + eventName, type));
            console.debug(`generateTD() assigns href '${href}' to Event '${eventName}'`);
          }
        }
      }
    }
        // in the case of mqtt the broker URI is used within the hrefs
    for (let server of servient.getServers()) {
      if(server.scheme=="mqtt") {
        for (let type of servient.getOffereddMediaTypes()) {

          let href: string = server.scheme + "://" + server.getAddress() + ":" + server.getPort() + "/" + thing.name;

          // TODO: add mqtt based vocabularies (qos, retain) to the forms

          // depending on the resource pattern, uri is constructed
          event.forms.push(new TD.Form(href + "/events/" + eventName, type));
          console.debug(`generateTD() assigns href '${href}' to Event '${eventName}'`);
        }
      }
    }
  }

  return boundThing;
}
