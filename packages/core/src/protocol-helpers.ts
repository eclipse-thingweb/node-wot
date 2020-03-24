/********************************************************************************
 * Copyright (c) 2018 - 2020 Contributors to the Eclipse Foundation
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

import * as TD from "@node-wot/td-tools";

export default class ProtocolHelpers {

  // set contentType (extend with more?)
  public static updatePropertyFormWithTemplate(form: TD.Form, tdTemplate: WoT.ThingDescription, propertyName: string) {
    if (form && tdTemplate && tdTemplate.properties && tdTemplate.properties[propertyName] && tdTemplate.properties[propertyName].forms) {
      for (let formTemplate of tdTemplate.properties[propertyName].forms) {
        // 1. Try to find match with correct href scheme
        if (formTemplate.href) {
          // TODO match for example http only?
        }

        // 2. Use any form
        if (formTemplate.contentType) {
          form.contentType = formTemplate.contentType;
          return; // abort loop
        }
      }
    }
  }

  public static updateActionFormWithTemplate(form: TD.Form, tdTemplate: WoT.ThingDescription, actionName: string) {
    if (form && tdTemplate && tdTemplate.actions && tdTemplate.actions[actionName] && tdTemplate.actions[actionName].forms) {
      for (let formTemplate of tdTemplate.actions[actionName].forms) {
        // 1. Try to find match with correct href scheme
        if (formTemplate.href) {
          // TODO match for example http only?
        }

        // 2. Use any form
        if (formTemplate.contentType) {
          form.contentType = formTemplate.contentType;
          return; // abort loop
        }
      }
    }
  }

  public static updateEventFormWithTemplate(form: TD.Form, tdTemplate: WoT.ThingDescription, eventName: string) {
    if (form && tdTemplate && tdTemplate.events && tdTemplate.events[eventName] && tdTemplate.events[eventName].forms) {
      for (let formTemplate of tdTemplate.events[eventName].forms) {
        // 1. Try to find match with correct href scheme
        if (formTemplate.href) {
          // TODO match for example http only?
        }

        // 2. Use any form
        if (formTemplate.contentType) {
          form.contentType = formTemplate.contentType;
          return; // abort loop
        }
      }
    }
  }

  public static getPropertyContentType(td: WoT.ThingDescription, propertyName: string, uriScheme: string): string {
    // try to find contentType (How to do this better)
    // Should interaction methods like readProperty() return an encapsulated value container with value&contenType
    // as sketched in https://github.com/w3c/wot-scripting-api/issues/201#issuecomment-573702999
    if (td && propertyName && uriScheme && td.properties && td.properties[propertyName] && td.properties[propertyName].forms && Array.isArray(td.properties[propertyName].forms)) {
      for (let form of td.properties[propertyName].forms) {
        if (form.href && form.href.startsWith(uriScheme) && form.contentType) {
          return form.contentType; // abort loop
        }
      }
    }

    return undefined; // not found
  }

  public static getActionContentType(td: WoT.ThingDescription, actionName: string, uriScheme: string): string {
    // try to find contentType
    if (td && actionName && uriScheme && td.actions && td.actions[actionName] && td.actions[actionName].forms && Array.isArray(td.actions[actionName].forms)) {
      for (let form of td.actions[actionName].forms) {
        if (form.href && form.href.startsWith(uriScheme) && form.contentType) {
          return form.contentType; // abort loop
        }
      }
    }

    return undefined; // not found
  }

  public static getEventContentType(td: WoT.ThingDescription, eventName: string, uriScheme: string): string {
    // try to find contentType
    if (td && eventName && uriScheme && td.events && td.events[eventName] && td.events[eventName].forms && Array.isArray(td.events[eventName].forms)) {
      for (let form of td.events[eventName].forms) {
        if (form.href && form.href.startsWith(uriScheme) && form.contentType) {
          return form.contentType; // abort loop
        }
      }
    }

    return undefined; // not found
  }

}