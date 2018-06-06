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
  // Due to missing deep copy, the genTD copy is quite worthless
  let genTD: Thing = new Thing();
  genTD.context = thing.context.slice(0);
  genTD.semanticType = thing.semanticType.slice(0);
  genTD.name = thing.name;
  genTD.id = thing.id;
  // TODO security
  if (thing.security) {
    genTD.security = thing.security;
  } else {
    genTD.security = [{ description: "node-wot development Servient, no security" }];
  }
  genTD.metadata = thing.metadata.slice(0);
  genTD.interaction = thing.interaction.slice(0); // FIXME: not a deep copy
  genTD.link = thing.link.slice(0); // FIXME: not a deep copy

  // fill in binding data
  console.debug(`generateTD() found ${genTD.interaction.length} Interaction${genTD.interaction.length == 1 ? "" : "s"}`);
  for (let interaction of genTD.interaction) {

    // reset as slice() does not make a deep copy
    interaction.form = [];

    // a form is generated for each address, supported protocol, and mediatype
    for (let address of Helpers.getAddresses()) {
      for (let server of servient.getServers()) {
        for (let type of servient.getOffereddMediaTypes()) {

          /* if server is online !==-1 assign the href information */
          if (server.getPort() !== -1) {
            let href: string = server.scheme + "://" + address + ":" + server.getPort() + "/" + encodeURIComponent(thing.name);
            let pattern: string;

            /* depending of the Interaction Pattern, uri is different */
            if (interaction.pattern === TD.InteractionPattern.Property) {
              pattern = "/properties/";
            } else if (interaction.pattern === TD.InteractionPattern.Action) {
              pattern = "/actions/";
            } else if (interaction.pattern === TD.InteractionPattern.Event) {
              pattern = "/events/";
            }

            interaction.form.push(new TD.InteractionForm(href + pattern + encodeURIComponent(interaction.name), type));

            console.debug(`generateTD() assigns href '${interaction.form[interaction.form.length - 1].href}' to Interaction '${interaction.name}'`);
          }
        }
      }
    }
  }

  return genTD;
}
